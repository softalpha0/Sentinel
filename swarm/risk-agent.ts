import { AgentBase } from './agent-base.js';
import { TOPICS } from './types.js';
import type { CandidateMsg, RiskReportMsg } from './types.js';
import { fetchRugReport } from '../src/rugcheck.js';
import { scoreToken } from '../src/scorer.js';
import { CONFIG } from '../src/config.js';
import { verifyAnalysisPayment, formatPrice } from './payment.js';

export class RiskAgent extends AgentBase {
  private processedCount = 0;
  private passedCount = 0;
  private seen = new Set<string>();

  constructor(stellarAddress?: string) {
    super('risk', stellarAddress);
  }

  protected async subscribeToTopics(): Promise<void> {
    await this.client.subscribeAsync(TOPICS.CANDIDATES, { qos: 1 });
    console.log(`[${this.agentId}] Subscribed to ${TOPICS.CANDIDATES}`);
  }

  protected handleMessage(topic: string, msg: unknown): void {
    if (topic === TOPICS.CANDIDATES) {
      void this.handleCandidate(msg as CandidateMsg);
    }
  }

  protected getStats(): Record<string, number> {
    return { processed: this.processedCount, passed: this.passedCount };
  }

  private async handleCandidate(msg: CandidateMsg): Promise<void> {
    if (this.seen.has(msg.requestId)) return;
    this.seen.add(msg.requestId);

    const { pair, requestId, stellarTxHash } = msg;
    const symbol = pair.baseToken.symbol;
    const mint = pair.baseToken.address;

    if (this.stellarAddress) {
      if (!stellarTxHash) {
        console.warn(`[${this.agentId}] SKIP ${symbol} — no payment (requires ${formatPrice()})`);
        return;
      }
      const paid = await verifyAnalysisPayment(stellarTxHash, this.stellarAddress);
      if (!paid) {
        console.warn(`[${this.agentId}] SKIP ${symbol} — payment verification failed`);
        return;
      }
      console.log(`[${this.agentId}] Payment verified for ${symbol} ✓`);
    }

    console.log(`[${this.agentId}] Analyzing ${symbol} (req ${requestId.slice(0, 8)})…`);
    this.processedCount++;

    let rugReport;
    try {
      rugReport = await fetchRugReport(mint);
    } catch (e) {
      console.warn(`[${this.agentId}] RugCheck failed for ${symbol}:`, e);
      return;
    }

    if (!rugReport) {
      const report: RiskReportMsg = {
        requestId,
        riskAgentId: this.agentId,
        tokenAddress: mint,
        symbol,
        passed: false,
        score: 0,
        rugScore: 9999,
        breakdown: { age: 0, volumeMcap: 0, momentum: 0, buyPressure: 0, social: 0, rugSafety: 0 },
        pair,
        timestamp: Date.now(),
      };
      await this.publish(TOPICS.RISK, report);
      return;
    }

    const tokenScore = scoreToken(pair, rugReport);
    const passed = tokenScore.composite >= CONFIG.MIN_COMPOSITE_SCORE;
    this.passedCount += passed ? 1 : 0;

    const report: RiskReportMsg = {
      requestId,
      riskAgentId: this.agentId,
      tokenAddress: mint,
      symbol,
      passed,
      score: tokenScore.composite,
      rugScore: rugReport.score,
      breakdown: tokenScore.breakdown,
      pair,
      timestamp: Date.now(),
    };

    await this.publish(TOPICS.RISK, report);

    console.log(
      `[${this.agentId}] ${symbol} → score ${tokenScore.composite} | rug ${rugReport.score} | ${passed ? '✓ PASS' : '✗ FAIL'}`
    );

    if (this.seen.size > 500) {
      const entries = [...this.seen];
      entries.slice(0, entries.length - 500).forEach(k => this.seen.delete(k));
    }
  }
}

if (process.argv[1]?.endsWith('risk-agent.ts') || process.argv[1]?.endsWith('risk-agent.js')) {
  const BROKER = process.env.FOXMQ_URL ?? 'mqtt://127.0.0.1:1883';
  const STELLAR = process.env.STELLAR_PUBLIC_KEY ?? undefined;
  const agent = new RiskAgent(STELLAR);
  await agent.connect(BROKER);

  process.on('SIGINT', async () => {
    await agent.disconnect();
    process.exit(0);
  });
}
