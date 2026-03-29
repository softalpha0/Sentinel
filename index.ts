import { Agent } from '@openserv-labs/sdk';
import { z } from 'zod';
import 'dotenv/config';

import { CONFIG } from './src/config.js';
import { findNewPairs, fetchPairPrice } from './src/dexscreener.js';
import { fetchRugReport } from './src/rugcheck.js';
import { scoreToken } from './src/scorer.js';
import { buyToken, sellToken } from './src/jupiter.js';
import { openPosition, closePosition, getOpenPositions, getAllPositions, startMonitor } from './src/positions.js';
import { sendAlert, fmtBuy } from './src/telegram.js';
import { startScanner } from './src/scanner.js';
import type { Position } from './src/types.js';

const agent = new Agent({
  apiKey: CONFIG.OPENSERV_API_KEY,
  port: 7378,
  systemPrompt: `You are Risk Sentinel — an autonomous Solana memecoin trading agent.

Your job:
1. Call scanForOpportunities to find fresh pairs with real momentum
2. Each candidate gets a rug check (via RugCheck.xyz) and a composite score (0-100)
3. Tokens scoring >= ${CONFIG.MIN_COMPOSITE_SCORE} with no rug flags are bought with ${CONFIG.MAX_BUY_SOL} SOL
4. Positions are monitored automatically: take profit at ${CONFIG.TAKE_PROFIT_X}x, stop loss at -${((1 - CONFIG.STOP_LOSS_FRACTION) * 100).toFixed(0)}%
5. Use getOpenPositions to check current holdings and unrealised P&L
6. Use closePosition to manually exit any trade

Always be strict — skip tokens with any doubt. Capital preservation comes first.
Paper trading mode: ${CONFIG.PAPER_TRADING}`,
});

