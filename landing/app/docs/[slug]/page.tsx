import React from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getAllDocs, getDocBySlug } from '../../../lib/mdx';
import DocsSidebar from '../../../components/DocsSidebar';
import MarkdownView from '../../../components/MarkdownView';

interface DocPageProps {
  params: {
    slug: string;
  };
}

export function generateStaticParams() {
  const docs = getAllDocs();
  return docs.map((doc) => ({
    slug: doc.slug,
  }));
}

export function generateMetadata({ params }: DocPageProps): Metadata {
  const doc = getDocBySlug(params.slug);
  if (!doc) {
    return { title: 'Documentation Guide | MAHI Browser' };
  }
  return {
    title: `${doc.title} — MAHI Browser Docs`,
    description: doc.description,
  };
}

export default function SingleDocPage({ params }: DocPageProps) {
  const docs = getAllDocs();
  const doc = getDocBySlug(params.slug);

  if (!doc) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
      <div className="flex flex-col md:flex-row gap-8 lg:gap-12">
        <DocsSidebar docs={docs} currentSlug={doc.slug} />

        <article className="flex-1 min-w-0 max-w-4xl space-y-6">
          <div className="border-b border-slate-800 pb-4">
            <span className="text-xs font-semibold uppercase tracking-wider text-red-400">
              {doc.section}
            </span>
            <h1 className="mt-1 text-3xl sm:text-4xl font-extrabold text-white">
              {doc.title}
            </h1>
            <p className="mt-2 text-sm text-slate-400">
              {doc.description}
            </p>
          </div>

          <MarkdownView content={doc.content} />
        </article>
      </div>
    </div>
  );
}
