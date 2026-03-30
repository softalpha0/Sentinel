import { CONFIG } from './config.js';
import type { JupiterQuote, SwapResult } from './types.js';

const SOL_MINT = 'So11111111111111111111111111111111111111112';
// lite-api.jup.ag = free tier, no API key required
// api.jup.ag      = paid tier, requires Authorization header
const QUOTE_API = 'https://lite-api.jup.ag/swap/v1';

async function getQuote(inputMint: string, outputMint: string, amount: number): Promise<JupiterQuote> {
  const url =
    `${QUOTE_API}/quote` +
    `?inputMint=${inputMint}` +
    `&outputMint=${outputMint}` +
    `&amount=${Math.floor(amount)}` +
    `&slippageBps=${CONFIG.JUPITER_SLIPPAGE_BPS}` +
    `&onlyDirectRoutes=false` +
    `&restrictIntermediateTokens=true`;

  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  const data = await res.json() as JupiterQuote & { error?: string };
  if (!res.ok || data.error) throw new Error(`Jupiter quote: ${data.error ?? res.status}`);
  return data;
}

interface SwapResponse {
  swapTransaction: string;
  lastValidBlockHeight: number;
  error?: string;
}

async function executeSwap(quote: JupiterQuote, walletPublicKey: string): Promise<SwapResponse> {
  const res = await fetch(`https://lite-api.jup.ag/swap/v1/swap`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      quoteResponse: quote,
      userPublicKey: walletPublicKey,
      wrapAndUnwrapSol: true,
      dynamicComputeUnitLimit: true,
      prioritizationFeeLamports: 'auto',
    }),
  });
  const data = await res.json() as SwapResponse;
  if (!res.ok || !data.swapTransaction) throw new Error(`Jupiter swap: ${data.error ?? res.status}`);
  return data;
}

async function signAndSend(swapResp: SwapResponse): Promise<string> {
  const { Connection, Keypair, VersionedTransaction } = await import('@solana/web3.js');
  const bs58 = (await import('bs58')).default;

  const keypair = Keypair.fromSecretKey(bs58.decode(CONFIG.WALLET_PRIVATE_KEY));
  const connection = new Connection(CONFIG.SOLANA_RPC_URL, 'confirmed');

  const tx = VersionedTransaction.deserialize(Buffer.from(swapResp.swapTransaction, 'base64'));
  tx.sign([keypair]);

  // skipPreflight=true for speed — we rely on Jupiter's simulation
  const sig = await connection.sendRawTransaction(tx.serialize(), {
    skipPreflight: true,
    maxRetries: 2,
  });

  // Use blockhash-based confirmation — much more reliable than legacy timeout
  const { blockhash } = await connection.getLatestBlockhash('confirmed');
  try {
    await connection.confirmTransaction(
      { signature: sig, blockhash, lastValidBlockHeight: swapResp.lastValidBlockHeight },
      'confirmed',
    );
  } catch (e: unknown) {
    // If confirmation times out, check manually — the TX may have landed
    const status = await connection.getSignatureStatus(sig);
    const confirmed = status?.value?.confirmationStatus === 'confirmed'
      || status?.value?.confirmationStatus === 'finalized';
    if (!confirmed) {
      console.warn(`[Jupiter] TX ${sig.slice(0, 12)}… status unknown — verify on Solscan`);
      // Still return the sig — don't throw, so we don't double-buy
    }
  }

  console.log(`[Jupiter] TX confirmed: https://solscan.io/tx/${sig}`);
  return sig;
}

/**
 * Buy `tokenMint` using native SOL.
 */
export async function buyToken(tokenMint: string, solAmount: number): Promise<SwapResult> {
  const lamports = Math.floor(solAmount * 1e9);

  if (CONFIG.PAPER_TRADING) {
    console.log(`[PAPER] BUY ${solAmount} SOL → ${tokenMint}`);
    return { signature: 'PAPER_SIG', outAmount: lamports * 1000 };
  }

  const quote = await getQuote(SOL_MINT, tokenMint, lamports);
  const { Keypair } = await import('@solana/web3.js');
  const bs58 = (await import('bs58')).default;
  const keypair = Keypair.fromSecretKey(bs58.decode(CONFIG.WALLET_PRIVATE_KEY));

  const swapResp = await executeSwap(quote, keypair.publicKey.toString());
  const sig = await signAndSend(swapResp);
  return { signature: sig, outAmount: Number(quote.outAmount) };
}

/**
 * Sell `tokenAmount` raw token units back to SOL.
 */
export async function sellToken(tokenMint: string, tokenAmount: number): Promise<SwapResult> {
  if (CONFIG.PAPER_TRADING) {
    console.log(`[PAPER] SELL ${tokenAmount} tokens of ${tokenMint}`);
    return { signature: 'PAPER_SIG', outAmount: Math.floor(tokenAmount / 1000) };
  }

  const quote = await getQuote(tokenMint, SOL_MINT, tokenAmount);
  const { Keypair } = await import('@solana/web3.js');
  const bs58 = (await import('bs58')).default;
  const keypair = Keypair.fromSecretKey(bs58.decode(CONFIG.WALLET_PRIVATE_KEY));

  const swapResp = await executeSwap(quote, keypair.publicKey.toString());
  const sig = await signAndSend(swapResp);
  return { signature: sig, outAmount: Number(quote.outAmount) };
}
