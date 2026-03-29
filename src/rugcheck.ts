import type { RugCheckReport } from './types.js';
import { CONFIG } from './config.js';

const BASE = 'https://api.rugcheck.xyz/v1';

// pump.fun bonding curve program — retains mint authority by design while in curve.
// This is safe: the authority belongs to the public program, not a private wallet.
const PUMP_FUN_PROGRAM = '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBymtzbF';
// pump.fun AMM (post-graduation)
const PUMP_FUN_AMM = 'pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA';

// Known safe program-owned authorities (DEX programs, launchpads)
const SAFE_AUTHORITIES = new Set([PUMP_FUN_PROGRAM, PUMP_FUN_AMM]);

// Known pump.fun holder addresses — bonding curve holds unsold supply, not a whale wallet
const PUMP_FUN_HOLDERS = new Set([
  PUMP_FUN_PROGRAM,
  PUMP_FUN_AMM,
  'Ce6TQqeHC9p8KetsN6JsjHK7UTZk7nasjjnr7XxXp9F1', // pump.fun fee account
]);

type FailReason =
  | 'ALREADY_RUGGED'
  | 'UNSAFE_MINT_AUTHORITY'
  | 'UNSAFE_FREEZE_AUTHORITY'
  | 'RUG_SCORE_TOO_HIGH'
  | 'TOP_HOLDER_CONCENTRATION'
  | 'DANGER_RISK_FLAG'
  | null;

function disqualify(mint: string, reason: FailReason, detail?: string): null {
  console.log(`[RugCheck] ✗ ${mint.slice(0, 8)}… — ${reason}${detail ? ` (${detail})` : ''}`);
  return null;
}

/**
 * Returns null if the token is a hard disqualification.
 * Returns the RugCheck report if the token passes all checks.
 */
export async function fetchRugReport(mint: string): Promise<RugCheckReport | null> {
  let data: RugCheckReport;
  try {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (CONFIG.RUGCHECK_API_KEY) headers['X-API-KEY'] = CONFIG.RUGCHECK_API_KEY;

    const res = await fetch(`${BASE}/tokens/${mint}/report`, { headers });
    if (!res.ok) {
      console.warn(`[RugCheck] API error ${res.status} for ${mint.slice(0, 8)}…`);
      return null;
    }
    data = await res.json() as RugCheckReport;
  } catch (e) {
    console.warn(`[RugCheck] Network error for ${mint.slice(0, 8)}…:`, e);
    return null;
  }

  // Already confirmed rug
  if (data.rugged) {
    return disqualify(mint, 'ALREADY_RUGGED');
  }

  // Mint authority: allow null (revoked) OR a known safe launchpad program
  if (data.mintAuthority !== null && !SAFE_AUTHORITIES.has(data.mintAuthority)) {
    return disqualify(mint, 'UNSAFE_MINT_AUTHORITY', `authority=${data.mintAuthority.slice(0, 8)}…`);
  }

  // Freeze authority: same logic
  if (data.freezeAuthority !== null && !SAFE_AUTHORITIES.has(data.freezeAuthority)) {
    return disqualify(mint, 'UNSAFE_FREEZE_AUTHORITY', `authority=${data.freezeAuthority.slice(0, 8)}…`);
  }

  // Overall risk score ceiling
  if (data.score > CONFIG.MAX_RUG_SCORE) {
    return disqualify(mint, 'RUG_SCORE_TOO_HIGH', `score=${data.score}`);
  }

  // Top holder wallet concentration check.
  // Allows: insider-flagged accounts (LP/DEX), known pump.fun program addresses.
  // Threshold: 25% — pump.fun bonding curve legitimately holds unsold supply,
  // and RugCheck doesn't always flag it as `insider`.
  const top = data.topHolders?.[0];
  const topIsSafeProgram = top && PUMP_FUN_HOLDERS.has(top.address);
  if (top && top.pct > 25 && !top.insider && !topIsSafeProgram) {
    return disqualify(mint, 'TOP_HOLDER_CONCENTRATION', `top holder ${top.pct.toFixed(1)}%`);
  }

  // Any DANGER-level risk flag
  const dangerRisk = data.risks?.find(r => r.level === 'danger');
  if (dangerRisk) {
    return disqualify(mint, 'DANGER_RISK_FLAG', dangerRisk.name);
  }

  console.log(`[RugCheck] ✓ ${mint.slice(0, 8)}… passed — score ${data.score} (normalised ${data.score_normalised})`);
  return data;
}

export function rugSafetyScore(report: RugCheckReport): number {
  // Invert normalised score: 100 = safest, 0 = most dangerous
  return Math.max(0, 100 - (report.score_normalised ?? 50));
}
