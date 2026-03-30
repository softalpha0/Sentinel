import type { TokenProfile, DexPair } from './types.js';
import { CONFIG } from './config.js';

const BASE = 'https://api.dexscreener.com';

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

async function get<T>(path: string, retries = 3): Promise<T> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(`${BASE}${path}`, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(10_000), // 10s timeout per request
      });
      if (!res.ok) throw new Error(`DexScreener ${path} → ${res.status}`);
      return res.json() as Promise<T>;
    } catch (e) {
      if (attempt === retries) throw e;
      const backoff = attempt * 2000; // 2s, 4s
      console.warn(`[DexScreener] Attempt ${attempt} failed, retrying in ${backoff / 1000}s…`);
      await sleep(backoff);
    }
  }
  throw new Error('DexScreener: all retries exhausted');
}

export async function fetchLatestProfiles(): Promise<TokenProfile[]> {
  const data = await get<TokenProfile[]>('/token-profiles/latest/v1');
  return Array.isArray(data) ? data : [];
}

export async function fetchTokenPairs(chain: string, tokenAddress: string): Promise<DexPair[]> {
  const data = await get<{ pairs: DexPair[] | null }>(`/latest/dex/tokens/${tokenAddress}`);
  return (data.pairs ?? []).filter(p => p.chainId === chain);
}

export async function fetchPairPrice(chain: string, pairAddress: string): Promise<number> {
  const data = await get<{ pairs: DexPair[] | null }>(`/latest/dex/pairs/${chain}/${pairAddress}`);
  const pair = (data.pairs ?? [])[0];
  return pair?.priceUsd ? parseFloat(pair.priceUsd) : 0;
}

export async function findNewPairs(chain = CONFIG.TARGET_CHAIN): Promise<{ profile: TokenProfile; pair: DexPair }[]> {
  const profiles = await fetchLatestProfiles();
  const chainProfiles = profiles.filter(p => p.chainId === chain);
  const now = Date.now();
  const results: { profile: TokenProfile; pair: DexPair }[] = [];

  for (const profile of chainProfiles.slice(0, 30)) {
    let pairs: DexPair[];
    try {
      pairs = await fetchTokenPairs(chain, profile.tokenAddress);
    } catch {
      continue;
    }

    if (!pairs.length) continue;

    // Pick the pair with highest liquidity
    const pair = pairs.sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))[0];
    if (!pair) continue;

    const ageMs = pair.pairCreatedAt ? now - pair.pairCreatedAt : Infinity;
    const liq = pair.liquidity?.usd ?? 0;
    const volH1 = pair.volume?.h1 ?? 0;
    const buysH1 = pair.txns?.h1?.buys ?? 0;
    const sellsH1 = pair.txns?.h1?.sells ?? 0;
    const buyRatio = (buysH1 + sellsH1) > 0 ? buysH1 / (buysH1 + sellsH1) : 0;
    const mcap = pair.marketCap ?? pair.fdv ?? 0;

    const symbol = pair.baseToken?.symbol ?? profile.tokenAddress.slice(0, 8);
    const ageMin = Math.round(ageMs / 60000);

    if (ageMs > CONFIG.MAX_PAIR_AGE_MS) {
      console.log(`  ✗ ${symbol} — too old (${ageMin}m)`); continue;
    }
    if (liq < CONFIG.MIN_LIQUIDITY_USD) {
      console.log(`  ✗ ${symbol} — low liq ($${Math.round(liq).toLocaleString()})`); continue;
    }
    if (volH1 < CONFIG.MIN_VOLUME_H1_USD) {
      console.log(`  ✗ ${symbol} — low vol ($${Math.round(volH1).toLocaleString()}/h)`); continue;
    }
    if (buyRatio < CONFIG.MIN_BUY_RATIO) {
      console.log(`  ✗ ${symbol} — weak buys (${(buyRatio * 100).toFixed(0)}%)`); continue;
    }
    if (mcap > CONFIG.MAX_MARKET_CAP) {
      console.log(`  ✗ ${symbol} — mcap too high ($${Math.round(mcap).toLocaleString()})`); continue;
    }

    console.log(`  ✓ ${symbol} — age ${ageMin}m | liq $${Math.round(liq).toLocaleString()} | vol $${Math.round(volH1).toLocaleString()}/h | buys ${(buyRatio * 100).toFixed(0)}% | mcap $${Math.round(mcap).toLocaleString()}`);
    results.push({ profile, pair });
  }

  return results;
}
