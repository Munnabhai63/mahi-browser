import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Page Not Found',
  description: 'The requested MAHI Browser page could not be found.',
  robots: {
    index: false,
    follow: true,
  },
};

export default function NotFound() {
  return (
    <section className="min-h-[70vh] w-full bg-[#030303] text-[#ededed] flex items-center justify-center px-6 py-24">
      <div className="max-w-lg w-full rounded-xl border border-white/15 bg-[#0c0d0f] p-8 sm:p-10 text-center space-y-6 shadow-2xl">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-mono uppercase tracking-wider text-zinc-400">
          404 · Not Found
        </div>
        <h1 className="font-['Spectral',serif] text-3xl sm:text-5xl font-light text-white tracking-[-0.03em]">
          Page not found
        </h1>
        <p className="text-sm text-zinc-400 leading-relaxed">
          The page you are looking for does not exist or has moved. Jump back into MAHI Browser below.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <Link
            href="/"
            className="rounded-full bg-white text-black px-5 py-2.5 text-sm font-medium hover:bg-zinc-200 transition-colors"
          >
            Home
          </Link>
          <Link
            href="/pricing"
            className="rounded-full border border-white/20 bg-white/5 px-5 py-2.5 text-sm font-medium text-white hover:bg-white/10 transition-colors"
          >
            Pricing
          </Link>
          <Link
            href="/download"
            className="rounded-full border border-white/20 bg-white/5 px-5 py-2.5 text-sm font-medium text-white hover:bg-white/10 transition-colors"
          >
            Download
          </Link>
          <Link
            href="/docs"
            className="rounded-full border border-white/20 bg-white/5 px-5 py-2.5 text-sm font-medium text-white hover:bg-white/10 transition-colors"
          >
            Docs
          </Link>
        </div>
      </div>
    </section>
  );
}
