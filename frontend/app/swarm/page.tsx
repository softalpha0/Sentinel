'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

// ── Types (mirrors swarm/types.ts) ────────────────────────────────────────────

type AgentRole = 'scanner' | 'risk' | 'consensus' | 'execution';

interface Peer {
  agentId: string;
  role: AgentRole;
  stellarAddress?: string;
  lastSeen: number;
  stats?: Record<string, number>;
}

interface FeedEvent {
  id: string;
  topic: string;
  ts: number;
  label: string;
  detail: string;
  kind: 'candidate' | 'risk' | 'decision-buy' | 'decision-skip' | 'execution' | 'info';
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const ROLE_COLOR: Record<AgentRole, string> = {
  scanner:   'bg-sky-500/10 border-sky-500/30 text-sky-400',
  risk:      'bg-amber-500/10 border-amber-500/30 text-amber-400',
  consensus: 'bg-violet-500/10 border-violet-500/30 text-violet-400',
  execution: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
};

const KIND_DOT: Record<FeedEvent['kind'], string> = {
  candidate:      'bg-sky-400',
  risk:           'bg-amber-400',
  'decision-buy': 'bg-emerald-400',
  'decision-skip':'bg-zinc-500',
  execution:      'bg-emerald-400 animate-pulse',
  info:           'bg-zinc-600',
};

function ago(ts: number): string {
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  return `${Math.floor(s / 60)}m ago`;
}

function shortId(id: string) { return id.split('-')[1] ?? id.slice(0, 8); }

// ── Component ─────────────────────────────────────────────────────────────────

export default function SwarmPage() {
  const [peers, setPeers]   = useState<Map<string, Peer>>(new Map());
  const [feed, setFeed]     = useState<FeedEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const [stats, setStats]   = useState({ candidates: 0, buys: 0, skips: 0, payments: 0 });
  const clientRef    = useRef<import('mqtt').MqttClient | null>(null);
  const feedRef      = useRef<FeedEvent[]>([]);
  const connectedAt  = useRef<number>(0);

  function pushEvent(ev: Omit<FeedEvent, 'id' | 'ts'>) {
    const full: FeedEvent = { ...ev, id: Math.random().toString(36).slice(2), ts: Date.now() };
    feedRef.current = [full, ...feedRef.current].slice(0, 80);
    setFeed([...feedRef.current]);
  }

  useEffect(() => {
    let mqttClient: import('mqtt').MqttClient;
    let heartbeatTimer: ReturnType<typeof setInterval>;

    async function connect() {
      const mqtt = (await import('mqtt')).default;

      // Connect via WebSocket to FoxMQ
      mqttClient = mqtt.connect('ws://localhost:8080', {
        clientId: `swarm-dashboard-${Math.random().toString(36).slice(2, 8)}`,
        keepalive: 60,
        reconnectPeriod: 3000,
      });

      clientRef.current = mqttClient;

      mqttClient.on('connect', () => {
        connectedAt.current = Date.now();
        setConnected(true);
        mqttClient.subscribe([
          'swarm/discovery',
          'swarm/heartbeat',
          'swarm/candidates',
          'swarm/risk-reports',
          'swarm/consensus/decision',
          'swarm/execution/confirm',
        ]);
        pushEvent({ topic: 'system', label: 'Dashboard connected', detail: 'Listening to all swarm topics', kind: 'info' });
      });

      mqttClient.on('disconnect', () => setConnected(false));
      mqttClient.on('error', () => setConnected(false));

      mqttClient.on('message', (topic: string, payload: Buffer) => {
        let msg: Record<string, unknown>;
        try { msg = JSON.parse(payload.toString()); } catch { return; }

        // Discard messages from before this dashboard session connected
        const msgTs = (msg.timestamp as number | undefined) ?? 0;
        if (msgTs && msgTs < connectedAt.current) return;

        // ── Discovery ──────────────────────────────────────────────────────
        if (topic === 'swarm/discovery') {
          const { agentId, role, stellarAddress } = msg as { agentId: string; role: AgentRole; stellarAddress?: string };
          setPeers(prev => {
            const next = new Map(prev);
            next.set(agentId, { agentId, role, stellarAddress, lastSeen: Date.now() });
            return next;
          });
          pushEvent({ topic, label: `${role} joined`, detail: shortId(agentId as string), kind: 'info' });
        }

        // ── Heartbeat ──────────────────────────────────────────────────────
        if (topic === 'swarm/heartbeat') {
          const { agentId, stats: peerStats } = msg as { agentId: string; stats?: Record<string, number> };
          setPeers(prev => {
            const next = new Map(prev);
            const peer = next.get(agentId as string);
            if (peer) next.set(agentId as string, { ...peer, lastSeen: Date.now(), stats: peerStats });
            return next;
          });
        }

        // ── Candidate ──────────────────────────────────────────────────────
        if (topic === 'swarm/candidates') {
          const { pair, stellarTxHash } = msg as { pair: { baseToken: { symbol: string } }; stellarTxHash?: string };
          setStats(s => ({ ...s, candidates: s.candidates + 1, payments: s.payments + (stellarTxHash ? 1 : 0) }));
          pushEvent({
            topic,
            label: `Candidate: ${pair.baseToken.symbol}`,
            detail: stellarTxHash ? `+ payment ${stellarTxHash.slice(0, 10)}…` : 'no payment',
            kind: 'candidate',
          });
        }

        // ── Risk report ────────────────────────────────────────────────────
        if (topic === 'swarm/risk-reports') {
          const { symbol, passed, score, riskAgentId } = msg as { symbol: string; passed: boolean; score: number; riskAgentId: string };
          pushEvent({
            topic,
            label: `Risk: ${symbol} → ${passed ? `score ${score}` : 'FAIL'}`,
            detail: shortId(riskAgentId as string),
            kind: 'risk',
          });
        }

        // ── Consensus decision ─────────────────────────────────────────────
        if (topic === 'swarm/consensus/decision') {
          const { symbol, decision, score, reason } = msg as { symbol: string; decision: string; score: number; reason: string };
          const isBuy = decision === 'buy';
          setStats(s => ({ ...s, buys: s.buys + (isBuy ? 1 : 0), skips: s.skips + (isBuy ? 0 : 1) }));
          pushEvent({
            topic,
            label: `${isBuy ? 'BUY' : 'SKIP'} ${symbol}${isBuy ? ` | score ${score}` : ''}`,
            detail: (reason as string).slice(0, 60),
            kind: isBuy ? 'decision-buy' : 'decision-skip',
          });
        }

        // ── Execution confirm ──────────────────────────────────────────────
        if (topic === 'swarm/execution/confirm') {
          const { symbol, action, details } = msg as { symbol: string; action: string; details?: string };
          pushEvent({
            topic,
            label: `Executed: ${action.toUpperCase()} ${symbol}`,
            detail: (details ?? '').slice(0, 60),
            kind: 'execution',
          });
        }
      });

      // Evict stale peers every 30s
      heartbeatTimer = setInterval(() => {
        const cutoff = Date.now() - 90_000;
        setPeers(prev => {
          const next = new Map(prev);
          for (const [id, peer] of next) {
            if (peer.lastSeen < cutoff) next.delete(id);
          }
          return next;
        });
      }, 30_000);
    }

    connect();

    return () => {
      clearInterval(heartbeatTimer);
      mqttClient?.end();
    };
  }, []);

  const peerList = [...peers.values()];
  const byRole = (role: AgentRole) => peerList.filter(p => p.role === role);

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="sticky top-0 z-40 h-12 border-b border-zinc-900 bg-black/80 backdrop-blur-xl flex items-center px-5">
        <div className="flex items-center gap-2 text-sm">
          <Link href="/" className="text-zinc-500 hover:text-white transition-colors">Risk Sentinel</Link>
          <span className="text-zinc-800">/</span>
          <Link href="/dashboard" className="text-zinc-500 hover:text-white transition-colors">Dashboard</Link>
          <span className="text-zinc-800">/</span>
          <span className="text-white">Swarm</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-emerald-400 animate-pulse' : 'bg-red-500'}`} />
          <span className="text-xs text-zinc-500">
            {connected ? `FoxMQ · ${peerList.length} peer${peerList.length !== 1 ? 's' : ''}` : 'Disconnected'}
          </span>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-5 py-8 space-y-6">

        {/* Not connected banner */}
        {!connected && (
          <div className="card border-amber-500/20 bg-amber-500/5 p-4 text-sm text-amber-400">
            Cannot reach FoxMQ WebSocket at <code className="bg-amber-500/10 px-1 rounded">ws://localhost:8080</code>.
            Make sure the broker is running:{' '}
            <code className="bg-amber-500/10 px-1 rounded">npm run foxmq:start</code>
          </div>
        )}

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Candidates', value: stats.candidates, color: 'text-sky-400' },
            { label: 'Buys',       value: stats.buys,       color: 'text-emerald-400' },
            { label: 'Skips',      value: stats.skips,      color: 'text-zinc-400' },
            { label: 'Payments',   value: stats.payments,   color: 'text-amber-400' },
          ].map(s => (
            <div key={s.label} className="card p-4">
              <p className="text-xs text-zinc-500 mb-1">{s.label}</p>
              <p className={`text-2xl font-semibold tabular-nums ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Peer topology */}
        <div className="card p-5">
          <p className="text-xs font-medium text-zinc-500 mb-4">Swarm Topology — Vertex P2P mesh</p>
          {peerList.length === 0 ? (
            <p className="text-sm text-zinc-600">No agents online yet. Run <code className="bg-zinc-900 px-1 rounded">npm run swarm</code></p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              {(['scanner', 'risk', 'consensus', 'execution'] as AgentRole[]).map(role => (
                <div key={role} className="space-y-2">
                  <p className="text-xs text-zinc-600 uppercase tracking-widest">{role}</p>
                  {byRole(role).length === 0 ? (
                    <div className="border border-dashed border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-700">offline</div>
                  ) : (
                    byRole(role).map(peer => (
                      <div key={peer.agentId} className={`border rounded-lg px-3 py-2 ${ROLE_COLOR[peer.role]}`}>
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80 animate-pulse" />
                          <span className="text-xs font-mono font-medium">{shortId(peer.agentId)}</span>
                        </div>
                        {peer.stats && Object.entries(peer.stats).map(([k, v]) => (
                          <div key={k} className="text-xs opacity-60">{k}: {v}</div>
                        ))}
                        {peer.stellarAddress && (
                          <div className="text-xs opacity-50 font-mono mt-0.5 truncate">
                            ★ {peer.stellarAddress.slice(0, 8)}…
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Message flow diagram */}
        <div className="card p-5">
          <p className="text-xs font-medium text-zinc-500 mb-4">Message Flow</p>
          <div className="flex items-center gap-2 text-xs flex-wrap">
            {[
              { label: 'Scanner', color: 'bg-sky-500/20 text-sky-400 border-sky-500/30' },
              { label: '→ swarm/candidates →', color: 'text-zinc-600' },
              { label: 'Risk (×2)', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
              { label: '→ swarm/risk-reports →', color: 'text-zinc-600' },
              { label: 'Consensus', color: 'bg-violet-500/20 text-violet-400 border-violet-500/30' },
              { label: '→ swarm/consensus/decision →', color: 'text-zinc-600' },
              { label: 'Execution', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
            ].map((item, i) => (
              item.label.startsWith('→') ? (
                <span key={i} className={item.color}>{item.label}</span>
              ) : (
                <span key={i} className={`border rounded px-2 py-0.5 ${item.color}`}>{item.label}</span>
              )
            ))}
          </div>
          <p className="text-xs text-zinc-700 mt-3">
            Stellar micropayments flow Scanner → Risk per analysis · Consensus enforces Byzantine quorum (8s window)
          </p>
        </div>

        {/* Live event feed */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-medium text-zinc-500">Live Event Feed</p>
            <span className="text-xs text-zinc-700">{feed.length} events</span>
          </div>
          <div className="space-y-1 max-h-96 overflow-y-auto">
            {feed.length === 0 ? (
              <p className="text-sm text-zinc-600">Waiting for swarm events…</p>
            ) : (
              feed.map(ev => (
                <div key={ev.id} className="flex items-start gap-2.5 py-1.5 border-b border-zinc-900 last:border-0">
                  <span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${KIND_DOT[ev.kind]}`} />
                  <div className="flex-1 min-w-0">
                    <span className="text-xs text-white">{ev.label}</span>
                    {ev.detail && <span className="text-xs text-zinc-500 ml-2">{ev.detail}</span>}
                  </div>
                  <span className="text-xs text-zinc-700 shrink-0 tabular-nums">{ago(ev.ts)}</span>
                </div>
              ))
            )}
          </div>
        </div>

      </main>
    </div>
  );
}
