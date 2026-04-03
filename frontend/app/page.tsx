import Link from 'next/link';
import LiveCounter from '@/components/LiveCounter';

const agents = [
  {
    role: 'Scanner',
    color: 'sky',
    border: 'border-sky-500/30',
    bg: 'bg-sky-500/5',
    dot: 'bg-sky-400',
    text: 'text-sky-400',
    description: 'Polls DexScreener every 60s for new Solana pairs. Filters by liquidity, volume, age, and buy pressure.',
    action: 'Pays 0.1 XLM →',
  },
  {
    role: 'Risk Agent ×2',
    color: 'amber',
    border: 'border-amber-500/30',
    bg: 'bg-amber-500/5',
    dot: 'bg-amber-400',
    text: 'text-amber-400',
    description: 'Verifies Stellar payment, runs RugCheck.xyz, scores token 0–100 across 6 dimensions independently.',
    action: 'Reports →',
  },
  {
    role: 'Consensus',
    color: 'violet',
    border: 'border-violet-500/30',
    bg: 'bg-violet-500/5',
    dot: 'bg-violet-400',
    text: 'text-violet-400',
    description: 'Byzantine quorum in 8s window. Majority vote required — one hard-fail blocks the trade entirely.',
    action: 'Decides →',
  },
  {
    role: 'Execution',
    color: 'emerald',
    border: 'border-emerald-500/30',
    bg: 'bg-emerald-500/5',
    dot: 'bg-emerald-400',
    text: 'text-emerald-400',
    description: 'Executes Jupiter swap on BUY decision. Monitors positions with TP/SL. Deduplicates by requestId.',
    action: null,
  },
];

