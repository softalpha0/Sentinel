/**
 * consumer-agent.ts
 *
 * Demo consumer agent that autonomously:
 *  1. Discovers trending Solana tokens from DexScreener (free)
 *  2. Calls Risk Sentinel's paid x402 API to rug-check and score each token
 *  3. Pays USDC on Stellar testnet per API call — no API key, no subscription
 *
 * Usage:
 *   CONSUMER_STELLAR_SECRET=S... SENTINEL_API_URL=http://localhost:7379 \
 *     node --import tsx/esm consumer-agent.ts
 */

import 'dotenv/config';
import {
  Keypair,
  Asset,
  TransactionBuilder,
  Networks,
  Operation,
  Memo,
  Horizon,
} from '@stellar/stellar-sdk';

// ── Config ────────────────────────────────────────────────────────────────────

const STELLAR_SECRET = (process.env.CONSUMER_STELLAR_SECRET ?? '').trim();
const SENTINEL_API   = (process.env.SENTINEL_API_URL ?? 'http://localhost:7379').replace(/\/$/, '');
const STELLAR_NET    = (process.env.STELLAR_NETWORK ?? 'testnet') as 'testnet' | 'mainnet';
const DEXSCREENER    = 'https://api.dexscreener.com';
const MAX_TOKENS     = Number(process.env.MAX_TOKENS ?? '5'); // limit per run for demo

const HORIZON_URL = STELLAR_NET === 'mainnet'
  ? 'https://horizon.stellar.org'
  : 'https://horizon-testnet.stellar.org';

const NETWORK_PASSPHRASE = STELLAR_NET === 'mainnet'
  ? Networks.PUBLIC
  : Networks.TESTNET;

const USDC_ISSUER_MAINNET = 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN';

// Testnet → use native XLM (no faucet needed, both wallets have 10k XLM)
// Mainnet → use USDC
const PAYMENT_ASSET = STELLAR_NET === 'mainnet'
  ? new Asset('USDC', USDC_ISSUER_MAINNET)
  : Asset.native();
const ASSET_LABEL = STELLAR_NET === 'mainnet' ? 'USDC' : 'XLM';

if (!STELLAR_SECRET) {
  console.error('Set CONSUMER_STELLAR_SECRET to a Stellar secret key (S...)');
  process.exit(1);
}

const keypair = Keypair.fromSecret(STELLAR_SECRET);
const server  = new Horizon.Server(HORIZON_URL, { allowHttp: false });

// ── Stellar helpers ───────────────────────────────────────────────────────────

