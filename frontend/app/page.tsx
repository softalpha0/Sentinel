import Link from 'next/link';
import Header from '@/components/Header';
import HowItWorks from '@/components/HowItWorks';
import PricingTable from '@/components/PricingTable';
import LiveCounter from '@/components/LiveCounter';
import FlowDiagram from '@/components/FlowDiagram';

export default function Home() {
  return (
    <div className="min-h-screen bg-black text-white">
      <Header />

      {/* Hero */}
      <section className="relative pt-40 pb-28 px-5 overflow-hidden">
        {/* Subtle background effects */}
        <div className="absolute inset-0 dot-grid opacity-40" />
        <div className="absolute inset-0 glow-blue pointer-events-none" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-px h-40 bg-gradient-to-b from-transparent via-sky-500/40 to-transparent" />

        <div className="relative max-w-4xl mx-auto">
          {/* Badge */}
          <div className="flex justify-center mb-8">
            <div className="flex items-center gap-2 text-xs border border-zinc-800 bg-zinc-950 text-zinc-400 px-3 py-1.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Agents on Stellar Hackathon · 2026
            </div>
          </div>

          {/* Headline */}
          <h1 className="text-center text-5xl sm:text-6xl lg:text-7xl font-semibold tracking-tight leading-[1.08] mb-6">
            Solana intelligence,
            <br />
            <span className="text-zinc-400">paid per call on Stellar.</span>
          </h1>

          <p className="text-center text-lg text-zinc-400 max-w-xl mx-auto mb-10 leading-relaxed">
            Risk Sentinel sells memecoin rug-check and scoring intelligence
            via x402 micropayments. No subscriptions. No API keys.
          </p>

          <div className="flex items-center justify-center gap-3">
            <Link
              href="/dashboard"
              className="h-9 px-4 bg-white text-black text-sm font-medium rounded-lg hover:bg-zinc-100 transition-colors flex items-center gap-1.5"
            >
              View Dashboard
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </Link>
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="h-9 px-4 bg-zinc-900 border border-zinc-800 text-zinc-300 text-sm font-medium rounded-lg hover:border-zinc-700 hover:text-white transition-all flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
              </svg>
              Source
            </a>
          </div>

          <LiveCounter />
        </div>
      </section>

      <FlowDiagram />

      <HowItWorks />
      <PricingTable />

      {/* Built on */}
      <section className="py-20 px-5 border-t border-zinc-900">
        <div className="max-w-6xl mx-auto">
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-600 text-center mb-8">Built on</p>
          <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-4">
            {['Stellar', 'x402 Protocol', 'MPP', 'Solana', 'RugCheck.xyz', 'DexScreener', 'Jupiter'].map(name => (
              <span key={name} className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors cursor-default">
                {name}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-900 py-8 px-5">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-600">
          <div className="flex items-center gap-2">
            <span className="w-4 h-4 rounded bg-sky-500/10 border border-sky-500/20 flex items-center justify-center">
              <span className="w-1.5 h-1.5 rounded-sm bg-sky-400/70" />
            </span>
            Risk Sentinel · Agents on Stellar Hackathon 2026
          </div>
          <div className="flex items-center gap-4">
            <span>Stellar x402</span>
            <span className="text-zinc-800">·</span>
            <span>MPP Sessions</span>
            <span className="text-zinc-800">·</span>
            <span>Solana Intelligence</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
