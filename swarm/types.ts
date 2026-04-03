import type { DexPair } from '../src/types.js';

export type AgentRole = 'scanner' | 'risk' | 'consensus' | 'execution';

// ── Discovery & heartbeat ────────────────────────────────────────────────────

export interface DiscoveryMsg {
  agentId: string;
  role: AgentRole;
  stellarAddress?: string; // Risk agents expose this so callers can pay
  timestamp: number;
}

export interface HeartbeatMsg {
  agentId: string;
  role: AgentRole;
  timestamp: number;
  stats?: Record<string, number>;
}

// ── Scanner → Risk ────────────────────────────────────────────────────────────

export interface CandidateMsg {
  requestId: string; // UUID — ties reports/decisions/execution together
  scannerAgentId: string;
  pair: DexPair;
  timestamp: number;
  // Stellar micropayment — scanner pays risk agents per analysis
  stellarTxHash?: string;   // present when STELLAR_SECRET_KEY is configured
  stellarFrom?: string;     // scanner's Stellar public key
}

// ── Risk → Consensus ─────────────────────────────────────────────────────────

export interface RiskReportMsg {
  requestId: string;
  riskAgentId: string;
  tokenAddress: string;
  symbol: string;
  passed: boolean;        // false = hard disqualified
  score: number;          // composite 0-100
  rugScore: number;       // raw rug score (lower = safer)
  breakdown: {
    age: number;
    volumeMcap: number;
    momentum: number;
    buyPressure: number;
    social: number;
    rugSafety: number;
  };
  pair: DexPair;          // forwarded so execution agent has full data
  timestamp: number;
}

// ── Consensus → Execution ─────────────────────────────────────────────────────

export interface ConsensusDecisionMsg {
  requestId: string;
  consensusAgentId: string;
  tokenAddress: string;
  symbol: string;
  decision: 'buy' | 'skip';
  score: number;
  rugScore: number;
  reason: string;
  pair: DexPair;
  timestamp: number;
}

// ── Execution → Swarm ─────────────────────────────────────────────────────────

export interface ExecutionConfirmMsg {
  requestId: string;
  executionAgentId: string;
  tokenAddress: string;
  symbol: string;
  action: 'bought' | 'skipped' | 'error';
  details?: string;
  timestamp: number;
}

// ── MQTT topic constants ──────────────────────────────────────────────────────

export const TOPICS = {
  DISCOVERY:  'swarm/discovery',
  HEARTBEAT:  'swarm/heartbeat',
  CANDIDATES: 'swarm/candidates',
  RISK:       'swarm/risk-reports',
  DECISION:   'swarm/consensus/decision',
  EXECUTION:  'swarm/execution/confirm',
} as const;
