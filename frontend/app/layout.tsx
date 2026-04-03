import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Risk Sentinel — Solana Intelligence API on Stellar',
  description:
    'Autonomous AI agent that sells Solana memecoin intelligence via x402 micropayments on Stellar. Pay per call. No subscriptions, no API keys.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} scroll-smooth`}>
      <body className="font-[family-name:var(--font-inter)]">{children}</body>
    </html>
  );
}