const endpoints = [
  { method: 'GET', path: '/rug-check', price: '0.02 XLM', desc: 'Full rug safety report — mint authority, freeze, holder concentration, rug score' },
  { method: 'GET', path: '/score', price: '0.01 XLM', desc: 'Composite 0–100 score across age, volume, momentum, buy pressure, social, rug safety' },
  { method: 'GET', path: '/scan', price: '0.05 XLM', desc: 'Full market scan — returns all pairs passing filters with scores right now' },
  { method: 'POST', path: '/mpp/session', price: 'prepay budget', desc: 'Open a multi-call session — pay once, call multiple endpoints until budget is spent' },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-black text-white">

      {/* Nav */}
      <nav className="sticky top-0 z-40 h-12 border-b border-zinc-900 bg-black/80 backdrop-blur-xl flex items-center px-6">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
          <span className="text-sm font-medium text-white">Risk Sentinel</span>
        </div>
        <div className="ml-auto flex items-center gap-4 text-xs text-zinc-500">
          <Link href="/swarm" className="hover:text-white transition-colors">Swarm</Link>
          <Link href="/dashboard" className="hover:text-white transition-colors">Dashboard</Link>
          <a
            href="https://sentinel-production-d008.up.railway.app"
            target="_blank"
            rel="noopener noreferrer"
            className="h-7 px-3 bg-white text-black font-medium rounded-md hover:bg-zinc-100 transition-colors flex items-center"
          >
            API Live
          </a>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-6 pt-24 pb-16 text-center">
        <div className="inline-flex items-center gap-2 text-xs border border-zinc-800 bg-zinc-950 text-zinc-400 px-3 py-1.5 rounded-full mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Vertex Swarm Challenge 2026 · Track 3 — The Agent Economy
        </div>
        <h1 className="text-5xl sm:text-6xl font-semibold tracking-tight leading-tight mb-5">
          A leaderless AI swarm<br />
          <span className="text-zinc-500">that trades Solana memecoins.</span>
        </h1>
        <p className="text-zinc-400 text-lg max-w-2xl mx-auto leading-relaxed mb-8">
          Four specialized agents coordinate over Vertex P2P (FoxMQ). Agents pay each other in XLM on Stellar for every analysis. The swarm sells its intelligence as a paid API — no subscriptions, no API keys.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link href="/swarm" className="h-9 px-5 bg-white text-black text-sm font-medium rounded-lg hover:bg-zinc-100 transition-colors flex items-center gap-1.5">
            Live Swarm Dashboard
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </Link>
          <Link href="/dashboard" className="h-9 px-5 bg-zinc-900 border border-zinc-800 text-zinc-300 text-sm font-medium rounded-lg hover:border-zinc-700 transition-all">
            API Dashboard
          </Link>
        </div>
        <LiveCounter />
      </section>

      {/* Agent Pipeline */}
      <section className="border-t border-zinc-900 py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-600 mb-2">Swarm Architecture</p>
          <h2 className="text-2xl font-semibold mb-2">Four agents. Zero coordinator.</h2>
          <p className="text-zinc-500 text-sm mb-10 max-w-xl">
            Every agent runs independently over FoxMQ — Tashi's MQTT 5.0 broker built on Vertex P2P BFT consensus. Agents pay each other on Stellar for every token analyzed.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {agents.map((agent, i) => (
              <div key={agent.role} className={`relative border ${agent.border} ${agent.bg} rounded-xl p-5`}>
                {/* Step number */}
                <div className="flex items-center justify-between mb-4">
                  <span className={`text-xs font-mono font-medium ${agent.text}`}>0{i + 1}</span>
                  <span className={`w-2 h-2 rounded-full ${agent.dot} animate-pulse`} />
                </div>
                <p className="text-sm font-semibold text-white mb-2">{agent.role}</p>
                <p className="text-xs text-zinc-500 leading-relaxed mb-4">{agent.description}</p>
                {agent.action && (
                  <div className={`text-xs font-mono ${agent.text} flex items-center gap-1`}>
                    {agent.action}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Payment flow callout */}
          <div className="mt-4 flex items-center gap-3 bg-zinc-950 border border-zinc-800 rounded-xl px-5 py-4">
            <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center shrink-0">
              <span className="text-sky-400 text-xs">★</span>
            </div>
            <div>
              <p className="text-sm text-white font-medium">Stellar micropayments between agents</p>
              <p className="text-xs text-zinc-500 mt-0.5">Scanner sends 0.1 XLM to each risk agent on Stellar testnet before publishing a candidate. Risk agents verify on Horizon and reject unverified candidates — autonomous economic enforcement with no human in the loop.</p>
            </div>
          </div>
        </div>
      </section>

      {/* API section */}
      <section className="border-t border-zinc-900 py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-600 mb-2">Intelligence API</p>
          <h2 className="text-2xl font-semibold mb-2">The swarm sells what it knows.</h2>
          <p className="text-zinc-500 text-sm mb-10 max-w-xl">
            Pay per call in XLM via the x402 protocol. Send XLM to the producer address, pass the tx hash as <code className="text-zinc-400 bg-zinc-900 px-1 rounded">X-Payment</code> — get intelligence back.
          </p>

          <div className="space-y-2">
            {endpoints.map(ep => (
              <div key={ep.path} className="flex items-start gap-4 bg-zinc-950 border border-zinc-800 rounded-xl px-5 py-4 hover:border-zinc-700 transition-colors">
                <span className="text-xs font-mono text-zinc-600 w-10 shrink-0 pt-0.5">{ep.method}</span>
                <span className="text-sm font-mono text-zinc-200 w-36 shrink-0">{ep.path}</span>
                <span className="text-sm text-amber-400 font-medium w-28 shrink-0">{ep.price}</span>
                <span className="text-xs text-zinc-500 leading-relaxed">{ep.desc}</span>
              </div>
            ))}
          </div>

          <div className="mt-4 flex items-center gap-3">
            <a
              href="https://sentinel-production-d008.up.railway.app/health"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-sky-400 hover:text-sky-300 transition-colors flex items-center gap-1"
            >
              View live API spec
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </div>
        </div>
      </section>

      {/* Built on */}
      <section className="border-t border-zinc-900 py-14 px-6">
        <div className="max-w-5xl mx-auto">
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-700 text-center mb-6">Built on</p>
          <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-3">
            {[
              { name: 'Vertex P2P', highlight: true },
              { name: 'FoxMQ', highlight: true },
              { name: 'Stellar', highlight: false },
              { name: 'x402 Protocol', highlight: false },
              { name: 'OpenServ', highlight: false },
              { name: 'Solana', highlight: false },
              { name: 'Jupiter', highlight: false },
              { name: 'RugCheck.xyz', highlight: false },
              { name: 'DexScreener', highlight: false },
            ].map(item => (
              <span key={item.name} className={`text-sm transition-colors cursor-default ${item.highlight ? 'text-sky-400' : 'text-zinc-600 hover:text-zinc-400'}`}>
                {item.name}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-900 py-8 px-6">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-700">
          <span>Risk Sentinel · Vertex Swarm Challenge 2026</span>
          <div className="flex items-center gap-4">
            <Link href="/swarm" className="hover:text-zinc-400 transition-colors">Swarm</Link>
            <Link href="/dashboard" className="hover:text-zinc-400 transition-colors">Dashboard</Link>
            <a href="https://sentinel-production-d008.up.railway.app" target="_blank" rel="noopener noreferrer" className="hover:text-zinc-400 transition-colors">API</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
