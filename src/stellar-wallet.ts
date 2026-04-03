import { Keypair, Asset, Horizon } from '@stellar/stellar-sdk';
import { CONFIG } from './config.js';

// USDC issuers (mainnet only — testnet uses native XLM for simplicity)
const USDC_ISSUER: Record<string, string> = {
  mainnet: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN',
};

const HORIZON_URL: Record<string, string> = {
  testnet: 'https://horizon-testnet.stellar.org',
  mainnet: 'https://horizon.stellar.org',
};

/** On testnet we use native XLM (no faucet needed). On mainnet we use USDC. */
export function getPaymentAsset(): Asset {
  if (CONFIG.STELLAR_NETWORK === 'mainnet') {
    return new Asset('USDC', USDC_ISSUER.mainnet);
  }
  return Asset.native(); // XLM
}

export function getPaymentAssetLabel(): string {
  return CONFIG.STELLAR_NETWORK === 'mainnet' ? 'USDC' : 'XLM';
}

export function getStellarKeypair(): Keypair {
  if (!CONFIG.STELLAR_SECRET_KEY) throw new Error('STELLAR_SECRET_KEY not set');
  return Keypair.fromSecret(CONFIG.STELLAR_SECRET_KEY);
}

export function getStellarPublicKey(): string {
  return getStellarKeypair().publicKey();
}

export function getHorizonServer(): Horizon.Server {
  const url = HORIZON_URL[CONFIG.STELLAR_NETWORK] ?? HORIZON_URL.testnet;
  return new Horizon.Server(url, { allowHttp: false });
}

export async function getPaymentBalance(): Promise<string> {
  const server = getHorizonServer();
  const account = await server.loadAccount(getStellarPublicKey());

  if (CONFIG.STELLAR_NETWORK !== 'mainnet') {
    // Return native XLM balance
    const xlm = account.balances.find(b => b.asset_type === 'native');
    return xlm?.balance ?? '0.0000000';
  }

  // Mainnet: return USDC balance
  const usdc = account.balances.find(
    b =>
      b.asset_type !== 'native' &&
      (b as Horizon.HorizonApi.BalanceLineAsset).asset_code === 'USDC' &&
      (b as Horizon.HorizonApi.BalanceLineAsset).asset_issuer === USDC_ISSUER.mainnet,
  ) as Horizon.HorizonApi.BalanceLineAsset | undefined;
  return usdc?.balance ?? '0.0000000';
}

// Keep old name as alias so api-server.ts doesn't break
export const getUsdcBalance = getPaymentBalance;

export interface PaymentVerification {
  valid: boolean;
  reason?: string;
  paidAmount?: string;
}

/**
 * Verifies a Stellar tx hash contains a payment of at least `minAmount`
 * in the correct asset (XLM on testnet, USDC on mainnet) to `expectedDestination`.
 */
export async function verifyPayment(
  txHash: string,
  minAmount: number,
  expectedDestination: string,
): Promise<PaymentVerification> {
  try {
    const server = getHorizonServer();
    const asset = getPaymentAsset();
    const isNative = asset.isNative();

    const paymentsPage = await server
      .payments()
      .forTransaction(txHash)
      .limit(20)
      .call();

    const records = paymentsPage.records as Horizon.HorizonApi.PaymentOperationResponse[];

    const match = records.find(op => {
      if (op.type !== 'payment') return false;
      if (op.to !== expectedDestination) return false;
      if (parseFloat(op.amount) < minAmount) return false;

      if (isNative) {
        return op.asset_type === 'native';
      }
      return (
        op.asset_code === 'USDC' &&
        op.asset_issuer === USDC_ISSUER.mainnet
      );
    });

    if (!match) {
      const label = getPaymentAssetLabel();
      return {
        valid: false,
        reason: `No ${label} payment >= ${minAmount} found to ${expectedDestination.slice(0, 8)}… in tx`,
      };
    }

    return { valid: true, paidAmount: match.amount };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { valid: false, reason: `Horizon lookup failed: ${msg}` };
  }
}
