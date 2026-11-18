'use client';

import React from 'react';
import Link from 'next/link';
import { getFeaturedPost, getGridPosts } from '../lib/blogData';

export default function BlogView() {
  const featured = getFeaturedPost();
  const gridPosts = getGridPosts();

  return (
    <div className="min-h-screen bg-[#f9f9f9] text-[#030303] selection:bg-black selection:text-white pt-28 sm:pt-32 pb-24">
      <div className="w-full max-w-[1440px] mx-auto px-6 sm:px-10">
        
        {/* Exact Inner Container with Left Border Gutter Line */}
        <div className="w-full pl-6 sm:pl-8 border-l border-[#e6e3e3] space-y-16">
          
          {/* ========================================================================= */}
          {/* 1. BLOG HEADER: 100% LATERAL EXACT SPEC                                  */}
          {/* ========================================================================= */}
          <div>
            {/* Eyebrow */}
            <div className="inline-flex items-center gap-2 mb-6">
              <span className="w-1.5 h-1.5 rounded-[1px] bg-[#969290] inline-block" />
              <span className="text-[11px] font-mono font-normal uppercase tracking-[0.05em] text-[#969290]">
                BLOG
              </span>
            </div>

            {/* Headline in Spectral Serif with Muted Italic "Insights" */}
            <h1 className="font-['Spectral',serif] text-4xl sm:text-5xl lg:text-[62px] font-light leading-[1.12] tracking-[-0.04em] mb-4">
              <span className="text-[#080808]">News &amp; </span>
              <span className="text-[#8f8b85] italic font-light">Insights</span>
            </h1>

            {/* Subtitle */}
            <p className="text-[#636363] text-base leading-[1.4] tracking-[-0.01em] max-w-xl mb-8">
              Articles, kernel architecture teardowns, and stealth updates from the MAHI Browser team.
            </p>

            {/* Black Pill Action Button */}
            <div>
              <Link
                href="/download"
                className="inline-flex items-center justify-center rounded-full bg-[#080808] text-white px-5 py-2.5 text-[14px] font-normal transition-colors hover:bg-zinc-800 shadow-sm"
              >
                Download Free (15 Profiles)
              </Link>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* 2. FEATURED POST: EXACT LATERAL 2-COLUMN WARM GREY #e5e5e3 BENTO CARD    */}
          {/* ========================================================================= */}
          {featured && (
            <Link
              href={`/blog/${featured.slug}`}
              className="group relative block w-full rounded-[4px] bg-[#e5e5e3] overflow-hidden transition-all duration-300 hover:shadow-md"
            >
              {/* Signature Lateral Animated Top Line on Hover */}
              <div className="relative w-full h-[2px] bg-[#737372]/20 overflow-hidden">
                <div className="absolute inset-0 bg-[#080808] -translate-x-full group-hover:translate-x-0 transition-transform duration-500 ease-out" />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center p-6 sm:p-10 lg:p-12">
                {/* Left Column: Post Details */}
                <div className="flex flex-col justify-between h-full space-y-8">
                  <div>
                    {/* Category Tag */}
                    <div className="text-[11px] font-mono font-normal uppercase tracking-[0.05em] text-[#636363] mb-6 sm:mb-10">
                      {featured.category}
                    </div>

                    {/* Date */}
                    <div className="text-[11px] font-mono font-normal uppercase tracking-[0.05em] text-[#969290] mb-3">
                      {featured.date}
                    </div>

                    {/* Title */}
                    <h2 className="font-['Spectral',serif] text-2xl sm:text-3xl lg:text-[34px] font-light leading-[1.18] tracking-[-0.03em] text-[#080808] group-hover:text-black transition-colors mb-4">
                      {featured.title}
                    </h2>

                    {/* Description */}
                    <p className="text-[15px] font-normal leading-relaxed text-[#636363] max-w-lg">
                      {featured.description}
                    </p>
                  </div>

                  <div className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#080808] group-hover:underline">
                    <span>Read article</span>
                    <span className="transition-transform group-hover:translate-x-0.5">→</span>
                  </div>
                </div>

                {/* Right Column: Visual Graphic */}
                <div className="relative aspect-[16/10] sm:aspect-[16/9] w-full rounded-[4px] overflow-hidden bg-zinc-300">
                  <img
                    src={featured.image}
                    alt={featured.title}
                    className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-500 ease-out"
                  />
                </div>
              </div>
            </Link>
          )}

          {/* ========================================================================= */}
          {/* 3. 6-ARTICLE GRID: EXACT LATERAL 3-COLUMN x 2-ROW BORDER-TOP CARDS        */}
          {/* ========================================================================= */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-14 pt-4">
            {gridPosts.map((post) => (
              <Link
                key={post.slug}
                href={`/blog/${post.slug}`}
                className="group flex flex-col justify-between"
              >
                <div>
                  {/* Top Line with Smooth Hover In Animation */}
                  <div className="relative w-full h-[1px] bg-[#d8d8d6] mb-4 overflow-hidden">
                    <div className="absolute inset-0 bg-[#080808] -translate-x-full group-hover:translate-x-0 transition-transform duration-500 ease-out" />
                  </div>

                  {/* Category */}
                  <div className="text-[11px] font-mono font-normal uppercase tracking-[0.05em] text-[#969290] mb-3">
                    {post.category}
                  </div>

                  {/* 16:9 Photography Card */}
                  <div className="aspect-[16/9] w-full rounded-[4px] overflow-hidden bg-zinc-200 mb-4">
                    <img
                      src={post.image}
                      alt={post.title}
                      className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500 ease-out"
                    />
                  </div>

                  {/* Date */}
                  <div className="text-[11px] font-mono font-normal uppercase tracking-[0.05em] text-[#969290] mb-2">
                    {post.date}
                  </div>

                  {/* Title */}
                  <h3 className="text-[18px] sm:text-[19px] font-medium leading-[1.28] tracking-[-0.02em] text-[#080808] group-hover:text-black transition-colors mb-2">
                    {post.title}
                  </h3>

                  {/* Description */}
                  <p className="text-[14px] font-normal leading-[1.45] text-[#636363] tracking-[-0.01em] line-clamp-2">
                    {post.description}
                  </p>
                </div>
              </Link>
            ))}
          </div>

          {/* ========================================================================= */}
          {/* 4. FINAL CTA BENTO CARD: EXACT LATERAL "See Why Top Growth Fleets..."      */}
          {/* ========================================================================= */}
          <div className="pt-8 pb-4">
            <div className="w-full rounded-[4px] bg-[#191919] p-3 flex flex-col lg:flex-row items-stretch gap-2.5 max-w-[1380px] shadow-sm overflow-hidden">
              {/* Left Column: Text & Action Button */}
              <div className="lg:w-[42%] p-6 sm:p-10 flex flex-col justify-between h-full space-y-8">
                <div>
                  {/* Eyebrow */}
                  <div className="inline-flex items-center gap-2 mb-6">
                    <span className="w-1.5 h-1.5 rounded-[1px] bg-[#969290] inline-block" />
                    <span className="text-[11px] font-mono font-normal uppercase tracking-[0.05em] text-[#969290]">
                      GET STARTED
                    </span>
                  </div>

                  {/* Title */}
                  <h3 className="font-['Spectral',serif] text-3xl sm:text-4xl lg:text-[42px] font-light leading-[1.15] tracking-[-0.03em] text-white mb-4">
                    See Why Top Growth<br />Fleets Choose MAHI
                  </h3>

                  {/* Subtitle */}
                  <p className="text-white/60 text-base leading-[1.4] tracking-[-0.01em] max-w-sm">
                    Deploy undetectable dual-engine automation in under 60 seconds.
                  </p>
                </div>

                {/* White Pill Action Button */}
                <div className="pt-4">
                  <Link
                    href="/download?auto=true"
                    className="inline-flex items-center justify-center rounded-full bg-white text-black px-6 py-3 text-[14px] font-medium transition-colors hover:bg-zinc-200 active:scale-[0.98] shadow-md"
                  >
                    Download Free (15 Profiles)
                  </Link>
                </div>
              </div>

              {/* Right Column: Dashboard UI Mockup */}
              <div className="lg:w-[58%] rounded-[4px] overflow-hidden flex items-center justify-center bg-[#1e2022]">
                <img
                  src="/assets/blog/cta_dashboard.png"
                  alt="See Why Top Growth Fleets Choose MAHI Browser"
                  className="w-full h-full object-cover object-center"
                />
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
