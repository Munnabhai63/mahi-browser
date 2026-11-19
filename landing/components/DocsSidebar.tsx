import React from 'react';
import Link from 'next/link';
import { DocItem } from '../lib/mdx';

interface DocsSidebarProps {
  docs: DocItem[];
  currentSlug?: string;
}

export default function DocsSidebar({ docs, currentSlug }: DocsSidebarProps) {
  return (
    <aside className="w-full md:w-64 shrink-0 space-y-6">
      <div className="sticky top-20 rounded-2xl border border-slate-800 bg-slate-900/50 p-5 space-y-4">
        <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
          Documentation Guides
        </div>
        <nav className="flex flex-col space-y-1">
          {docs.map((doc) => {
            const isActive = currentSlug === doc.slug;
            return (
              <Link
                key={doc.slug}
                href={`/docs/${doc.slug}`}
                className={`rounded-lg px-3 py-2 text-xs sm:text-sm font-medium transition ${
                  isActive
                    ? 'bg-red-950/80 text-red-300 border border-red-800/60 font-semibold'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                {doc.title}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-slate-800 pt-4 space-y-2">
          <div className="text-xs font-semibold text-slate-400">Need Enterprise Help?</div>
          <p className="text-[11px] text-slate-500">
            Reach out via WhatsApp or email for custom C++ engine patches.
          </p>
          <a
            href="https://wa.me/919376343629"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-zinc-300 hover:text-white font-medium transition-colors"
          >
            WhatsApp Support &rarr;
          </a>
        </div>
      </div>
    </aside>
  );
}
