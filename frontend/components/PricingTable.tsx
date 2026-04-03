const endpoints = [
  {
    method: 'GET',
    path: '/rug-check',
    price: '0.02',
    asset: 'XLM',
    desc: 'Full rug safety analysis',
    features: ['Mint & freeze authority', 'Top holder concentration', 'DANGER flag detection', 'Raw RugCheck score'],
    highlight: true,
  },
  {
    method: 'GET',
    path: '/score',
    price: '0.01',
    asset: 'XLM',
    desc: 'Composite 0–100 score',
    features: ['Age & momentum', 'Volume / market cap ratio', 'Buy pressure analysis', 'BUY / SKIP recommendation'],
    highlight: false,
  },
  {
    method: 'GET',
    path: '/scan',
    price: '0.05',
    asset: 'XLM',
    desc: 'Full live market scan',
    features: ['Scans 15 fresh pairs', 'Rug check on each', 'Scores every token', 'Returns buy signals'],
    highlight: false,
  },
];

export default function PricingTable() {
  return (
    <section id="pricing" className="py-32 px-5 border-t border-zinc-900">
      <div className="max-w-6xl mx-auto">

        <div className="mb-16">
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-3">Pricing</p>
          <h2 className="text-3xl font-semibold text-white tracking-tight">Pay per call</h2>
          <p className="mt-3 text-zinc-400 max-w-lg">
            No signup, no subscription. Each request costs a fixed amount of XLM on Stellar.
            Pay only for what you use.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          {endpoints.map(ep => (
            <div
              key={ep.path}
              className={`card p-6 flex flex-col ${ep.highlight ? 'border-sky-500/30 bg-sky-500/[0.03]' : 'hover:border-zinc-700'} transition-colors`}
            >
              <div className="flex items-center gap-2 mb-5">
                <span className="text-xs font-mono font-medium text-zinc-500">{ep.method}</span>
                <code className="text-sm font-mono text-white">{ep.path}</code>
                {ep.highlight && (
                  <span className="ml-auto text-[10px] font-semibold uppercase tracking-wider text-sky-400 bg-sky-400/10 border border-sky-400/20 px-2 py-0.5 rounded-full">
                    Popular
                  </span>
                )}
              </div>

              <div className="mb-1">
                <span className="text-3xl font-bold text-white tabular-nums">{ep.price}</span>
                <span className="text-zinc-400 ml-1.5 text-sm">{ep.asset} / call</span>
              </div>
              <p className="text-sm text-zinc-500 mb-6">{ep.desc}</p>

              <ul className="space-y-2.5 mt-auto">
                {ep.features.map(f => (
                  <li key={f} className="flex items-center gap-2.5 text-sm text-zinc-300">
                    <svg className="w-3.5 h-3.5 shrink-0 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* MPP session pricing */}
        <div className="card p-6 border-purple-500/20 hover:border-purple-500/40 transition-colors">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-5">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-semibold text-white">MPP Sessions</span>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-purple-400 bg-purple-400/10 border border-purple-400/20 px-2 py-0.5 rounded-full">
                  Bulk discount
                </span>
              </div>
              <p className="text-sm text-zinc-400">
                Pre-pay a budget once. Make unlimited calls against it with{' '}
                <code className="text-xs bg-zinc-900 border border-zinc-800 px-1 py-0.5 rounded text-purple-300">
                  X-MPP-Session
                </code>{' '}
                — ideal for agents making many requests per minute.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Starter', budget: '0.50', calls: '~10–50 calls' },
              { label: 'Pro', budget: '2.00', calls: '~40–200 calls' },
              { label: 'Agent', budget: '10.00', calls: '~200–1000 calls' },
            ].map(t => (
              <div key={t.label} className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-4">
                <p className="text-xs text-zinc-500 mb-2">{t.label}</p>
                <p className="text-xl font-bold text-white tabular-nums">
                  {t.budget} <span className="text-sm font-normal text-zinc-400">XLM</span>
                </p>
                <p className="text-xs text-zinc-500 mt-1">{t.calls}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
