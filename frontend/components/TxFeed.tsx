'use client';

import { useEffect, useState } from 'react';

interface Payment {
  id: string; amount: string; from: string; createdAt: string; txHash: string; network: string;
}

const short = (s: string) => `${s.slice(0, 6)}…${s.slice(-4)}`;
const timeAgo = (iso: string) => {
  const d = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (d < 60) return `${d}s ago`;
  if (d < 3600) return `${Math.floor(d / 60)}m ago`;
  return `${Math.floor(d / 3600)}h ago`;
};

export default function TxFeed({ publicKey, network }: { publicKey: string; network: string }) {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!publicKey) return;
    const base = network === 'mainnet' ? 'https://horizon.stellar.org' : 'https://horizon-testnet.stellar.org';

    async function load() {
      try {
        const res = await fetch(`${base}/accounts/${publicKey}/payments?order=desc&limit=10&include_failed=false`);
        if (!res.ok) return;
        const data = await res.json() as { _embedded: { records: Record<string, unknown>[] } };
        const incoming = (data._embedded?.records ?? [])
          .filter(r => r['type'] === 'payment' && r['to'] === publicKey)
          .map(r => ({
            id: String(r['id']),
            amount: parseFloat(String(r['amount'])).toFixed(4),
            from: String(r['from']),
            createdAt: String(r['created_at']),
            txHash: String(r['transaction_hash']),
            network,
          }));
        setPayments(incoming);
      } catch { /* ignore */ } finally {
        setLoading(false);
      }
    }

    load();
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, [publicKey, network]);

  const explorer = network === 'mainnet'
    ? 'https://stellar.expert/explorer/public/tx'
    : 'https://stellar.expert/explorer/testnet/tx';

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-medium text-zinc-500">Incoming payments</p>
        {!loading && (
          <span className="flex items-center gap-1.5 text-xs text-zinc-600">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Live
          </span>
        )}
      </div>

      {loading && (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-12 shimmer rounded-lg" />
          ))}
        </div>
      )}

      {!loading && payments.length === 0 && (
        <div className="py-12 text-center">
          <p className="text-sm text-zinc-600">No payments received yet</p>
          <p className="text-xs text-zinc-700 mt-1">Run the consumer agent to see transactions here</p>
        </div>
      )}

      {!loading && payments.length > 0 && (
        <div className="space-y-1.5">
          {payments.map(p => (
            <a
              key={p.id}
              href={`${explorer}/${p.txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-transparent hover:bg-zinc-900 hover:border-zinc-800 transition-all group"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-7 h-7 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                  <svg className="w-3 h-3 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-emerald-400 tabular-nums">+{p.amount} XLM</p>
                  <p className="text-xs text-zinc-600 truncate">from {short(p.from)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-zinc-600">{timeAgo(p.createdAt)}</span>
                <svg className="w-3 h-3 text-zinc-700 group-hover:text-zinc-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
