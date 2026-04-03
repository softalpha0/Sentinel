import { randomUUID } from 'crypto';
import { AgentBase, type SwarmPeer } from './agent-base.js';
import { TOPICS } from './types.js';
import type { ConsensusDecisionMsg, ExecutionConfirmMsg } from './types.js';
import { buyToken } from '../src/jupiter.js';
import { openPosition, getOpenPositions, startMonitor } from '../src/positions.js';
import { CONFIG } from '../src/config.js';
import type { Position } from '../src/types.js';

export class ExecutionAgent extends AgentBase {
  private monitorHandle?: ReturnType<typeof startMonitor>;
  private executedCount = 0;
  private skippedCount = 0;
  // Track requestIds we've already acted on — critical: only ONE execution agent
  // should trade per decision. We accept the first and ignore duplicates.
  private executed = new Set<string>();

  constructor() {
    super('execution');
  }

  protected async subscribeToTopics(): Promise<void> {
    await this.client.subscribeAsync(TOPICS.DECISION, { qos: 1 });
    console.log(`[${this.agentId}] Subscribed to ${TOPICS.DECISION}`);
  }

  protected handleMessage(topic: string, msg: unknown): void {
    if (topic === TOPICS.DECISION) {
      void this.handleDecision(msg as ConsensusDecisionMsg);
    }
  }

  protected getStats(): Record<string, number> {
    return {
      executed: this.executedCount,
      skipped: this.skippedCount,
      openPositions: getOpenPositions().length,
    };
  }

  // ── Startup / shutdown ────────────────────────────────────────────────────

  startMonitoring(): void {
    this.monitorHandle = startMonitor();
    console.log(`[${this.agentId}] TP/SL monitor started.`);
  }

  stopMonitoring(): void {
    if (this.monitorHandle) clearInterval(this.monitorHandle);
  }

  // ── Peer fault tolerance ──────────────────────────────────────────────────

  protected onPeerLeft(peer: SwarmPeer): void {
    if (peer.role === 'consensus') {
      console.warn(`[${this.agentId}] Consensus agent ${peer.agentId} went offline — will wait for another.`);
    }
  }

  // ── Decision handling ─────────────────────────────────────────────────────

  private async handleDecision(msg: ConsensusDecisionMsg): Promise<void> {
    if (this.executed.has(msg.requestId)) return; // already handled
    this.executed.add(msg.requestId);

    const { tokenAddress, symbol, decision, score, rugScore, reason, pair } = msg;

    if (decision === 'skip') {
      this.skippedCount++;
      console.log(`[${this.agentId}] SKIP ${symbol} — ${reason}`);
      await this.confirm(msg.requestId, tokenAddress, symbol, 'skipped', reason);
      return;
    }

    // ── Guard: check capacity ────────────────────────────────────────────────
    const open = getOpenPositions();
    if (open.length >= CONFIG.MAX_OPEN_POSITIONS) {
      const detail = `Max open positions (${CONFIG.MAX_OPEN_POSITIONS}) reached`;
      console.log(`[${this.agentId}] SKIP ${symbol} — ${detail}`);
      await this.confirm(msg.requestId, tokenAddress, symbol, 'skipped', detail);
      this.skippedCount++;
      return;
    }

    // ── Guard: not already holding this token ────────────────────────────────
    if (open.some(p => p.tokenAddress === tokenAddress)) {
      const detail = `Already holding ${symbol}`;
      console.log(`[${this.agentId}] SKIP ${symbol} — ${detail}`);
      await this.confirm(msg.requestId, tokenAddress, symbol, 'skipped', detail);
      this.skippedCount++;
      return;
    }

    // ── Execute buy ──────────────────────────────────────────────────────────
    console.log(`[${this.agentId}] BUY ${symbol} | score ${score} | rug ${rugScore}`);

    let swapResult;
    try {
      swapResult = await buyToken(tokenAddress, CONFIG.MAX_BUY_SOL);
    } catch (e) {
      const detail = `Buy failed: ${String(e)}`;
      console.error(`[${this.agentId}] ${detail}`);
      await this.confirm(msg.requestId, tokenAddress, symbol, 'error', detail);
      return;
    }

    const entryPrice = pair.priceUsd ? parseFloat(pair.priceUsd) : 0;

    const position: Position = {
      id: randomUUID(),
      tokenAddress,
      symbol,
      pairAddress: pair.pairAddress,
      entryPrice,
      entryTime: Date.now(),
      solSpent: CONFIG.MAX_BUY_SOL,
      tokenAmount: swapResult.outAmount,
      takeProfit: CONFIG.TAKE_PROFIT_X,
      stopLoss: CONFIG.STOP_LOSS_FRACTION,
      status: 'open',
      paperTrade: CONFIG.PAPER_TRADING,
    };

    openPosition(position);
    this.executedCount++;

    const mode = CONFIG.PAPER_TRADING ? '[PAPER]' : '[LIVE]';
    console.log(
      `[${this.agentId}] ${mode} Bought ${symbol} — tx ${swapResult.signature.slice(0, 12)}…`
    );

    await this.confirm(msg.requestId, tokenAddress, symbol, 'bought',
      `${mode} tx=${swapResult.signature}`);

    // Prune executed set — keep last 500
    if (this.executed.size > 500) {
      const entries = [...this.executed];
      entries.slice(0, entries.length - 500).forEach(k => this.executed.delete(k));
    }
  }

  private async confirm(
    requestId: string,
    tokenAddress: string,
    symbol: string,
    action: ExecutionConfirmMsg['action'],
    details?: string,
  ): Promise<void> {
    const msg: ExecutionConfirmMsg = {
      requestId,
      executionAgentId: this.agentId,
      tokenAddress,
      symbol,
      action,
      details,
      timestamp: Date.now(),
    };
    await this.publish(TOPICS.EXECUTION, msg);
  }
}

// ── Entrypoint ────────────────────────────────────────────────────────────────

if (process.argv[1]?.endsWith('execution-agent.ts') || process.argv[1]?.endsWith('execution-agent.js')) {
  const BROKER = process.env.FOXMQ_URL ?? 'mqtt://127.0.0.1:1883';
  const agent = new ExecutionAgent();
  await agent.connect(BROKER);
  agent.startMonitoring();

  process.on('SIGINT', async () => {
    agent.stopMonitoring();
    await agent.disconnect();
    process.exit(0);
  });
}
