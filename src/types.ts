export interface TxnWindow {
  buys: number;
  sells: number;
}

export interface DexPair {
  chainId: string;
  dexId: string;
  pairAddress: string;
  baseToken: { address: string; name: string; symbol: string };
  quoteToken: { address: string; name: string; symbol: string };
  priceNative: string;
  priceUsd: string | null;
  txns: { m5: TxnWindow; h1: TxnWindow; h6: TxnWindow; h24: TxnWindow };
  volume: { m5: number; h1: number; h6: number; h24: number };
  priceChange: { m5: number; h1: number; h6: number; h24: number } | null;
  liquidity: { usd: number; base: number; quote: number } | null;
  fdv: number | null;
  marketCap: number | null;
  pairCreatedAt: number | null;
  info?: {
    imageUrl?: string;
    websites?: { url: string }[];
    socials?: { type: string; url: string }[];
  };
  boosts?: { active: number };
}

export interface TokenProfile {
  tokenAddress: string;
  chainId: string;
  url?: string;
  description?: string;
  links?: { type: string; url: string }[];
}

export interface RugRisk {
  name: string;
  description: string;
  level: 'danger' | 'warn' | 'info';
  score: number;
}

export interface RugCheckReport {
  mint: string;
  score: number;
  score_normalised: number;
  rugged: boolean;
  risks: RugRisk[];
  mintAuthority: string | null;
  freezeAuthority: string | null;
  totalMarketLiquidity: number;
  topHolders: { address: string; pct: number; insider: boolean }[];
  totalHolders: number;
}

export interface TokenScore {
  tokenAddress: string;
  symbol: string;
  composite: number;
  breakdown: {
    age: number;
    volumeMcap: number;
    momentum: number;
    buyPressure: number;
    social: number;
    rugSafety: number;
  };
  pair: DexPair;
  rugReport: RugCheckReport;
}

export interface Position {
  id: string;
  tokenAddress: string;
  symbol: string;
  pairAddress: string;
  entryPrice: number;
  entryTime: number;
  solSpent: number;
  tokenAmount: number;
  takeProfit: number;
  stopLoss: number;
  status: 'open' | 'closed';
  closeReason?: 'TP' | 'SL' | 'MANUAL';
  closedAt?: number;
  exitPrice?: number;
  paperTrade: boolean;
}

export interface JupiterQuote {
  inputMint: string;
  inAmount: string;
  outputMint: string;
  outAmount: string;
  otherAmountThreshold: string;
  priceImpactPct: string;
  routePlan: unknown[];
  slippageBps: number;
}

export interface SwapResult {
  signature: string;
  outAmount: number;
}
