const nodes = [
  {
    label: 'Consumer Agent',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23-.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21a48.309 48.309 0 01-8.135-.687c-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
      </svg>
    ),
    bg: 'bg-zinc-900',
    border: 'border-zinc-700',
    text: 'text-zinc-300',
    detail: 'Discovers tokens free via DexScreener',
    detailColor: 'text-zinc-500',
  },
  {
    label: 'Stellar Network',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5a17.92 17.92 0 01-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
      </svg>
    ),
    bg: 'bg-sky-500/10',
    border: 'border-sky-500/40',
    text: 'text-sky-300',
    detail: 'Settles XLM payment in ~3 seconds',
    detailColor: 'text-sky-500/70',
  },
  {
    label: 'Risk Sentinel',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
      </svg>
    ),
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/40',
    text: 'text-emerald-300',
    detail: 'Verifies payment on Horizon, returns data',
    detailColor: 'text-emerald-500/70',
  },
];

const steps = [
  { from: 'Consumer', to: 'Sentinel', label: 'GET /rug-check', sub: 'HTTP 402 →' , dir: 'right' },
  { from: 'Consumer', to: 'Stellar',  label: 'Pay 0.02 XLM',  sub: 'tx hash ←',  dir: 'down'  },
  { from: 'Consumer', to: 'Sentinel', label: 'X-Payment: hash', sub: '200 OK ←',   dir: 'right' },
];

export default function FlowDiagram() {
  return (
    <section className="px-5 pb-24">
      <div className="max-w-4xl mx-auto">
        {/* Nodes */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {nodes.map(n => (
            <div key={n.label} className={`${n.bg} border ${n.border} rounded-xl p-4 flex flex-col items-center text-center`}>
              <div className={`${n.text} mb-3`}>{n.icon}</div>
              <p className={`text-sm font-semibold ${n.text}`}>{n.label}</p>
              <p className={`text-xs mt-1.5 ${n.detailColor} leading-snug`}>{n.detail}</p>
            </div>
          ))}
        </div>

        {/* Flow steps */}
        <div className="space-y-2">
          {steps.map((s, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3 bg-zinc-950 border border-zinc-800/60 rounded-lg">
              <span className="w-5 h-5 rounded-full bg-zinc-800 border border-zinc-700 text-xs text-zinc-400 flex items-center justify-center shrink-0 font-medium">
                {i + 1}
              </span>
              <div className="flex-1 flex items-center gap-2 min-w-0">
                <span className="text-sm font-mono text-zinc-300 truncate">{s.label}</span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <svg className="w-4 h-4 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
                <span className="text-xs text-zinc-500">{s.sub}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Result */}
        <div className="mt-3 flex items-center gap-3 px-4 py-3 bg-emerald-500/5 border border-emerald-500/20 rounded-lg">
          <svg className="w-4 h-4 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          <span className="text-sm text-emerald-300 font-mono">
            {`{ "passed": true, "rugScore": 142, "recommendation": "BUY" }`}
          </span>
        </div>
      </div>
    </section>
  );
}
