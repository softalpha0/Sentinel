import { CONFIG } from './config.js';
import { findNewPairs } from './dexscreener.js';
import { fetchRugReport } from './rugcheck.js';
import { scoreToken } from './scorer.js';
import { buyToken } from './jupiter.js';
import { openPosition, getOpenPositions } from './positions.js';
import { sendAlert, fmtBuy } from './telegram.js';
import type { Position } from './types.js';

let scanCount = 0;

async function runScanCycle(): Promise<void> {
  scanCount++;
  console.log(`\n[Scanner] Cycle #${scanCount} — ${new Date().toISOString()}`);

  let candidates: Awaited<ReturnType<typeof findNewPairs>>;
  try {
    candidates = await findNewPairs();
  } catch (e) {
    console.error('[Scanner] DexScreener fetch failed:', e);
    return;
  }

  console.log(`[Scanner] ${candidates.length} pairs passed initial filters.`);
  if (!candidates.length) return;

  for (const { profile, pair } of candidates) {
    const mint = profile.tokenAddress;
    const symbol = pair.baseToken.symbol;

    // Don't re-enter an already open position
    const alreadyOpen = getOpenPositions().some(p => p.tokenAddress === mint);
    if (alreadyOpen) {
      console.log(`[Scanner] Already holding ${symbol}, skipping.`);
      continue;
    }

    // Enforce max open positions
    if (getOpenPositions().length >= CONFIG.MAX_OPEN_POSITIONS) {
      console.log('[Scanner] Max positions reached, pausing scout.');
      break;
    }

    // RugCheck — sequential to respect rate limits
    console.log(`[Scanner] RugCheck: ${symbol} (${mint})`);
    const rugReport = await fetchRugReport(mint);
    if (!rugReport) {
      console.log(`[Scanner] ${symbol} — FAILED rug check, skipped.`);
      await sleep(1000);
      continue;
    }

    // Score
    const tokenScore = scoreToken(pair, rugReport);
    console.log(`[Scanner] ${symbol} score: ${tokenScore.composite}/100`);

    if (tokenScore.composite < CONFIG.MIN_COMPOSITE_SCORE) {
      console.log(`[Scanner] ${symbol} — score too low (${tokenScore.composite}), skipped.`);
      await sleep(1000);
      continue;
    }

    // Execute buy
    const entryPrice = pair.priceUsd ? parseFloat(pair.priceUsd) : 0;
    if (entryPrice === 0) {
      console.log(`[Scanner] ${symbol} — no USD price available, skipped.`);
      continue;
    }

    console.log(`[Scanner] ${symbol} — BUYING at $${entryPrice} (score ${tokenScore.composite})`);

    let swapResult: { signature: string; outAmount: number };
    try {
      swapResult = await buyToken(mint, CONFIG.MAX_BUY_SOL);
    } catch (e) {
      console.error(`[Scanner] Buy failed for ${symbol}:`, e);
      sendAlert(`❌ Buy failed for <b>${symbol}</b>\n<code>${e instanceof Error ? e.message : String(e)}</code>`);
      continue;
    }

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
    sendAlert(
      fmtBuy(symbol, mint, entryPrice, CONFIG.MAX_BUY_SOL, tokenScore.composite,
        CONFIG.TAKE_PROFIT_X, CONFIG.STOP_LOSS_FRACTION, CONFIG.PAPER_TRADING)
    );

    // Heartbeat every 5 cycles
    if (scanCount % 5 === 0) {
      const open = getOpenPositions();
      sendAlert(`📡 Sentinel heartbeat #${scanCount}\nOpen positions: ${open.length}/${CONFIG.MAX_OPEN_POSITIONS}\nPaper mode: ${CONFIG.PAPER_TRADING}`);
    }

    await sleep(1000);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

export function startScanner(): NodeJS.Timeout {
  console.log(`[Scanner] Auto-scan started — every ${CONFIG.SCAN_INTERVAL_MS / 1000}s`);
  runScanCycle().catch(e => console.error('[Scanner] Initial cycle error:', e));
  return setInterval(() => {
    runScanCycle().catch(e => console.error('[Scanner] Cycle error:', e));
  }, CONFIG.SCAN_INTERVAL_MS);
}
