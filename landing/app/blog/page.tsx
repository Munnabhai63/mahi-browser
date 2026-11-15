import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { getAllBlogPosts } from '../../lib/mdx';

export const metadata: Metadata = {
  title: 'Engineering Blog — Anti-Detect & Browser Stealth Research',
  description:
    'Deep dives on browser fingerprinting, C++ native ANGLE hooks, rebrowser-patches CDP leaks, Camoufox, and distributed multi-seat locks.',
};

export default function BlogIndexPage() {
  const posts = getAllBlogPosts();

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16 space-y-12">
      {/* Header */}
      <div className="text-center space-y-4 max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 rounded-full border border-red-500/30 bg-red-950/40 px-3.5 py-1 text-xs font-semibold text-red-300 uppercase tracking-wider">
          Engineering & Research
        </div>
        <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
          The MAHI Browser Engineering Blog
        </h1>
        <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
          Technical breakdowns, reverse-engineering analyses, and architectural deep dives from the core MAHI Browser development team.
        </p>
      </div>

      {/* Posts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {posts.map((post) => (
          <article
            key={post.slug}
            className="flex flex-col justify-between rounded-2xl border border-slate-800 bg-slate-900/40 p-6 transition hover:border-slate-700 hover:bg-slate-900/70 shadow-lg"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="rounded bg-red-950/80 border border-red-800/50 px-2 py-0.5 font-semibold text-red-300">
                  {post.category}
                </span>
                <span className="text-slate-400">{post.readTime}</span>
              </div>

              <h2 className="text-lg sm:text-xl font-bold text-white hover:text-red-400 transition leading-snug">
                <Link href={`/blog/${post.slug}`}>{post.title}</Link>
              </h2>

              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed line-clamp-3">
                {post.description}
              </p>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
              <div className="flex items-center gap-2">
                <span className="h-6 w-6 rounded-full bg-red-950 border border-red-800 flex items-center justify-center font-bold text-red-300 text-[10px]">
                  MB
                </span>
                <span>{post.author}</span>
              </div>
              <time dateTime={post.date}>{post.date}</time>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
