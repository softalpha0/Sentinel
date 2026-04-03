import Link from 'next/link';

export default function Header() {
  return (
    <header className="fixed top-0 inset-x-0 z-50 h-14 border-b border-zinc-800/50 bg-black/70 backdrop-blur-xl">
      <div className="max-w-6xl mx-auto px-5 h-full flex items-center justify-between">

        <Link href="/" className="flex items-center gap-2 group">
          <span className="w-6 h-6 rounded bg-sky-500/10 border border-sky-500/30 flex items-center justify-center">
            <span className="w-2 h-2 rounded-sm bg-sky-400" />
          </span>
          <span className="text-sm font-semibold text-white tracking-tight">Risk Sentinel</span>
        </Link>

        <nav className="hidden sm:flex items-center gap-1 text-sm text-zinc-400">
          <Link href="/#how-it-works" className="px-3 py-1.5 rounded-md hover:text-white hover:bg-zinc-900 transition-all">
            How it works
          </Link>
          <Link href="/#pricing" className="px-3 py-1.5 rounded-md hover:text-white hover:bg-zinc-900 transition-all">
            Pricing
          </Link>
          <div className="w-px h-4 bg-zinc-800 mx-1" />
          <Link href="/swarm" className="px-3 py-1.5 rounded-md hover:text-white hover:bg-zinc-900 transition-all">
            Swarm
          </Link>
          <Link
            href="/dashboard"
            className="px-3 py-1.5 rounded-md bg-white text-black text-sm font-medium hover:bg-zinc-100 transition-all"
          >
            Dashboard
          </Link>
        </nav>
      </div>
    </header>
  );
}
