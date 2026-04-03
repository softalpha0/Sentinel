import 'dotenv/config';
import express from 'express';
import { CONFIG } from './config.js';
import { fetchRugReport } from './rugcheck.js';
import { scoreToken } from './scorer.js';
import { fetchTokenPairs, findNewPairs } from './dexscreener.js';
import { x402Gate, callStats } from './x402-middleware.js';
import { getStellarPublicKey, getUsdcBalance, verifyPayment } from './stellar-wallet.js';
import { createSession, getActiveSessions } from './mpp-sessions.js';

const SERVER_STARTED_AT = new Date().toISOString();

// Pricing per endpoint in USDC
export const PRICES = {
  rugCheck: 0.02,
  score: 0.01,
  scan: 0.05,
} as const;

export function createApiServer() {
  const app = express();
  const network = CONFIG.STELLAR_NETWORK === 'mainnet' ? 'stellar-mainnet' : 'stellar-testnet';

  // ── Free: discovery ───────────────────────────────────────────────────────────

  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'Risk Sentinel Intelligence API',
      version: '1.0.0',
      payment: {
        protocol: 'x402',
        network,
        asset: 'USDC',
        payTo: getStellarPublicKey(),
      },
      endpoints: {
        'GET /rug-check?token=<address>': `${PRICES.rugCheck} USDC`,
        'GET /score?token=<address>': `${PRICES.score} USDC`,
        'GET /scan': `${PRICES.scan} USDC`,
      },
    });
  });

  app.get('/balance', async (_req, res) => {
    try {
      const balance = await getUsdcBalance();
      res.json({
        publicKey: getStellarPublicKey(),
        usdcBalance: balance,
        network,
      });
    } catch (e: unknown) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.get('/stats', (_req, res) => {
    res.json({
      totalCalls: callStats.total,
      totalEarnedUsdc: callStats.totalEarnedUsdc,
      callCounts: {
        rugCheck: callStats.byEndpoint['rug-check'] ?? 0,
        score: callStats.byEndpoint['score'] ?? 0,
        scan: callStats.byEndpoint['scan'] ?? 0,
        mpp: callStats.mppCalls,
      },
      activeMppSessions: getActiveSessions(),
      startedAt: SERVER_STARTED_AT,
    });
  });

  // ── MPP: create session ───────────────────────────────────────────────────────

  app.post('/mpp/session', express.json(), async (req, res) => {
    const { budgetUsdc, txHash } = req.body as { budgetUsdc?: number; txHash?: string };

    if (!budgetUsdc || budgetUsdc < 0.1) {
      res.status(400).json({ error: 'budgetUsdc must be >= 0.1 USDC' });
      return;
    }
    if (!txHash) {
      res.status(400).json({ error: 'txHash required — pay budgetUsdc USDC to the producer on Stellar first' });
      return;
    }

    const destination = getStellarPublicKey();
    const verification = await verifyPayment(txHash, budgetUsdc, destination);

    if (!verification.valid) {
      res.status(402).json({
        error: 'Session payment verification failed',
        reason: verification.reason,
        payTo: destination,
        budgetRequired: budgetUsdc,
        network,
      });
      return;
    }

    const session = createSession(budgetUsdc, txHash);
    console.log(`[MPP]  Session created — id ${session.id.slice(0, 8)}… budget ${budgetUsdc} USDC`);

    res.status(201).json({
      sessionId: session.id,
      budgetUsdc: session.budgetUsdc,
      remainingUsdc: session.remainingUsdc,
      createdAt: new Date(session.createdAt).toISOString(),
      instructions: 'Use X-MPP-Session: <sessionId> header on paid endpoints instead of X-Payment',
    });
  });

  // ── Paid: rug check — 0.02 USDC ──────────────────────────────────────────────

  app.get('/rug-check', x402Gate(PRICES.rugCheck), async (req, res) => {
    const token = req.query.token as string | undefined;
    if (!token) {
      res.status(400).json({ error: 'Missing ?token=<solana-address>' });
      return;
    }

    const report = await fetchRugReport(token).catch(() => null);
    if (!report) {
      res.json({
        token,
        passed: false,
        reason: 'Failed one or more hard disqualifiers (mint/freeze authority, rug score, holder concentration, or DANGER flag)',
      });
      return;
    }

    res.json({
      token,
      passed: true,
      rugScore: report.score,
      rugScoreNormalised: report.score_normalised,
      rugged: report.rugged,
      mintAuthority: report.mintAuthority,
      freezeAuthority: report.freezeAuthority,
      topHolder: report.topHolders?.[0]
        ? { address: report.topHolders[0].address, pct: report.topHolders[0].pct }
        : null,
      risks: report.risks?.filter(r => r.level === 'danger' || r.level === 'warn') ?? [],
      totalHolders: report.totalHolders,
    });
  });

  // ── Paid: composite score — 0.01 USDC ────────────────────────────────────────

  app.get('/score', x402Gate(PRICES.score), async (req, res) => {
    const token = req.query.token as string | undefined;
    if (!token) {
      res.status(400).json({ error: 'Missing ?token=<solana-address>' });
      return;
    }

    const [rugReport, pairs] = await Promise.all([
      fetchRugReport(token).catch(() => null),
      fetchTokenPairs(CONFIG.TARGET_CHAIN, token).catch(() => []),
    ]);

    if (!rugReport) {
      res.json({ token, passed: false, reason: 'Failed rug check' });
      return;
    }

    if (!pairs.length) {
      res.json({ token, rugPassed: true, reason: 'No trading pairs found on ' + CONFIG.TARGET_CHAIN });
      return;
    }

    const best = [...pairs].sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))[0];
    const score = scoreToken(best, rugReport);

    res.json({
      token,
      symbol: best.baseToken.symbol,
      compositeScore: score.composite,
      recommendation: score.composite >= CONFIG.MIN_COMPOSITE_SCORE ? 'BUY' : 'SKIP',
      breakdown: score.breakdown,
      pair: {
        priceUsd: best.priceUsd,
        liquidityUsd: best.liquidity?.usd,
        volumeH1: best.volume?.h1,
        priceChangeH1: best.priceChange?.h1,
        buysH1: best.txns?.h1?.buys,
        sellsH1: best.txns?.h1?.sells,
        marketCap: best.marketCap ?? best.fdv,
        ageMinutes: best.pairCreatedAt
          ? Math.round((Date.now() - best.pairCreatedAt) / 60000)
          : null,
      },
    });
  });

  // ── Paid: full scan — 0.05 USDC ──────────────────────────────────────────────

  app.get('/scan', x402Gate(PRICES.scan), async (_req, res) => {
    const candidates = await findNewPairs().catch(() => []);

    if (!candidates.length) {
      res.json({ scannedAt: new Date().toISOString(), totalScanned: 0, results: [] });
      return;
    }

    const results = await Promise.all(
      candidates.slice(0, 15).map(async ({ profile, pair }) => {
        const token = profile.tokenAddress;
        const symbol = pair.baseToken.symbol;
        const rugReport = await fetchRugReport(token).catch(() => null);
        if (!rugReport) return { token, symbol, result: 'RUG_FAILED' };
        const score = scoreToken(pair, rugReport);
        return {
          token,
          symbol,
          compositeScore: score.composite,
          recommendation: score.composite >= CONFIG.MIN_COMPOSITE_SCORE ? 'BUY' : 'SKIP',
          priceUsd: pair.priceUsd,
          liquidityUsd: pair.liquidity?.usd,
          volumeH1: pair.volume?.h1,
          ageMinutes: pair.pairCreatedAt
            ? Math.round((Date.now() - pair.pairCreatedAt) / 60000)
            : null,
        };
      }),
    );

    const buys = results.filter(r => 'recommendation' in r && r.recommendation === 'BUY').length;

    res.json({
      scannedAt: new Date().toISOString(),
      totalScanned: results.length,
      buySignals: buys,
      results,
    });
  });

  return app;
}

export function startApiServer(): void {
  const app = createApiServer();
  const port = Number(process.env.PORT) || CONFIG.STELLAR_API_PORT;

  app.listen(port, () => {
    console.log(`\n💳  x402 INTELLIGENCE API ONLINE`);
    console.log(`   Port    : ${port}`);
    console.log(`   Network : ${CONFIG.STELLAR_NETWORK}`);
    console.log(`   Pay to  : ${getStellarPublicKey()}`);
    console.log(`   Prices  : /rug-check $${PRICES.rugCheck} | /score $${PRICES.score} | /scan $${PRICES.scan} (USDC)\n`);
  });
}

// Standalone entrypoint — runs when executed directly (e.g. Railway)
if (process.argv[1]?.endsWith('api-server.ts') || process.argv[1]?.endsWith('api-server.js')) {
  startApiServer();
}
