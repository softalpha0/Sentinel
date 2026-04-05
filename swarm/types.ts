import type { DexPair } from '../src/types.js';

export type AgentRole = 'scanner' | 'risk' | 'consensus' | 'execution';

export interface DiscoveryMsg {
  agentId: string;
  role: AgentRole;
  stellarAddress?: string;
  timestamp: number;
}

export interface HeartbeatMsg {
  agentId: string;
  role: AgentRole;
  timestamp: number;
  stats?: Record<string, number>;
}

export interface CandidateMsg {
  requestId: string;
  scannerAgentId: string;
  pair: DexPair;
  timestamp: number;
  stellarTxHash?: string;
  stellarFrom?: string;
}

export interface RiskReportMsg {
  requestId: string;
  riskAgentId: string;
  tokenAddress: string;
  symbol: string;
  passed: boolean;
  score: number;
  rugScore: number;
  breakdown: {
    age: number;
    volumeMcap: number;
    momentum: number;
    buyPressure: number;
    social: number;
    rugSafety: number;
  };
  pair: DexPair;
  timestamp: number;
}

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

export interface ExecutionConfirmMsg {
  requestId: string;
  executionAgentId: string;
  tokenAddress: string;
  symbol: string;
  action: 'bought' | 'skipped' | 'error';
  details?: string;
  timestamp: number;
}

export const TOPICS = {
  DISCOVERY:  'swarm/discovery',
  HEARTBEAT:  'swarm/heartbeat',
  CANDIDATES: 'swarm/candidates',
  RISK:       'swarm/risk-reports',
  DECISION:   'swarm/consensus/decision',
  EXECUTION:  'swarm/execution/confirm',
} as const;
