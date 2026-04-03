import { AgentBase } from './agent-base.js';
import { TOPICS } from './types.js';
import type { RiskReportMsg, ConsensusDecisionMsg } from './types.js';
import { CONFIG } from '../src/config.js';

// How long to wait for additional risk agents to respond before deciding
const QUORUM_WINDOW_MS = 8_000;

interface PendingQuorum {
  reports: RiskReportMsg[];
  timer: ReturnType<typeof setTimeout>;
}

export class ConsensusAgent extends AgentBase {
  // requestId → accumulated risk reports from multiple risk agents
  private quorum = new Map<string, PendingQuorum>();
  private decidedCount = 0;
  private buyCount = 0;

  constructor() {
    super('consensus');
  }

  protected async subscribeToTopics(): Promise<void> {
    await this.client.subscribeAsync(TOPICS.RISK, { qos: 1 });
    console.log(`[${this.agentId}] Subscribed to ${TOPICS.RISK}`);
  }

  protected handleMessage(topic: string, msg: unknown): void {
    if (topic === TOPICS.RISK) {
      this.handleRiskReport(msg as RiskReportMsg);
    }
  }

  protected getStats(): Record<string, number> {
    return { decided: this.decidedCount, bought: this.buyCount, pending: this.quorum.size };
  }

  // ── Risk report handling ──────────────────────────────────────────────────

  private handleRiskReport(report: RiskReportMsg): void {
    const { requestId } = report;

    if (!this.quorum.has(requestId)) {
      // First report for this requestId — open a quorum window
      const timer = setTimeout(() => this.decide(requestId), QUORUM_WINDOW_MS);
      this.quorum.set(requestId, { reports: [report], timer });
      console.log(`[${this.agentId}] Quorum opened for ${report.symbol} (req ${requestId.slice(0, 8)})`);
    } else {
      // Additional risk agents responding — accumulate
      const q = this.quorum.get(requestId)!;
      // Avoid duplicates from the same risk agent
      if (!q.reports.find(r => r.riskAgentId === report.riskAgentId)) {
        q.reports.push(report);
        console.log(`[${this.agentId}] +1 report for ${report.symbol} (${q.reports.length} total)`);
      }
    }
  }

  // ── Decision ──────────────────────────────────────────────────────────────

  private async decide(requestId: string): Promise<void> {
    const q = this.quorum.get(requestId);
    if (!q) return;
    this.quorum.delete(requestId);

    const { reports } = q;
    if (reports.length === 0) return;

    const symbol = reports[0].symbol;
    const pair   = reports[0].pair;

    // Any hard fail → skip immediately (Byzantine: one bad report is enough to block)
    const hardFail = reports.find(r => !r.passed);
    if (hardFail) {
      await this.publishDecision({
        requestId,
        tokenAddress: reports[0].tokenAddress,
        symbol,
        decision: 'skip',
        score: hardFail.score,
        rugScore: hardFail.rugScore,
        reason: 'Hard disqualified by risk agent',
        pair,
      });
      return;
    }

    // Average composite score across all passing reports
    const avgScore  = reports.reduce((s, r) => s + r.score, 0) / reports.length;
    const avgRug    = reports.reduce((s, r) => s + r.rugScore, 0) / reports.length;

    // Simple majority vote: buy if score threshold met
    const buyVotes  = reports.filter(r => r.score >= CONFIG.MIN_COMPOSITE_SCORE).length;
    const majority  = buyVotes > reports.length / 2;

    const decision: 'buy' | 'skip' = majority ? 'buy' : 'skip';
    const reason = majority
      ? `${buyVotes}/${reports.length} risk agents voted buy (avg score ${avgScore.toFixed(1)})`
      : `Insufficient votes (${buyVotes}/${reports.length}), avg score ${avgScore.toFixed(1)}`;

    await this.publishDecision({
      requestId,
      tokenAddress: reports[0].tokenAddress,
      symbol,
      decision,
      score: Math.round(avgScore),
      rugScore: Math.round(avgRug),
      reason,
      pair,
    });
  }

  private async publishDecision(fields: Omit<ConsensusDecisionMsg, 'consensusAgentId' | 'timestamp'>): Promise<void> {
    const msg: ConsensusDecisionMsg = {
      ...fields,
      consensusAgentId: this.agentId,
      timestamp: Date.now(),
    };

    await this.publish(TOPICS.DECISION, msg);
    this.decidedCount++;
    if (msg.decision === 'buy') this.buyCount++;

    console.log(
      `[${this.agentId}] Decision: ${msg.decision.toUpperCase()} ${msg.symbol} | score ${msg.score} | ${msg.reason}`
    );
  }
}

// ── Entrypoint ────────────────────────────────────────────────────────────────

if (process.argv[1]?.endsWith('consensus-agent.ts') || process.argv[1]?.endsWith('consensus-agent.js')) {
  const BROKER = process.env.FOXMQ_URL ?? 'mqtt://127.0.0.1:1883';
  const agent = new ConsensusAgent();
  await agent.connect(BROKER);

  process.on('SIGINT', async () => {
    await agent.disconnect();
    process.exit(0);
  });
}
