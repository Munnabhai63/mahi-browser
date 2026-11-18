import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  getAllLateralPosts,
  getPostBySlug,
  getRelatedPosts,
  LateralPost,
} from '../../../lib/blogData';
import { getAllBlogPosts, getBlogPostBySlug } from '../../../lib/mdx';
import MarkdownView from '../../../components/MarkdownView';

interface BlogPostPageProps {
  params: {
    slug: string;
  };
}

export function generateStaticParams() {
  const lateralSlugs = getAllLateralPosts().map((p) => ({ slug: p.slug }));
  const mdxSlugs = getAllBlogPosts().map((p) => ({ slug: p.slug }));
  return [...lateralSlugs, ...mdxSlugs];
}

export function generateMetadata({ params }: BlogPostPageProps): Metadata {
  const lateralPost = getPostBySlug(params.slug);
  if (lateralPost) {
    return {
      title: `${lateralPost.title} — Lateral Blog`,
      description: lateralPost.description,
      openGraph: {
        title: lateralPost.title,
        description: lateralPost.description,
        type: 'article',
        publishedTime: lateralPost.date,
        images: [lateralPost.image],
      },
    };
  }

  const mdxPost = getBlogPostBySlug(params.slug);
  if (mdxPost) {
    return {
      title: `${mdxPost.title} — MAHI Browser Blog`,
      description: mdxPost.description,
    };
  }

  return { title: 'Blog Post — Lateral' };
}

