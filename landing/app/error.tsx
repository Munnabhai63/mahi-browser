'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[Landing Error Boundary]', error?.digest || error?.message || 'Unexpected error');
  }, [error]);

  return (
    <section className="min-h-[70vh] w-full bg-[#030303] text-[#ededed] flex items-center justify-center px-6 py-24">
      <div className="max-w-lg w-full rounded-xl border border-white/15 bg-[#0c0d0f] p-8 sm:p-10 text-center space-y-6 shadow-2xl">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-mono uppercase tracking-wider text-zinc-400">
          Application Error
        </div>
        <h1 className="font-['Spectral',serif] text-3xl sm:text-4xl font-light text-white tracking-[-0.02em]">
          Something went wrong
        </h1>
        <p className="text-sm text-zinc-400 leading-relaxed">
          An unexpected rendering error occurred while loading this page. Try reloading the view or returning to the home page.
        </p>
        {error?.digest && (
          <p className="text-[11px] font-mono text-zinc-500">
            Reference: {error.digest}
          </p>
        )}
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => reset()}
            className="rounded-full bg-white text-black px-5 py-2.5 text-sm font-medium hover:bg-zinc-200 transition-colors"
          >
            Try Again
          </button>
          <Link
            href="/"
            className="rounded-full border border-white/20 bg-white/5 px-5 py-2.5 text-sm font-medium text-white hover:bg-white/10 transition-colors"
          >
            Back to Home
          </Link>
        </div>
      </div>
    </section>
  );
}
