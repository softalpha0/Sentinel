const steps = [
  {
    n: '01',
    title: 'Call the endpoint',
    desc: 'Make a standard HTTP request to any paid route. The server returns HTTP 402 with the exact amount, asset, and destination address.',
    tag: 'HTTP 402',
    tagColor: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
  },
  {
    n: '02',
    title: 'Pay on Stellar',
    desc: 'Send the exact XLM or USDC amount to the producer wallet. Stellar settles in 3–5 seconds at near-zero cost.',
    tag: 'Stellar payment',
    tagColor: 'text-sky-400 bg-sky-400/10 border-sky-400/20',
  },
  {
    n: '03',
    title: 'Retry with proof',
    desc: 'Attach the transaction hash in the X-Payment header and resend. The server verifies on Horizon and returns the data.',
    tag: 'X-Payment header',
    tagColor: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
  },
];

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="py-32 px-5 border-t border-zinc-900">
      <div className="max-w-6xl mx-auto">

        <div className="mb-16">
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-3">Protocol</p>
          <h2 className="text-3xl font-semibold text-white tracking-tight">How x402 works</h2>
          <p className="mt-3 text-zinc-400 max-w-lg">
            Every API call is a self-contained payment flow. No accounts, no monthly limits.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {steps.map((s) => (
            <div key={s.n} className="card p-6 relative overflow-hidden group hover:border-zinc-700 transition-colors">
              <div className="absolute top-4 right-4 text-5xl font-bold text-zinc-900 select-none group-hover:text-zinc-800 transition-colors">
                {s.n}
              </div>
              <span className={`badge border ${s.tagColor} mb-5`}>{s.tag}</span>
              <h3 className="font-semibold text-white mb-2">{s.title}</h3>
              <p className="text-sm text-zinc-400 leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>

        {/* MPP row */}
        <div className="mt-4 card p-5 flex flex-col sm:flex-row items-start sm:items-center gap-5 hover:border-zinc-700 transition-colors">
          <div className="shrink-0">
            <span className="badge border text-purple-400 bg-purple-400/10 border-purple-400/20">
              MPP · Machine Payments Protocol
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-zinc-300">
              Pre-pay a USDC or XLM budget to open a session. Use{' '}
              <code className="text-xs bg-zinc-900 border border-zinc-800 px-1.5 py-0.5 rounded text-purple-300">
                X-MPP-Session
              </code>{' '}
              on all subsequent calls — no per-request payment needed. Ideal for agents making dozens of calls per minute.
            </p>
          </div>
          <div className="shrink-0 text-xs text-zinc-500">
            POST /mpp/session
          </div>
        </div>
      </div>
    </section>
  );
}
