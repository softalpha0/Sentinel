export const CONFIG = {
  OPENSERV_API_KEY: process.env.OPENSERV_API_KEY_SENTINEL ?? '',
  OPENSERV_AUTH_TOKEN: process.env.OPENSERV_AUTH_TOKEN ?? '',

  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN ?? '',
  TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID ?? '',

  SOLANA_RPC_URL: (process.env.SOLANA_RPC_URL ?? 'https://api.mainnet-beta.solana.com').trim(),
  WALLET_PRIVATE_KEY: (process.env.WALLET_PRIVATE_KEY ?? '').trim().replace(/['"]/g, ''),

  RUGCHECK_API_KEY: process.env.RUGCHECK_API_KEY ?? '',

  JUPITER_SLIPPAGE_BPS: Number(process.env.JUPITER_SLIPPAGE_BPS ?? '1000'),

  PAPER_TRADING: process.env.PAPER_TRADING !== 'false',

  SCAN_INTERVAL_MS: Number(process.env.SCAN_INTERVAL_MS ?? '60000'),
  MONITOR_INTERVAL_MS: Number(process.env.MONITOR_INTERVAL_MS ?? '15000'),
  MAX_PAIR_AGE_MS: Number(process.env.MAX_PAIR_AGE_MS ?? '14400000'),
  MIN_LIQUIDITY_USD: Number(process.env.MIN_LIQUIDITY_USD ?? '10000'),
  MIN_VOLUME_H1_USD: Number(process.env.MIN_VOLUME_H1_USD ?? '20000'),
  MIN_BUY_RATIO: Number(process.env.MIN_BUY_RATIO ?? '0.50'),
  MAX_MARKET_CAP: Number(process.env.MAX_MARKET_CAP ?? '300000'),

  MAX_BUY_SOL: Number(process.env.MAX_BUY_SOL ?? '0.05'),
  MIN_COMPOSITE_SCORE: Number(process.env.MIN_COMPOSITE_SCORE ?? '60'),
  MAX_RUG_SCORE: Number(process.env.MAX_RUG_SCORE ?? '600'),
  TAKE_PROFIT_X: Number(process.env.TAKE_PROFIT_X ?? '2.0'),
  STOP_LOSS_FRACTION: Number(process.env.STOP_LOSS_FRACTION ?? '0.80'),
  MAX_OPEN_POSITIONS: Number(process.env.MAX_OPEN_POSITIONS ?? '2'),

  TARGET_CHAIN: process.env.TARGET_CHAIN ?? 'solana',

  STELLAR_SECRET_KEY: (process.env.STELLAR_SECRET_KEY ?? '').trim(),
  STELLAR_NETWORK: (process.env.STELLAR_NETWORK ?? 'testnet') as 'testnet' | 'mainnet',
  STELLAR_API_PORT: Number(process.env.STELLAR_API_PORT ?? '7379'),
} as const;
