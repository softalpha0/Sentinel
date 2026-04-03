'use client';

import { useEffect, useState } from 'react';

interface Data {
  totalCalls: number;
  totalEarnedUsdc: number;
  usdcBalance: string;
  uptime: string;
}

export default function LiveCounter() {
  const [data, setData] = useState<Data | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [s, b] = await Promise.all([
          fetch('/api/proxy/stats').then(r => r.json()),
          fetch('/api/proxy/balance').then(r => r.json()),
        ]);
        const startedAt = (s as { startedAt?: string }).startedAt;
        const uptimeSecs = startedAt ? Math.round((Date.now() - new Date(startedAt).getTime()) / 1000) : 0;
        const uptime = !startedAt ? '—' : uptimeSecs < 60 ? `${uptimeSecs}s` : uptimeSecs < 3600 ? `${Math.floor(uptimeSecs / 60)}m` : `${Math.floor(uptimeSecs / 3600)}h`;
        setData({
          totalCalls: (s as { totalCalls: number }).totalCalls,
          totalEarnedUsdc: (s as { totalEarnedUsdc: number }).totalEarnedUsdc,
          usdcBalance: (b as { usdcBalance: string }).usdcBalance,
          uptime,
        });
      } catch { /* offline */ }
    }
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, []);

  const items = [
    { label: 'API calls', value: data?.totalCalls?.toLocaleString() ?? '—' },
    { label: 'Earned', value: data?.totalEarnedUsdc != null ? `${parseFloat(String(data.totalEarnedUsdc)).toFixed(4)} XLM` : '—' },
    { label: 'Wallet balance', value: data?.usdcBalance != null ? `${parseFloat(data.usdcBalance).toFixed(2)} XLM` : '—' },
    { label: 'Uptime', value: data?.uptime ?? '—' },
  ];

  return (
    <div className="mt-16 flex items-center justify-center gap-px flex-wrap">
      <div className="flex items-center gap-1.5 text-xs text-emerald-400 pr-6 border-r border-zinc-800">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        Live · Stellar Testnet
      </div>
      {items.map((item, i) => (
        <div
          key={item.label}
          className={`px-6 text-center ${i < items.length - 1 ? 'border-r border-zinc-800' : ''}`}
        >
          <div className="text-sm font-semibold text-white tabular-nums">{item.value}</div>
          <div className="text-xs text-zinc-500 mt-0.5">{item.label}</div>
        </div>
      ))}
    </div>
  );
}
