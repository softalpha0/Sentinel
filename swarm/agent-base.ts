import mqtt from 'mqtt';
import { randomUUID } from 'crypto';
import type { AgentRole, DiscoveryMsg, HeartbeatMsg } from './types.js';
import { TOPICS } from './types.js';

export interface SwarmPeer {
  agentId: string;
  role: AgentRole;
  stellarAddress?: string;
  lastSeen: number;
}

const HEARTBEAT_INTERVAL_MS = 30_000;
const PEER_TIMEOUT_MS       = 90_000;

export abstract class AgentBase {
  readonly agentId: string;
  readonly role: AgentRole;
  readonly stellarAddress?: string;

  protected client!: mqtt.MqttClient;
  protected peers = new Map<string, SwarmPeer>();

  private heartbeatTimer?: ReturnType<typeof setInterval>;

  constructor(role: AgentRole, stellarAddress?: string) {
    this.agentId = `${role}-${randomUUID().slice(0, 8)}`;
    this.role = role;
    this.stellarAddress = stellarAddress;
  }

  async connect(brokerUrl = 'mqtt://127.0.0.1:1883'): Promise<void> {
    console.log(`[${this.agentId}] Connecting to FoxMQ at ${brokerUrl}…`);

    this.client = await mqtt.connectAsync(brokerUrl, {
      clientId: this.agentId,
      keepalive: 60,
      reconnectPeriod: 5000,
    });

    console.log(`[${this.agentId}] Connected.`);

    await this.client.subscribeAsync([TOPICS.DISCOVERY, TOPICS.HEARTBEAT]);
    await this.subscribeToTopics();

    this.client.on('message', (topic, payload) => {
      try {
        const msg = JSON.parse(payload.toString());
        this.handleBaseMessage(topic, msg);
        this.handleMessage(topic, msg);
      } catch (e) {
        console.warn(`[${this.agentId}] Bad message on ${topic}:`, e);
      }
    });

    await this.announce();
    this.heartbeatTimer = setInterval(() => this.sendHeartbeat(), HEARTBEAT_INTERVAL_MS);
  }

  async disconnect(): Promise<void> {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    await this.client.endAsync();
    console.log(`[${this.agentId}] Disconnected.`);
  }

  protected abstract subscribeToTopics(): Promise<void>;
  protected abstract handleMessage(topic: string, msg: unknown): void;

  protected async publish<T>(topic: string, msg: T): Promise<void> {
    await this.client.publishAsync(topic, JSON.stringify(msg), { qos: 1 });
  }

  private async announce(): Promise<void> {
    const msg: DiscoveryMsg = {
      agentId: this.agentId,
      role: this.role,
      stellarAddress: this.stellarAddress,
      timestamp: Date.now(),
    };
    await this.publish(TOPICS.DISCOVERY, msg);
    console.log(`[${this.agentId}] Announced as ${this.role}`);
  }

  private async sendHeartbeat(): Promise<void> {
    const msg: HeartbeatMsg = {
      agentId: this.agentId,
      role: this.role,
      timestamp: Date.now(),
      stats: this.getStats(),
    };
    await this.publish(TOPICS.HEARTBEAT, msg);
    this.evictStalePeers();
  }

  protected getStats(): Record<string, number> {
    return {};
  }

  private handleBaseMessage(topic: string, msg: Record<string, unknown>): void {
    if (topic === TOPICS.DISCOVERY) {
      const d = msg as DiscoveryMsg;
      if (d.agentId === this.agentId) return;
      const isNew = !this.peers.has(d.agentId);
      this.peers.set(d.agentId, { ...d, lastSeen: Date.now() });
      if (isNew) {
        console.log(`[${this.agentId}] Peer joined: ${d.agentId} (${d.role})`);
      }
    }

    if (topic === TOPICS.HEARTBEAT) {
      const h = msg as HeartbeatMsg;
      if (h.agentId === this.agentId) return;
      const peer = this.peers.get(h.agentId);
      if (peer) {
        peer.lastSeen = Date.now();
      } else {
        this.peers.set(h.agentId, { agentId: h.agentId, role: h.role, lastSeen: Date.now() });
        console.log(`[${this.agentId}] Peer discovered via heartbeat: ${h.agentId} (${h.role})`);
      }
    }
  }

  private evictStalePeers(): void {
    const cutoff = Date.now() - PEER_TIMEOUT_MS;
    for (const [id, peer] of this.peers) {
      if (peer.lastSeen < cutoff) {
        console.warn(`[${this.agentId}] Peer timed out: ${id} (${peer.role})`);
        this.peers.delete(id);
        this.onPeerLeft(peer);
      }
    }
  }

  protected onPeerLeft(_peer: SwarmPeer): void {}

  protected peersWithRole(role: AgentRole): SwarmPeer[] {
    return [...this.peers.values()].filter(p => p.role === role);
  }

  protected countRole(role: AgentRole): number {
    return this.peersWithRole(role).length;
  }
}