export default function SingleBlogPostPage({ params }: BlogPostPageProps) {
  const post = getPostBySlug(params.slug);

  // If this is a legacy MDX post, render cleanly inside the same light theme wrapper
  if (!post) {
    const mdxPost = getBlogPostBySlug(params.slug);
    if (!mdxPost) {
      notFound();
    }

    return (
      <div className="min-h-screen bg-[#f9f9f9] text-[#030303] pt-28 sm:pt-32 pb-24">
        <div className="max-w-[1000px] mx-auto px-6 sm:px-10">
          <Link
            href="/blog"
            className="inline-flex items-center gap-2 text-[13px] font-normal text-[#636363] hover:text-black mb-8 transition-colors"
          >
            <span>↶ All Posts</span>
          </Link>
          <div className="border-l border-[#e6e3e3] pl-6 sm:pl-8 space-y-8">
            <div className="text-[11px] font-mono uppercase tracking-[0.05em] text-[#969290]">
              {mdxPost.category} • {mdxPost.date}
            </div>
            <h1 className="font-['Spectral',serif] text-3xl sm:text-4xl lg:text-[46px] font-light leading-[1.14] text-[#080808]">
              {mdxPost.title}
            </h1>
            <p className="text-base text-[#636363] leading-relaxed">
              {mdxPost.description}
            </p>
            <div className="pt-6 border-t border-[#e6e3e3]">
              <MarkdownView content={mdxPost.content} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  const related = getRelatedPosts(post.slug, 3);

  return (
    <div className="min-h-screen bg-[#f9f9f9] text-[#030303] selection:bg-black selection:text-white pt-28 sm:pt-32 pb-24">
      <div className="w-full max-w-[1440px] mx-auto px-6 sm:px-10">
        
        {/* Inner Container with Left Border Gutter Line */}
        <div className="w-full pl-6 sm:pl-8 border-l border-[#e6e3e3] space-y-16">
          
          {/* Back to All Posts */}
          <div>
            <Link
              href="/blog"
              className="inline-flex items-center gap-2 text-[13px] font-normal text-[#636363] hover:text-black transition-colors"
            >
              <span>↶ All Posts</span>
            </Link>
          </div>

          {/* Article Header */}
          <header className="space-y-4 max-w-4xl">
            <h1 className="font-['Spectral',serif] text-3xl sm:text-4xl lg:text-[52px] font-light leading-[1.12] tracking-[-0.04em] text-[#080808]">
              {post.title}
            </h1>
            <div className="text-[11px] font-mono uppercase tracking-[0.05em] text-[#969290]">
              {post.category} • {post.date}
            </div>
            <p className="text-base sm:text-lg text-[#636363] leading-relaxed pt-2">
              {post.description}
            </p>
          </header>

          {/* Featured Wide Image */}
          <div className="w-full aspect-[16/9] sm:aspect-[21/9] rounded-[4px] overflow-hidden bg-zinc-200 shadow-sm max-w-[1380px]">
            <img
              src={post.image}
              alt={post.title}
              className="w-full h-full object-cover object-center"
            />
          </div>

          {/* 2-Column Article Body: Sidebar + Editorial Content */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 max-w-[1380px] pt-4">
            
            {/* Left Sidebar: Metadata & Author Card */}
            <aside className="lg:col-span-4 space-y-8">
              <div className="sticky top-28 space-y-8">
                {/* Published Date */}
                <div>
                  <div className="text-[11px] font-mono uppercase tracking-[0.05em] text-[#969290] mb-1">
                    PUBLISHED
                  </div>
                  <div className="text-[14px] font-medium text-[#080808]">
                    {post.date}
                  </div>
                </div>

                {/* Author Info */}
                <div>
                  <div className="text-[11px] font-mono uppercase tracking-[0.05em] text-[#969290] mb-3">
                    AUTHOR
                  </div>
                  <div className="flex items-center gap-3">
                    <img
                      src={post.authorImage || '/assets/company/lateral_john.jpg'}
                      alt={post.authorName || 'Author'}
                      className="w-10 h-10 rounded-full object-cover bg-zinc-200"
                    />
                    <div>
                      <div className="text-[14px] font-medium text-[#080808]">
                        {post.authorName || 'John Carver'}
                      </div>
                      <div className="text-[11px] font-mono uppercase tracking-[0.05em] text-[#969290]">
                        {post.authorRole || 'Co-Founder'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Pill Action Button */}
                <div className="pt-2">
                  <Link
                    href="/book-demo"
                    className="inline-flex items-center justify-center rounded-full bg-[#080808] text-white px-5 py-2.5 text-[14px] font-normal hover:bg-zinc-800 transition-colors shadow-sm"
                  >
                    Request Demo
                  </Link>
                </div>
              </div>
            </aside>

            {/* Right Column: Editorial Body Paragraphs */}
            <article className="lg:col-span-8 space-y-8 max-w-[780px]">
              {post.sections.map((sec, idx) => (
                <section key={idx} className="space-y-4">
                  {sec.heading && (
                    <h2 className="font-['Spectral',serif] text-2xl sm:text-[30px] font-light leading-[1.25] tracking-[-0.03em] text-[#080808] pt-4">
                      {sec.heading}
                    </h2>
                  )}
                  {sec.paragraphs.map((p, pIdx) => {
                    if (p.startsWith('LIST:')) {
                      const items = p.replace('LIST:', '').split(' | ');
                      return (
                        <ul key={pIdx} className="list-disc pl-5 space-y-2 text-[#333333] text-[15px] sm:text-[16px] leading-relaxed my-4">
                          {items.map((item, itemIdx) => (
                            <li key={itemIdx}>{item}</li>
                          ))}
                        </ul>
                      );
                    }
                    return (
                      <p key={pIdx} className="text-[#333333] text-[16px] sm:text-[17px] leading-[1.65] font-normal">
                        {p}
                      </p>
                    );
                  })}
                </section>
              ))}
            </article>

          </div>

          {/* ========================================================================= */}
          {/* READ NEXT: EXACT LATERAL 3-CARD RELATED SECTION                           */}
          {/* ========================================================================= */}
          <section className="pt-20 border-t border-[#e6e3e3] max-w-[1380px] space-y-12">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <h2 className="font-['Spectral',serif] text-3xl sm:text-4xl font-light text-[#080808] tracking-[-0.03em]">
                Read Next
              </h2>
              <Link
                href="/blog"
                className="inline-flex items-center justify-center rounded-full bg-[#080808] text-white px-5 py-2 text-[13px] font-normal hover:bg-zinc-800 transition-colors w-fit shadow-sm"
              >
                View All Articles
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {related.map((rel) => (
                <Link
                  key={rel.slug}
                  href={`/blog/${rel.slug}`}
                  className="group flex flex-col justify-between"
                >
                  <div>
                    {/* Top line with hover in */}
                    <div className="relative w-full h-[1px] bg-[#d8d8d6] mb-4 overflow-hidden">
                      <div className="absolute inset-0 bg-[#080808] -translate-x-full group-hover:translate-x-0 transition-transform duration-500 ease-out" />
                    </div>

                    <div className="text-[11px] font-mono font-normal uppercase tracking-[0.05em] text-[#969290] mb-3">
                      {rel.category}
                    </div>

                    <div className="aspect-[16/9] w-full rounded-[4px] overflow-hidden bg-zinc-200 mb-4">
                      <img
                        src={rel.image}
                        alt={rel.title}
                        className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500 ease-out"
                      />
                    </div>

                    <div className="text-[11px] font-mono font-normal uppercase tracking-[0.05em] text-[#969290] mb-2">
                      {rel.date}
                    </div>

                    <h3 className="text-[17px] font-medium leading-[1.28] tracking-[-0.02em] text-[#080808] group-hover:text-black transition-colors mb-2">
                      {rel.title}
                    </h3>

                    <p className="text-[13px] font-normal leading-[1.4] text-[#636363] tracking-[-0.01em] line-clamp-2">
                      {rel.description}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </section>

        </div>

      </div>
    </div>
  );
}
