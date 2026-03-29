import type { DexPair, RugCheckReport, TokenScore } from './types.js';
import { CONFIG } from './config.js';
import { rugSafetyScore } from './rugcheck.js';

function clamp(val: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, val));
}

export function scoreToken(pair: DexPair, report: RugCheckReport): TokenScore {
  const now = Date.now();
  const ageMs = pair.pairCreatedAt ? now - pair.pairCreatedAt : CONFIG.MAX_PAIR_AGE_MS;
  const mcap = pair.marketCap ?? pair.fdv ?? 1;

  // Age: fresh pairs score higher (15% weight)
  const agePct = 1 - ageMs / CONFIG.MAX_PAIR_AGE_MS;
  const age = clamp(agePct * 100);

  // Volume/MCap ratio: high activity relative to size (25% weight)
  const volH1 = pair.volume?.h1 ?? 0;
  const volumeMcap = clamp((volH1 / mcap) * 100);

  // Price momentum: weighted average of m5 and h1 change (20% weight)
  const changeM5 = pair.priceChange?.m5 ?? 0;
  const changeH1 = pair.priceChange?.h1 ?? 0;
  const combinedChange = changeM5 * 0.6 + changeH1 * 0.4;
  const momentum = clamp(50 + combinedChange); // 50 = flat baseline

  // Buy pressure: fraction of buys in last hour (25% weight)
  const buys = pair.txns?.h1?.buys ?? 0;
  const sells = pair.txns?.h1?.sells ?? 0;
  const total = buys + sells;
  const buyPressure = clamp(total > 0 ? (buys / total) * 100 : 50);

  // Social signals: website + socials presence (5% weight)
  const hasWebsite = (pair.info?.websites?.length ?? 0) > 0 ? 50 : 0;
  const hasSocial = (pair.info?.socials?.length ?? 0) > 0 ? 50 : 0;
  const social = clamp(hasWebsite + hasSocial);

  // Rug safety score (10% weight)
  const rugSafety = rugSafetyScore(report);

  const composite = Math.round(
    age * 0.15 +
    volumeMcap * 0.25 +
    momentum * 0.20 +
    buyPressure * 0.25 +
    social * 0.05 +
    rugSafety * 0.10
  );

  return {
    tokenAddress: pair.baseToken.address,
    symbol: pair.baseToken.symbol,
    composite,
    breakdown: { age, volumeMcap, momentum, buyPressure, social, rugSafety },
    pair,
    rugReport: report,
  };
}
