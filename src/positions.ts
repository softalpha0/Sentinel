import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Position } from './types.js';
import { CONFIG } from './config.js';
import { sendAlert, fmtSell } from './telegram.js';
import { fetchPairPrice } from './dexscreener.js';
import { sellToken } from './jupiter.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STORE_PATH = path.join(__dirname, '..', 'positions.json');

const store = new Map<string, Position>();

// Tracks positions currently being closed — prevents double-trigger race condition
const closing = new Set<string>();

function persist(): void {
  const data = JSON.stringify(Array.from(store.values()), null, 2);
  fs.writeFileSync(STORE_PATH, data, 'utf8');
}

function load(): void {
  if (!fs.existsSync(STORE_PATH)) return;
  try {
    const raw = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8')) as Position[];
    for (const pos of raw) store.set(pos.id, pos);
    console.log(`[Positions] Loaded ${store.size} positions from disk.`);
  } catch {
    console.warn('[Positions] Could not load positions.json — starting fresh.');
  }
}

load();

export function getOpenPositions(): Position[] {
  return Array.from(store.values()).filter(p => p.status === 'open');
}

export function getAllPositions(): Position[] {
  return Array.from(store.values());
}

export function openPosition(pos: Position): void {
  store.set(pos.id, pos);
  persist();
}

export function closePosition(
  id: string,
  reason: 'TP' | 'SL' | 'MANUAL',
  exitPrice: number,
): void {
  const pos = store.get(id);
  if (!pos || pos.status === 'closed') return;
  pos.status = 'closed';
  pos.closeReason = reason;
  pos.closedAt = Date.now();
  pos.exitPrice = exitPrice;
  persist();
  closing.delete(id);
  sendAlert(fmtSell(pos.symbol, pos.tokenAddress, reason, pos.entryPrice, exitPrice, pos.paperTrade));
}

async function executeClose(pos: Position, reason: 'TP' | 'SL', currentPrice: number): Promise<void> {
  // Guard: skip if already closing or closed
  if (closing.has(pos.id) || pos.status === 'closed') return;
  closing.add(pos.id);

  const label = reason === 'TP' ? 'TP' : 'SL';
  console.log(`[Monitor] ${label} hit: ${pos.symbol} at ${(currentPrice / pos.entryPrice).toFixed(2)}x`);

  if (!pos.paperTrade && pos.tokenAmount > 0) {
    await sellToken(pos.tokenAddress, pos.tokenAmount).catch(e =>
      console.error(`[Monitor] Sell failed for ${pos.symbol}:`, e),
    );
  }

  closePosition(pos.id, reason, currentPrice);
}

export function startMonitor(): NodeJS.Timeout {
  console.log(`[Monitor] TP/SL monitor started — checking every ${CONFIG.MONITOR_INTERVAL_MS / 1000}s`);

  let running = false;

  return setInterval(async () => {
    // Skip if previous interval hasn't finished — prevents overlapping runs
    if (running) return;
    running = true;

    try {
      const open = getOpenPositions();
      if (!open.length) return;

      for (const pos of open) {
        if (closing.has(pos.id)) continue; // already being closed

        let currentPrice = 0;
        try {
          const chain = pos.tokenAddress.startsWith('0x') ? 'ethereum' : 'solana';
          currentPrice = await fetchPairPrice(chain, pos.pairAddress);
        } catch {
          // Network blip — skip this tick, try again next interval
          continue;
        }

        if (currentPrice === 0) continue;

        const multiplier = currentPrice / pos.entryPrice;

        if (multiplier >= pos.takeProfit) {
          await executeClose(pos, 'TP', currentPrice);
        } else if (multiplier <= pos.stopLoss) {
          await executeClose(pos, 'SL', currentPrice);
        } else {
          console.log(`[Monitor] ${pos.symbol}: ${multiplier.toFixed(2)}x (TP: ${pos.takeProfit}x | SL: ${pos.stopLoss.toFixed(2)}x)`);
        }
      }
    } finally {
      running = false;
    }
  }, CONFIG.MONITOR_INTERVAL_MS);
}
