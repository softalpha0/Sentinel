import { randomUUID } from 'crypto';

export interface MppSession {
  id: string;
  budgetUsdc: number;
  remainingUsdc: number;
  callCount: number;
  createdAt: number;
  payerTxHash: string;
}

const sessions = new Map<string, MppSession>();

setInterval(() => {
  const cutoff = Date.now() - 2 * 60 * 60 * 1000;
  for (const [id, s] of sessions) {
    if (s.createdAt < cutoff) sessions.delete(id);
  }
}, 15 * 60 * 1000).unref();

export function createSession(budgetUsdc: number, payerTxHash: string): MppSession {
  const session: MppSession = {
    id: randomUUID(),
    budgetUsdc,
    remainingUsdc: budgetUsdc,
    callCount: 0,
    createdAt: Date.now(),
    payerTxHash,
  };
  sessions.set(session.id, session);
  return session;
}

export function getSession(id: string): MppSession | undefined {
  return sessions.get(id);
}

export function deductFromSession(
  id: string,
  amountUsdc: number,
): { success: boolean; remaining: number; reason?: string } {
  const session = sessions.get(id);
  if (!session) return { success: false, remaining: 0, reason: 'Session not found or expired' };
  if (session.remainingUsdc < amountUsdc) {
    return {
      success: false,
      remaining: session.remainingUsdc,
      reason: `Insufficient session balance — ${session.remainingUsdc.toFixed(7)} USDC remaining, need ${amountUsdc}`,
    };
  }
  session.remainingUsdc = Math.round((session.remainingUsdc - amountUsdc) * 1e7) / 1e7;
  session.callCount++;
  return { success: true, remaining: session.remainingUsdc };
}

export function getActiveSessions(): number {
  return sessions.size;
}
