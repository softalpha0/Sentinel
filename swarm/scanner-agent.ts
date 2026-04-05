import { randomUUID } from 'crypto';
import { AgentBase } from './agent-base.js';
import { TOPICS } from './types.js';
import type { CandidateMsg } from './types.js';
import { findNewPairs } from '../src/dexscreener.js';
import { CONFIG } from '../src/config.js';
import { payForAnalysis } from './payment.js';
import { getStellarPublicKey } from '../src/stellar-wallet.js';

export class ScannerAgent extends AgentBase {
  private scanTimer?: ReturnType<typeof setInterval>;
  private scannedCount = 0;
  private publishedCount = 0;
  private cooldown = new Map<string, number>();
  private readonly COOLDOWN_MS = 2 * 60 * 60 * 1000;

  constructor() {
    super('scanner');
  }

  protected async subscribeToTopics(): Promise<void> {}

  protected handleMessage(_topic: string, _msg: unknown): void {}

  protected getStats(): Record<string, number> {
    return { scanned: this.scannedCount, published: this.publishedCount };
  }

  startScanning(intervalMs = CONFIG.SCAN_INTERVAL_MS): void {
    console.log(`[${this.agentId}] Scanner started — interval ${intervalMs / 1000}s`);
    void this.scan();
    this.scanTimer = setInterval(() => void this.scan(), intervalMs);
  }

  stopScanning(): void {
    if (this.scanTimer) clearInterval(this.scanTimer);
  }

  private async scan(): Promise<void> {
    console.log(`[${this.agentId}] Scanning DexScreener…`);
    let candidates;
    try {
      candidates = await findNewPairs();
    } catch (e) {
      console.error(`[${this.agentId}] DexScreener error:`, e);
      return;
    }

    this.scannedCount += candidates.length;
    const riskPeers = this.countRole('risk');

    if (riskPeers === 0) {
      console.warn(`[${this.agentId}] No risk agents online — candidates queued but not published.`);
    }

    for (const { pair } of candidates) {
      const key = pair.baseToken.address;
      const lastSeen = this.cooldown.get(key) ?? 0;
      if (Date.now() - lastSeen < this.COOLDOWN_MS) continue;
      this.cooldown.set(key, Date.now());

      const riskPeerList = this.peersWithRole('risk');
      let stellarTxHash: string | undefined;
      let stellarFrom: string | undefined;

      for (const riskPeer of riskPeerList) {
        if (riskPeer.stellarAddress) {
          const hash = await payForAnalysis(riskPeer.stellarAddress, `req-${pair.baseToken.symbol.slice(0, 10)}`);
          if (hash) {
            stellarTxHash = hash;
            try { stellarFrom = getStellarPublicKey(); } catch { /* ignore */ }
          }
          break;
        }
      }

      const msg: CandidateMsg = {
        requestId: randomUUID(),
        scannerAgentId: this.agentId,
        pair,
        timestamp: Date.now(),
        stellarTxHash,
        stellarFrom,
      };

      await this.publish(TOPICS.CANDIDATES, msg);
      this.publishedCount++;
      console.log(`[${this.agentId}] Published candidate: ${pair.baseToken.symbol} (${msg.requestId.slice(0, 8)})`);

      await sleep(1000);
    }

    const cutoff = Date.now() - this.COOLDOWN_MS;
    for (const [k, ts] of this.cooldown) {
      if (ts < cutoff) this.cooldown.delete(k);
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

if (process.argv[1]?.endsWith('scanner-agent.ts') || process.argv[1]?.endsWith('scanner-agent.js')) {
  const BROKER = process.env.FOXMQ_URL ?? 'mqtt://127.0.0.1:1883';
  const agent = new ScannerAgent();
  await agent.connect(BROKER);
  agent.startScanning();

  process.on('SIGINT', async () => {
    agent.stopScanning();
    await agent.disconnect();
    process.exit(0);
  });
}
