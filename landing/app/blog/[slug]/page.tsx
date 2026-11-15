import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getAllBlogPosts, getBlogPostBySlug } from '../../../lib/mdx';
import { BRAND } from '../../../lib/brand';
import MarkdownView from '../../../components/MarkdownView';

interface BlogPostPageProps {
  params: {
    slug: string;
  };
}

export function generateStaticParams() {
  const posts = getAllBlogPosts();
  return posts.map((post) => ({
    slug: post.slug,
  }));
}

export function generateMetadata({ params }: BlogPostPageProps): Metadata {
  const post = getBlogPostBySlug(params.slug);
  if (!post) {
    return { title: 'Blog Post | MAHI Browser' };
  }
  return {
    title: `${post.title} — MAHI Browser Blog`,
    description: post.description,
    authors: [{ name: post.author }],
    openGraph: {
      type: 'article',
      title: post.title,
      description: post.description,
      publishedTime: post.date,
      authors: [post.author],
      url: `${BRAND.website}/blog/${post.slug}`,
      images: [BRAND.assets.logo],
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.description,
      images: [BRAND.assets.logo],
    },
  };
}

export default function SingleBlogPostPage({ params }: BlogPostPageProps) {
  const post = getBlogPostBySlug(params.slug);

  if (!post) {
    notFound();
  }

  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.description,
    datePublished: post.date,
    dateModified: post.date,
    author: {
      '@type': 'Person',
      name: post.author,
    },
    publisher: {
      '@type': 'Organization',
      name: BRAND.name,
      logo: {
        '@type': 'ImageObject',
        url: `${BRAND.website}${BRAND.assets.logo}`,
      },
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `${BRAND.website}/blog/${post.slug}`,
    },
  };

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16 space-y-10">
      {/* Schema.org Article Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
      />

      {/* Back button */}
      <div>
        <Link
          href="/blog"
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-red-400 transition"
        >
          &larr; Back to all articles
        </Link>
      </div>

      {/* Header */}
      <header className="space-y-4 border-b border-slate-800 pb-8">
        <div className="flex items-center gap-3 text-xs">
          <span className="rounded bg-red-950/80 border border-red-800/50 px-2.5 py-0.5 font-semibold text-red-300">
            {post.category}
          </span>
          <span className="text-slate-400">•</span>
          <span className="text-slate-400">{post.readTime}</span>
        </div>

        <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight">
          {post.title}
        </h1>

        <p className="text-base sm:text-lg text-slate-300 leading-relaxed">
          {post.description}
        </p>

        <div className="flex items-center gap-3 pt-2 text-xs text-slate-400">
          <div className="h-8 w-8 rounded-full bg-red-950 border border-red-800 flex items-center justify-center font-bold text-red-300">
            MB
          </div>
          <div>
            <div className="font-semibold text-white">{post.author}</div>
            <time dateTime={post.date}>{post.date}</time>
          </div>
        </div>
      </header>

      {/* Post Content */}
      <article className="min-w-0">
        <MarkdownView content={post.content} />
      </article>

      {/* Bottom CTA Box */}
      <div className="rounded-2xl border border-red-900/60 bg-gradient-to-r from-red-950/40 via-slate-900 to-slate-950 p-6 sm:p-8 space-y-4 shadow-xl">
        <h3 className="text-xl font-bold text-white">
          Experience Undetectable Dual-Engine Browsing
        </h3>
        <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
          MAHI Browser integrates all the C++ native modifications and rebrowser-patches covered in this article. Download now and start with 15 free offline profiles.
        </p>
        <div className="flex flex-wrap items-center gap-3 pt-1">
          <Link
            href="/download"
            className="rounded-xl bg-red-600 px-5 py-2.5 text-xs sm:text-sm font-bold text-white transition hover:bg-red-500 shadow-lg shadow-red-900/30"
          >
            Download MAHI Browser Free
          </Link>
          <Link
            href="/compare/gologin-alternative"
            className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-xs sm:text-sm font-semibold text-slate-200 transition hover:bg-slate-800"
          >
            Read GoLogin Benchmark
          </Link>
        </div>
      </div>
    </div>
  );
}
