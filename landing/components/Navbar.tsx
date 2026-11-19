'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Navbar() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Home route uses the 100% pixel-perfect Framer Navbar inside FramerHeroAndIntro
  if (pathname === '/') {
    return null;
  }

  // Detect whether current page uses the Lateral Light theme (Customers, Compare & Blog pages)
  const isLight =
    pathname === '/customers' ||
    pathname === '/compare' ||
    pathname === '/blog' ||
    (pathname ? pathname.startsWith('/compare') : false) ||
    (pathname ? pathname.startsWith('/blog') : false);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isLight
          ? 'bg-[#f9f9f9]/90 backdrop-blur-md border-b border-black/5 text-[#111111]'
          : 'bg-[#030303]/80 backdrop-blur-md border-b border-white/5 text-[#ededed]'
      }`}
    >
      <div className="w-full max-w-[1920px] mx-auto px-6 sm:px-10 lg:px-12 py-5 flex items-center justify-between">
        
        {/* BRAND LOGO (LEFT: MAX 25%) */}
        <div className="w-1/4 flex items-center justify-start">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center p-1.5 shadow-sm transition-colors ${
                isLight
                  ? 'bg-white border border-zinc-300 group-hover:border-black'
                  : 'bg-zinc-900 border border-zinc-700/60 group-hover:border-zinc-500'
              }`}
            >
              <svg
                className={`w-full h-full ${isLight ? 'text-black' : 'text-white'}`}
                viewBox="0 0 24 24"
                fill="none"
              >
                <rect x="3" y="3" width="12" height="12" rx="3" stroke="currentColor" strokeWidth="2" fill="none" />
                <rect
                  x="9"
                  y="9"
                  width="12"
                  height="12"
                  rx="3"
                  stroke="currentColor"
                  strokeWidth="2"
                  fill={isLight ? '#f4f4f5' : '#18181b'}
                />
              </svg>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span
                className={`text-[17px] font-semibold tracking-tight ${
                  isLight ? 'text-black' : 'text-white'
                }`}
              >
                Mahi Browser
              </span>
              <span
                className={`text-[10px] font-mono uppercase px-1.5 py-0.5 rounded border ${
                  isLight
                    ? 'bg-zinc-200/70 text-zinc-700 border-zinc-300'
                    : 'bg-zinc-800/80 text-zinc-400 border-zinc-700/50'
                }`}
              >
                v2.0
              </span>
            </div>
          </Link>
        </div>

        {/* NAVIGATION LINKS (CENTER: DEAD-CENTERED) */}
        <nav
          className={`hidden md:flex items-center gap-7 lg:gap-9 text-[14px] font-normal ${
            isLight ? 'text-zinc-600' : 'text-zinc-300'
          }`}
        >
          <Link
            href="/features"
            className={`transition-colors ${
              pathname === '/features' || pathname === '/product'
                ? isLight ? 'text-black font-semibold' : 'text-white font-semibold'
                : isLight ? 'hover:text-black' : 'hover:text-white'
            }`}
          >
            Features
          </Link>
          <Link
            href="/fingerprints"
            className={`transition-colors ${
              pathname === '/fingerprints' || pathname === '/fingerprint'
                ? isLight ? 'text-black font-semibold' : 'text-white font-semibold'
                : isLight ? 'hover:text-black' : 'hover:text-white'
            }`}
          >
            Fingerprints
          </Link>
          <Link
            href="/customers"
            className={`transition-colors ${
              pathname === '/customers'
                ? isLight ? 'text-black font-semibold' : 'text-white font-semibold'
                : isLight ? 'hover:text-black' : 'hover:text-white'
            }`}
          >
            Customers
          </Link>
          <Link
            href="/compare"
            className={`transition-colors ${
              pathname === '/compare' || (pathname ? pathname.startsWith('/compare') : false)
                ? isLight ? 'text-black font-semibold' : 'text-white font-semibold'
                : isLight ? 'hover:text-black' : 'hover:text-white'
            }`}
          >
            vs GoLogin
          </Link>
          <Link
            href="/pricing"
            className={`transition-colors ${
              pathname === '/pricing'
                ? isLight ? 'text-black font-semibold' : 'text-white font-semibold'
                : isLight ? 'hover:text-black' : 'hover:text-white'
            }`}
          >
            Pricing
          </Link>
          <Link
            href="/company"
            className={`transition-colors ${
              pathname === '/company' || pathname === '/about'
                ? isLight ? 'text-black font-semibold' : 'text-white font-semibold'
                : isLight ? 'hover:text-black' : 'hover:text-white'
            }`}
          >
            Company
          </Link>
          <Link
            href="/blog"
            className={`transition-colors ${
              pathname === '/blog' || (pathname ? pathname.startsWith('/blog') : false)
                ? isLight ? 'text-black font-semibold' : 'text-white font-semibold'
                : isLight ? 'hover:text-black' : 'hover:text-white'
            }`}
          >
            Blog
          </Link>
        </nav>

        {/* RIGHT CTA BUTTONS (RIGHT: MAX 25%) */}
        <div className="w-1/4 flex items-center justify-end gap-5">
          <Link
            href="/login"
            className={`hidden sm:inline-block text-[14px] font-medium transition-colors ${
              isLight ? 'text-zinc-700 hover:text-black' : 'text-zinc-300 hover:text-white'
            }`}
          >
            Sign In
          </Link>
          <Link
            href="/download"
            className={`hidden sm:inline-flex items-center justify-center px-5 py-2.5 rounded-full text-[13px] font-medium tracking-tight transition-all transform hover:scale-[1.02] ${
              isLight
                ? 'bg-black text-white hover:bg-zinc-800 shadow-sm'
                : 'bg-white text-black hover:bg-zinc-200 shadow-[0_0_20px_rgba(255,255,255,0.12)]'
            }`}
          >
            Download for Windows
          </Link>

          {/* Mobile Menu Toggle Button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className={`md:hidden rounded-lg p-2 ${
              isLight
                ? 'text-zinc-700 hover:bg-zinc-200 hover:text-black'
                : 'text-zinc-400 hover:bg-zinc-900 hover:text-white'
            }`}
            aria-label="Toggle navigation"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {mobileMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div
          className={`md:hidden px-6 pt-2 pb-6 border-b space-y-4 ${
            isLight
              ? 'bg-[#f9f9f9] border-black/10 text-black'
              : 'bg-[#030303] border-white/10 text-white'
          }`}
        >
          <Link
            href="/features"
            onClick={() => setMobileMenuOpen(false)}
            className={`block text-sm py-2 ${
              pathname === '/features' || pathname === '/product'
                ? 'font-semibold text-white'
                : 'hover:opacity-75'
            }`}
          >
            Features
          </Link>
          <Link
            href="/fingerprints"
            onClick={() => setMobileMenuOpen(false)}
            className={`block text-sm py-2 ${
              pathname === '/fingerprints' || pathname === '/fingerprint'
                ? 'font-semibold text-white'
                : 'hover:opacity-75'
            }`}
          >
            Fingerprints
          </Link>
          <Link
            href="/customers"
            onClick={() => setMobileMenuOpen(false)}
            className="block text-sm py-2 font-medium"
          >
            Customers
          </Link>
          <Link
            href="/compare"
            onClick={() => setMobileMenuOpen(false)}
            className="block text-sm py-2 font-medium"
          >
            vs GoLogin
          </Link>
          <Link
            href="/pricing"
            onClick={() => setMobileMenuOpen(false)}
            className="block text-sm py-2 hover:opacity-75"
          >
            Pricing
          </Link>
          <Link
            href="/company"
            onClick={() => setMobileMenuOpen(false)}
            className="block text-sm py-2 hover:opacity-75"
          >
            Company
          </Link>
          <Link
            href="/blog"
            onClick={() => setMobileMenuOpen(false)}
            className="block text-sm py-2 hover:opacity-75"
          >
            Blog
          </Link>
          <div className="pt-4 border-t border-black/10 flex flex-col gap-3">
            <Link
              href="/login"
              onClick={() => setMobileMenuOpen(false)}
              className="text-center py-2 text-sm"
            >
              Sign In
            </Link>
            <Link
              href="/download"
              onClick={() => setMobileMenuOpen(false)}
              className="text-center py-2.5 rounded-full bg-black text-white text-xs font-medium"
            >
              Download for Windows
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
