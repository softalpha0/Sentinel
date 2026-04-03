import type { Request, Response, NextFunction } from 'express';
import { getStellarPublicKey, verifyPayment, getPaymentAssetLabel } from './stellar-wallet.js';
import { deductFromSession } from './mpp-sessions.js';
import { CONFIG } from './config.js';

// Prevent replay: track consumed tx hashes with a timestamp
const usedTxHashes = new Map<string, number>();

// Prune hashes older than 10 minutes every 5 minutes
setInterval(() => {
  const cutoff = Date.now() - 10 * 60 * 1000;
  for (const [hash, ts] of usedTxHashes) {
    if (ts < cutoff) usedTxHashes.delete(hash);
  }
}, 5 * 60 * 1000).unref();

// Call stats — imported by api-server for the /stats endpoint
export const callStats = {
  total: 0,
  totalEarnedUsdc: 0,
  byEndpoint: {} as Record<string, number>,
  mppCalls: 0,
};

function recordCall(endpoint: string, amountUsdc: number) {
  callStats.total++;
  callStats.totalEarnedUsdc = Math.round((callStats.totalEarnedUsdc + amountUsdc) * 1e7) / 1e7;
  callStats.byEndpoint[endpoint] = (callStats.byEndpoint[endpoint] ?? 0) + 1;
}

/**
 * Express middleware implementing x402 + MPP pay-per-request on Stellar.
 *
 * Auth priority:
 *  1. X-MPP-Session: <sessionId>  → deduct from pre-paid session (MPP)
 *  2. X-Payment: <txHash>         → verify Stellar tx (x402)
 *  3. Neither                     → return 402 with both payment options
 */
export function x402Gate(priceUsdc: number) {
  const network = CONFIG.STELLAR_NETWORK === 'mainnet' ? 'stellar-mainnet' : 'stellar-testnet';

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const mppSession = (req.headers['x-mpp-session'] as string | undefined)?.trim();
    const paymentHeader = (req.headers['x-payment'] as string | undefined)?.trim();
    const endpoint = req.path.replace(/\//g, '').split('?')[0];

    // ── MPP session path ──────────────────────────────────────────────────────
    if (mppSession) {
      const result = deductFromSession(mppSession, priceUsdc);
      if (!result.success) {
        res.status(402).json({
          error: result.reason,
          remaining: result.remaining,
          code: 'SESSION_DEPLETED',
        });
        return;
      }
      callStats.mppCalls++;
      recordCall(endpoint, priceUsdc);
      console.log(`[MPP]  ✓ ${priceUsdc} USDC — session ${mppSession.slice(0, 8)}… — remaining ${result.remaining} → ${req.path}`);
      next();
      return;
    }

    // ── x402 per-request path ─────────────────────────────────────────────────
    if (!paymentHeader) {
      const destination = getStellarPublicKey();
      const asset = getPaymentAssetLabel();
      res.status(402).json({
        error: 'Payment Required',
        x402: {
          version: 1,
          scheme: 'exact',
          network,
          maxAmountRequired: priceUsdc.toFixed(7),
          asset,
          payTo: destination,
          description: `Risk Sentinel Intelligence API — ${req.method} ${req.path}`,
          instructions: [
            `Option A (x402): Send ${priceUsdc} ${asset} to ${destination} on ${network}, retry with X-Payment: <txHash>`,
            `Option B (MPP): POST /mpp/session with budgetUsdc + txHash, use X-MPP-Session: <sessionId> for bulk calls`,
          ],
        },
      });
      return;
    }

    // Replay check
    if (usedTxHashes.has(paymentHeader)) {
      res.status(402).json({ error: 'Payment already used', code: 'REPLAY_DETECTED' });
      return;
    }

    const destination = getStellarPublicKey();
    const result = await verifyPayment(paymentHeader, priceUsdc, destination);

    if (!result.valid) {
      res.status(402).json({
        error: 'Payment verification failed',
        reason: result.reason,
        code: 'PAYMENT_INVALID',
      });
      return;
    }

    usedTxHashes.set(paymentHeader, Date.now());
    recordCall(endpoint, priceUsdc);
    console.log(`[x402] ✓ ${priceUsdc} USDC — tx ${paymentHeader.slice(0, 12)}… → ${req.path}`);
    next();
  };
}