// ── CAPABILITY 1: Manual scan trigger ─────────────────────────────────────────
agent.addCapability({
  name: 'scanForOpportunities',
  description:
    'Scans DexScreener for new Solana pairs, runs rug checks, scores each token, ' +
    'and automatically buys any that meet the threshold.',
  schema: z.object({
    dryRun: z
      .boolean()
      .optional()
      .describe('If true, analyse but do not execute buys (default: false)'),
  }),
  async run({ args }) {
    const dryRun = args.dryRun ?? false;
    console.log(`[Scan] Manual trigger — dryRun=${dryRun}`);

    const candidates = await findNewPairs();
    if (!candidates.length) return 'No pairs passed the initial filters right now. Try again shortly.';

    const report: Record<string, unknown>[] = [];

    for (const { profile, pair } of candidates) {
      const mint = profile.tokenAddress;
      const symbol = pair.baseToken.symbol;

      const rugReport = await fetchRugReport(mint).catch(() => null);
      if (!rugReport) {
        report.push({ symbol, address: mint, result: 'FAILED_RUG_CHECK' });
        continue;
      }

      const tokenScore = scoreToken(pair, rugReport);
      const entryPrice = pair.priceUsd ? parseFloat(pair.priceUsd) : 0;

      if (tokenScore.composite < CONFIG.MIN_COMPOSITE_SCORE || entryPrice === 0) {
        report.push({ symbol, address: mint, score: tokenScore.composite, result: 'SCORE_TOO_LOW' });
        continue;
      }

      const alreadyOpen = getOpenPositions().some(p => p.tokenAddress === mint);
      if (alreadyOpen) {
        report.push({ symbol, address: mint, score: tokenScore.composite, result: 'ALREADY_HOLDING' });
        continue;
      }

      if (getOpenPositions().length >= CONFIG.MAX_OPEN_POSITIONS) {
        report.push({ symbol, address: mint, score: tokenScore.composite, result: 'MAX_POSITIONS_REACHED' });
        continue;
      }

      if (dryRun) {
        report.push({ symbol, address: mint, score: tokenScore.composite, result: 'WOULD_BUY', price: entryPrice });
        continue;
      }

      try {
        const swapResult = await buyToken(mint, CONFIG.MAX_BUY_SOL);
        const posId = `${mint}-${Date.now()}`;
        const position: Position = {
          id: posId,
          tokenAddress: mint,
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
        sendAlert(fmtBuy(symbol, mint, entryPrice, CONFIG.MAX_BUY_SOL, tokenScore.composite,
          CONFIG.TAKE_PROFIT_X, CONFIG.STOP_LOSS_FRACTION, CONFIG.PAPER_TRADING));
        report.push({ symbol, address: mint, score: tokenScore.composite, result: 'BOUGHT', tx: swapResult.signature });
      } catch (e) {
        report.push({ symbol, address: mint, score: tokenScore.composite, result: 'BUY_FAILED', error: String(e) });
      }
    }

    return JSON.stringify(report, null, 2);
  },
});

// ── CAPABILITY 2: Open positions with live P&L ────────────────────────────────
agent.addCapability({
  name: 'getOpenPositions',
  description: 'Returns all open positions with live price and unrealised P&L.',
  schema: z.object({}),
  async run() {
    const open = getOpenPositions();
    if (!open.length) return 'No open positions.';

    const withPnl = await Promise.all(
      open.map(async pos => {
        const chain = CONFIG.TARGET_CHAIN;
        const currentPrice = await fetchPairPrice(chain, pos.pairAddress).catch(() => 0);
        const multiplier = currentPrice > 0 ? currentPrice / pos.entryPrice : null;
        const pnlPct = multiplier ? `${((multiplier - 1) * 100).toFixed(1)}%` : '?';
        return {
          symbol: pos.symbol,
          address: pos.tokenAddress,
          entryPrice: pos.entryPrice,
          currentPrice,
          multiplier: multiplier?.toFixed(2) ?? '?',
          pnlPct,
          tp: `${pos.takeProfit}x`,
          sl: `-${((1 - pos.stopLoss) * 100).toFixed(0)}%`,
          paper: pos.paperTrade,
          openFor: `${Math.round((Date.now() - pos.entryTime) / 60000)}m`,
        };
      }),
    );

    return JSON.stringify(withPnl, null, 2);
  },
});

// ── CAPABILITY 3: Manual close ────────────────────────────────────────────────
agent.addCapability({
  name: 'closePosition',
  description: 'Manually sells a token and closes the position.',
  schema: z.object({
    tokenAddress: z.string().describe('The token mint address to close'),
  }),
  async run({ args }) {
    const pos = getOpenPositions().find(p => p.tokenAddress === args.tokenAddress);
    if (!pos) return `No open position found for ${args.tokenAddress}`;

    let exitPrice = 0;
    try {
      exitPrice = await fetchPairPrice(CONFIG.TARGET_CHAIN, pos.pairAddress);
    } catch { /* proceed anyway */ }

    if (!pos.paperTrade && pos.tokenAmount > 0) {
      await sellToken(pos.tokenAddress, pos.tokenAmount).catch(e =>
        console.error(`[Close] Sell failed for ${pos.symbol}:`, e),
      );
    }

    closePosition(pos.id, 'MANUAL', exitPrice);
    return `Position closed for ${pos.symbol}. Exit price: $${exitPrice}.`;
  },
});

// ── CAPABILITY 4: Trade history ───────────────────────────────────────────────
agent.addCapability({
  name: 'getTradeHistory',
  description: 'Returns all closed positions with their final P&L.',
  schema: z.object({}),
  async run() {
    const closed = getAllPositions().filter(p => p.status === 'closed');
    if (!closed.length) return 'No closed trades yet.';

    const rows = closed.map(pos => ({
      symbol: pos.symbol,
      result: pos.closeReason,
      multiplier: pos.exitPrice ? (pos.exitPrice / pos.entryPrice).toFixed(2) + 'x' : '?',
      pnlPct: pos.exitPrice
        ? `${(((pos.exitPrice / pos.entryPrice) - 1) * 100).toFixed(1)}%`
        : '?',
      paper: pos.paperTrade,
      openFor: pos.closedAt ? `${Math.round((pos.closedAt - pos.entryTime) / 60000)}m` : '?',
    }));

    return JSON.stringify(rows, null, 2);
  },
});

// ── CAPABILITY 5: Analyse a specific token ────────────────────────────────────
agent.addCapability({
  name: 'analyseToken',
  description: 'Run a full rug check and score on any Solana token address.',
  schema: z.object({
    tokenAddress: z.string().describe('Solana token mint address'),
  }),
  async run({ args }) {
    const { fetchTokenPairs } = await import('./src/dexscreener.js');
    const [rugReport, pairs] = await Promise.all([
      fetchRugReport(args.tokenAddress),
      fetchTokenPairs(CONFIG.TARGET_CHAIN, args.tokenAddress).catch(() => []),
    ]);

    if (!rugReport) {
      return JSON.stringify({ address: args.tokenAddress, result: 'FAILED_RUG_CHECK', reason: 'Mint/freeze authority not revoked, already rugged, or score too high.' });
    }

    if (!pairs.length) {
      return JSON.stringify({ address: args.tokenAddress, rugScore: rugReport.score, result: 'NO_PAIRS_FOUND' });
    }

    const bestPair = pairs.sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))[0];
    const tokenScore = scoreToken(bestPair, rugReport);

    return JSON.stringify({
      address: args.tokenAddress,
      symbol: bestPair.baseToken.symbol,
      rugScore: rugReport.score,
      rugNormalised: rugReport.score_normalised,
      compositeScore: tokenScore.composite,
      breakdown: tokenScore.breakdown,
      recommendation: tokenScore.composite >= CONFIG.MIN_COMPOSITE_SCORE ? 'BUY' : 'SKIP',
      pair: {
        priceUsd: bestPair.priceUsd,
        liquidity: bestPair.liquidity?.usd,
        volume1h: bestPair.volume?.h1,
        priceChange1h: bestPair.priceChange?.h1,
        buys1h: bestPair.txns?.h1?.buys,
        sells1h: bestPair.txns?.h1?.sells,
        marketCap: bestPair.marketCap ?? bestPair.fdv,
        ageMinutes: bestPair.pairCreatedAt ? Math.round((Date.now() - bestPair.pairCreatedAt) / 60000) : null,
      },
    }, null, 2);
  },
});

// ── Start autonomous loops ────────────────────────────────────────────────────
startMonitor();
startScanner();

agent.start();
console.log(`
🛰️  RISK SENTINEL ONLINE
   Paper mode : ${CONFIG.PAPER_TRADING}
   Chain      : ${CONFIG.TARGET_CHAIN}
   Max buy    : ${CONFIG.MAX_BUY_SOL} SOL
   TP / SL    : ${CONFIG.TAKE_PROFIT_X}x / -${((1 - CONFIG.STOP_LOSS_FRACTION) * 100).toFixed(0)}%
   Min score  : ${CONFIG.MIN_COMPOSITE_SCORE}/100
   Port       : 7378
`);
