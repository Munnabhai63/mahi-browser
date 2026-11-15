import React from 'react';
import type { Metadata } from 'next';
import { getAllDocs } from '../../lib/mdx';
import DocsSidebar from '../../components/DocsSidebar';
import MarkdownView from '../../components/MarkdownView';

export const metadata: Metadata = {
  title: 'Documentation — MAHI Browser Anti-Detect Fleet',
  description:
    'Comprehensive guides and developer API references for MAHI Browser. Learn proxy setup, anti-detect tuning, and Playwright automation.',
};

export default function DocsPage() {
  const docs = getAllDocs();
  const firstDoc = docs[0];

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
      <div className="flex flex-col md:flex-row gap-8 lg:gap-12">
        <DocsSidebar docs={docs} currentSlug={firstDoc?.slug} />

        <article className="flex-1 min-w-0 max-w-4xl">
          {firstDoc ? (
            <div className="space-y-6">
              <div className="border-b border-slate-800 pb-4">
                <span className="text-xs font-semibold uppercase tracking-wider text-red-400">
                  {firstDoc.section}
                </span>
                <h1 className="mt-1 text-3xl sm:text-4xl font-extrabold text-white">
                  {firstDoc.title}
                </h1>
                <p className="mt-2 text-sm text-slate-400">
                  {firstDoc.description}
                </p>
              </div>
              <MarkdownView content={firstDoc.content} />
            </div>
          ) : (
            <div className="text-slate-400">No documentation guides found.</div>
          )}
        </article>
      </div>
    </div>
  );
}