async function sendPayment(destination: string, amount: string, memo: string): Promise<string> {
  const account = await server.loadAccount(keypair.publicKey());
  const fee     = await server.fetchBaseFee();

  const tx = new TransactionBuilder(account, {
    fee: String(fee),
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      Operation.payment({
        destination,
        asset: PAYMENT_ASSET,
        amount,
      }),
    )
    .addMemo(Memo.text(memo.slice(0, 28)))
    .setTimeout(30)
    .build();

  tx.sign(keypair);
  const result = await server.submitTransaction(tx);
  return result.hash;
}

// ── x402 fetch helper ─────────────────────────────────────────────────────────

interface X402PaymentDetails {
  payTo: string;
  maxAmountRequired: string;
}

async function fetchPaid(url: string): Promise<unknown> {
  // Step 1: probe the endpoint
  const probe = await fetch(url);

  if (probe.status !== 402) {
    // Free or error
    return probe.json();
  }

  const body = await probe.json() as { x402: X402PaymentDetails };
  const { payTo, maxAmountRequired } = body.x402;

  console.log(`  [x402] 402 received — paying ${maxAmountRequired} ${ASSET_LABEL} to ${payTo.slice(0, 8)}…`);

  // Step 2: pay on Stellar
  const memo   = url.split('/').pop()?.split('?')[0] ?? 'api';
  const txHash = await sendPayment(payTo, maxAmountRequired, memo);
  console.log(`  [x402] Payment sent — tx: ${txHash.slice(0, 12)}…`);

  // Step 3: retry with payment proof
  const retry = await fetch(url, {
    headers: { 'X-Payment': txHash },
  });

  if (!retry.ok) {
    const err = await retry.json();
    throw new Error(`API error after payment: ${JSON.stringify(err)}`);
  }

  return retry.json();
}

// ── DexScreener discovery (free) ──────────────────────────────────────────────

interface TokenProfile { tokenAddress: string; chainId: string }

async function discoverSolanaTokens(limit: number): Promise<string[]> {
  const res  = await fetch(`${DEXSCREENER}/token-profiles/latest/v1`);
  const data = await res.json() as TokenProfile[];
  return data
    .filter(t => t.chainId === 'solana')
    .slice(0, limit)
    .map(t => t.tokenAddress);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function run() {
  console.log(`\n🤖  CONSUMER AGENT`);
  console.log(`   Wallet  : ${keypair.publicKey()}`);
  console.log(`   Network : ${STELLAR_NET}`);
  console.log(`   API     : ${SENTINEL_API}\n`);

  // Check payment asset balance
  const account = await server.loadAccount(keypair.publicKey());
  const bal = STELLAR_NET === 'mainnet'
    ? (account.balances as Horizon.HorizonApi.BalanceLineAsset[]).find(b => b.asset_code === 'USDC' && b.asset_issuer === USDC_ISSUER_MAINNET)?.balance ?? '0'
    : account.balances.find(b => b.asset_type === 'native')?.balance ?? '0';
  console.log(`   ${ASSET_LABEL} balance: ${bal}\n`);

  // Discover tokens
  console.log(`[Discovery] Fetching latest Solana tokens from DexScreener…`);
  const tokens = await discoverSolanaTokens(MAX_TOKENS);
  console.log(`[Discovery] Found ${tokens.length} tokens to evaluate\n`);

  const buySignals: string[] = [];

  for (const token of tokens) {
    console.log(`\n[Token] ${token.slice(0, 8)}…`);

    try {
      // Rug check — 0.02 USDC
      const rugUrl = `${SENTINEL_API}/rug-check?token=${token}`;
      const rug = await fetchPaid(rugUrl) as { passed: boolean; rugScore?: number; reason?: string };

      if (!rug.passed) {
        console.log(`  → RUG FAILED (${rug.reason ?? 'filtered'})`);
        continue;
      }
      console.log(`  → Rug check PASSED (score: ${rug.rugScore})`);

      // Score — 0.01 USDC
      const scoreUrl = `${SENTINEL_API}/score?token=${token}`;
      const scored = await fetchPaid(scoreUrl) as {
        symbol?: string;
        compositeScore?: number;
        recommendation?: string;
        passed?: boolean;
        reason?: string;
      };

      if (!scored.compositeScore) {
        console.log(`  → No score available (${scored.reason ?? 'unknown'})`);
        continue;
      }

      console.log(`  → ${scored.symbol} — score ${scored.compositeScore}/100 — ${scored.recommendation}`);

      if (scored.recommendation === 'BUY') {
        buySignals.push(`${scored.symbol} (${token.slice(0, 8)}…) — score ${scored.compositeScore}`);
      }
    } catch (e: unknown) {
      console.error(`  → Error: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  console.log(`\n${'─'.repeat(50)}`);
  console.log(`BUY SIGNALS (${buySignals.length}/${tokens.length} evaluated):`);
  if (buySignals.length) {
    buySignals.forEach(s => console.log(`  ✓ ${s}`));
  } else {
    console.log('  None — all tokens filtered out');
  }

  // Show final balance
  const finalAccount = await server.loadAccount(keypair.publicKey());
  const finalBal = STELLAR_NET === 'mainnet'
    ? (finalAccount.balances as Horizon.HorizonApi.BalanceLineAsset[]).find(b => b.asset_code === 'USDC' && b.asset_issuer === USDC_ISSUER_MAINNET)?.balance ?? '0'
    : finalAccount.balances.find(b => b.asset_type === 'native')?.balance ?? '0';
  console.log(`\n   ${ASSET_LABEL} balance after: ${finalBal}`);
  console.log(`${'─'.repeat(50)}\n`);
}

run().catch(e => {
  console.error('Consumer agent error:', e);
  process.exit(1);
});
