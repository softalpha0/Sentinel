'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import TxFeed from '@/components/TxFeed';

interface BalanceData { publicKey: string; usdcBalance: string; network: string }
interface StatsData {
  totalCalls: number; totalEarnedUsdc: number;
  callCounts: { rugCheck: number; score: number; scan: number; mpp: number };
  activeMppSessions: number; startedAt: string;
}

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`shimmer rounded ${className}`} />;
}

function StatCard({ label, value, sub, online }: { label: string; value: string; sub?: string; online?: boolean }) {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-zinc-500 font-medium">{label}</p>
        {online !== undefined && (
          <span className={`w-1.5 h-1.5 rounded-full ${online ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-600'}`} />
        )}
      </div>
      <p className="text-2xl font-semibold text-white tabular-nums">{value}</p>
      {sub && <p className="text-xs text-zinc-600 mt-1">{sub}</p>}
    </div>
  );
}

export default function Dashboard() {
  const [balance, setBalance] = useState<BalanceData | null>(null);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [b, s] = await Promise.all([
          fetch('/api/proxy/balance').then(r => r.ok ? r.json() : Promise.reject()),
          fetch('/api/proxy/stats').then(r => r.ok ? r.json() : Promise.reject()),
        ]);
        setBalance(b as BalanceData);
        setStats(s as StatsData);
        setError(false);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    }
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, []);

  function uptime(iso?: string) {
    if (!iso) return '—';
    const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
    if (s < 60) return `${s}s`;
    if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`;
    return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
  }

  const online = !error && !loading;

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="sticky top-0 z-40 h-12 border-b border-zinc-900 bg-black/80 backdrop-blur-xl flex items-center px-5">
        <div className="flex items-center gap-2 text-sm">
          <Link href="/" className="text-zinc-500 hover:text-white transition-colors">Risk Sentinel</Link>
          <span className="text-zinc-800">/</span>
          <span className="text-white">Dashboard</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className={`w-1.5 h-1.5 rounded-full ${online ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-700'}`} />
          <span className="text-xs text-zinc-500">{online ? 'Live' : loading ? 'Connecting…' : 'Offline'}</span>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-5 py-8 space-y-6">

        {/* Error banner */}
        {error && (
          <div className="card border-red-500/20 bg-red-500/5 p-4 text-sm text-red-400">
            Cannot reach Risk Sentinel API. Run{' '}
            <code className="bg-red-500/10 px-1 rounded">npm run dev</code>{' '}
            in the project root first.
          </div>
        )}

        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)
          ) : (
            <>
              <StatCard
                label="Wallet balance"
                value={balance ? `${parseFloat(balance.usdcBalance).toFixed(4)}` : '—'}
                sub={`${balance?.network ?? 'testnet'} · XLM`}
                online={online}
              />
              <StatCard
                label="Total earned"
                value={stats ? `${stats.totalEarnedUsdc.toFixed(4)} XLM` : '—'}
                sub="This session"
              />
              <StatCard
                label="API calls"
                value={stats?.totalCalls.toLocaleString() ?? '—'}
                sub={`${stats?.activeMppSessions ?? 0} active MPP sessions`}
              />
              <StatCard
                label="Uptime"
                value={uptime(stats?.startedAt)}
                sub="Since last restart"
              />
            </>
          )}
        </div>

        {/* Endpoint breakdown */}
        {stats && (
          <div className="card p-5">
            <p className="text-xs font-medium text-zinc-500 mb-4">Calls by endpoint</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { path: '/rug-check', count: stats.callCounts.rugCheck, price: '0.02 XLM' },
                { path: '/score',     count: stats.callCounts.score,    price: '0.01 XLM' },
                { path: '/scan',      count: stats.callCounts.scan,     price: '0.05 XLM' },
                { path: 'MPP calls',  count: stats.callCounts.mpp,     price: 'session' },
              ].map(ep => (
                <div key={ep.path} className="bg-zinc-900/60 border border-zinc-800 rounded-lg px-4 py-3">
                  <p className="text-xs font-mono text-zinc-500 mb-1.5 truncate">{ep.path}</p>
                  <p className="text-xl font-semibold text-white tabular-nums">{ep.count}</p>
                  <p className="text-xs text-zinc-600 mt-0.5">{ep.price} each</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Main grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <TxFeed
            publicKey={balance?.publicKey ?? ''}
            network={balance?.network ?? 'testnet'}
          />

          {/* Wallet */}
          <div className="card p-5 space-y-5">
            <p className="text-xs font-medium text-zinc-500">Producer Wallet</p>

            {loading ? (
              <div className="space-y-3">
                <Skeleton className="h-8" />
                <Skeleton className="h-6 w-24" />
              </div>
            ) : balance ? (
              <>
                <div>
                  <p className="text-xs text-zinc-600 mb-1.5">Public key</p>
                  <code className="text-xs text-zinc-300 bg-zinc-900 border border-zinc-800 px-3 py-2 rounded-lg block break-all leading-relaxed">
                    {balance.publicKey}
                  </code>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-3">
                    <p className="text-xs text-zinc-600 mb-1">Balance</p>
                    <p className="text-sm font-semibold text-white tabular-nums">
                      {parseFloat(balance.usdcBalance).toFixed(4)} XLM
                    </p>
                  </div>
                  <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-3">
                    <p className="text-xs text-zinc-600 mb-1">Network</p>
                    <p className="text-sm font-semibold text-white capitalize">{balance.network}</p>
                  </div>
                </div>

                <a
                  href={`https://stellar.expert/explorer/${balance.network}/account/${balance.publicKey}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs text-sky-400 hover:text-sky-300 transition-colors"
                >
                  View on Stellar Expert
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              </>
            ) : null}
          </div>
        </div>

        {/* API reference */}
        <div className="card p-5">
          <p className="text-xs font-medium text-zinc-500 mb-4">API Reference</p>
          <div className="space-y-1 font-mono text-xs">
            {[
              { method: 'GET',  path: '/health',          auth: 'free',         desc: 'API status + pricing' },
              { method: 'GET',  path: '/balance',         auth: 'free',         desc: 'Wallet balance' },
              { method: 'GET',  path: '/stats',           auth: 'free',         desc: 'Call counts + earnings' },
              { method: 'GET',  path: '/rug-check',       auth: '0.02 XLM',     desc: 'Rug safety analysis' },
              { method: 'GET',  path: '/score',           auth: '0.01 XLM',     desc: 'Composite 0–100 score' },
              { method: 'GET',  path: '/scan',            auth: '0.05 XLM',     desc: 'Full market scan' },
              { method: 'POST', path: '/mpp/session',     auth: 'budget XLM',   desc: 'Open MPP session' },
            ].map(ep => (
              <div key={ep.path} className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-zinc-900 transition-colors">
                <span className="w-8 text-zinc-600 shrink-0">{ep.method}</span>
                <span className="text-zinc-300 flex-1">{ep.path}</span>
                <span className={`shrink-0 ${ep.auth === 'free' ? 'text-zinc-600' : 'text-emerald-400'}`}>{ep.auth}</span>
                <span className="text-zinc-600 hidden sm:block shrink-0">{ep.desc}</span>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
