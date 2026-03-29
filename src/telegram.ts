import { CONFIG } from './config.js';

export function sendAlert(message: string): void {
  const { TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID } = CONFIG;
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return;

  fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: TELEGRAM_CHAT_ID,
      text: message,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    }),
  }).catch(e => console.error('[Telegram] Failed to send alert:', e));
}

export function fmtBuy(
  symbol: string,
  address: string,
  entryPrice: number,
  solSpent: number,
  score: number,
  tpX: number,
  slFraction: number,
  paper: boolean,
): string {
  return (
    `🚀 <b>BUY${paper ? ' [PAPER]' : ''}</b> — <b>${symbol}</b>\n` +
    `<code>${address}</code>\n\n` +
    `Entry: $${entryPrice.toFixed(8)}\n` +
    `SOL spent: ${solSpent}\n` +
    `Score: ${score}/100\n` +
    `TP: ${tpX}x | SL: -${((1 - slFraction) * 100).toFixed(0)}%`
  );
}

export function fmtSell(
  symbol: string,
  address: string,
  reason: 'TP' | 'SL' | 'MANUAL',
  entryPrice: number,
  exitPrice: number,
  paper: boolean,
): string {
  const multiplier = exitPrice / entryPrice;
  const pnl = ((multiplier - 1) * 100).toFixed(1);
  const emoji = reason === 'TP' ? '💰' : reason === 'SL' ? '🛑' : '📤';
  return (
    `${emoji} <b>${reason}${paper ? ' [PAPER]' : ''}</b> — <b>${symbol}</b>\n` +
    `<code>${address}</code>\n\n` +
    `Entry: $${entryPrice.toFixed(8)}\n` +
    `Exit: $${exitPrice.toFixed(8)}\n` +
    `Result: ${multiplier.toFixed(2)}x (${pnl}%)`
  );
}
