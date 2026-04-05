import {
  Keypair,
  TransactionBuilder,
  Networks,
  Operation,
  Memo,
  BASE_FEE,
  Asset,
  Horizon,
} from '@stellar/stellar-sdk';
import { CONFIG } from '../src/config.js';
import { getPaymentAsset, getPaymentAssetLabel, verifyPayment } from '../src/stellar-wallet.js';

export const ANALYSIS_PRICE_XLM  = '0.1';
export const ANALYSIS_PRICE_USDC = '0.01';

const HORIZON_URL: Record<string, string> = {
  testnet: 'https://horizon-testnet.stellar.org',
  mainnet: 'https://horizon.stellar.org',
};

const NETWORK_PASSPHRASE: Record<string, string> = {
  testnet: Networks.TESTNET,
  mainnet: Networks.PUBLIC,
};

function getServer(): Horizon.Server {
  return new Horizon.Server(HORIZON_URL[CONFIG.STELLAR_NETWORK] ?? HORIZON_URL.testnet);
}

function getPrice(): string {
  return CONFIG.STELLAR_NETWORK === 'mainnet' ? ANALYSIS_PRICE_USDC : ANALYSIS_PRICE_XLM;
}

export async function payForAnalysis(
  toAddress: string,
  memo = 'risk-analysis',
): Promise<string | null> {
  if (!CONFIG.STELLAR_SECRET_KEY) return null;

  const keypair  = Keypair.fromSecret(CONFIG.STELLAR_SECRET_KEY);
  const server   = getServer();
  const asset    = getPaymentAsset();
  const price    = getPrice();
  const network  = NETWORK_PASSPHRASE[CONFIG.STELLAR_NETWORK] ?? Networks.TESTNET;

  try {
    const account = await server.loadAccount(keypair.publicKey());

    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: network,
    })
      .addOperation(
        Operation.payment({
          destination: toAddress,
          asset,
          amount: price,
        }),
      )
      .addMemo(Memo.text(memo.slice(0, 28)))
      .setTimeout(30)
      .build();

    tx.sign(keypair);
    const result = await server.submitTransaction(tx);
    const hash = result.hash;

    console.log(
      `[Payment] Sent ${price} ${getPaymentAssetLabel()} → ${toAddress.slice(0, 8)}… | tx ${hash.slice(0, 12)}…`,
    );
    return hash;
  } catch (e) {
    console.warn(`[Payment] Stellar payment failed:`, e);
    return null;
  }
}

export async function verifyAnalysisPayment(
  txHash: string,
  myAddress: string,
): Promise<boolean> {
  const asset  = getPaymentAsset();
  const price  = parseFloat(getPrice());

  if (!myAddress) return true;

  const result = await verifyPayment(txHash, price, myAddress);
  if (!result.valid) {
    console.warn(`[Payment] Invalid payment: ${result.reason}`);
  }
  return result.valid;
}

export function formatPrice(): string {
  return `${getPrice()} ${getPaymentAssetLabel()}`;
}
