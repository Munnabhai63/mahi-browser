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

  return (
    <header className="fixed top-0 left-0 right-0 z-50 transition-all duration-300 bg-transparent">
      <div className="w-full max-w-[1920px] mx-auto px-6 sm:px-10 lg:px-12 py-5 flex items-center justify-between">
        
        {/* BRAND LOGO (LEFT: MAX 25%) */}
        <div className="w-1/4 flex items-center justify-start">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-700/60 flex items-center justify-center p-1.5 shadow-sm group-hover:border-zinc-500 transition-colors">
              <svg className="w-full h-full text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-white text-[17px] font-semibold tracking-tight">Mahi Browser</span>
              <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-zinc-800/80 text-zinc-400 border border-zinc-700/50">v2.0</span>
            </div>
          </Link>
        </div>

        {/* NAVIGATION LINKS (CENTER: DEAD-CENTERED) */}
        <nav className="hidden md:flex items-center gap-8 lg:gap-10 text-[14px] text-zinc-300 font-normal">
          <Link href="/#features" className="hover:text-white transition-colors">Features</Link>
          <Link href="/#fingerprints" className="hover:text-white transition-colors">Fingerprints</Link>
          <Link href="/#proxy" className="hover:text-white transition-colors">Proxy Engine</Link>
          <Link href="/pricing" className="hover:text-white transition-colors">Pricing</Link>
          <Link href="/docs" className="hover:text-white transition-colors">Documentation</Link>
        </nav>

        {/* RIGHT CTA BUTTONS (RIGHT: MAX 25%) */}
        <div className="w-1/4 flex items-center justify-end gap-5">
          <Link href="/login" className="hidden sm:inline-block text-[14px] text-zinc-300 hover:text-white transition-colors font-medium">
            Sign In
          </Link>
          <Link
            href="/download"
            className="hidden sm:inline-flex items-center justify-center px-5 py-2.5 rounded-full bg-white text-black text-[13px] font-medium tracking-tight hover:bg-zinc-200 transition-all transform hover:scale-[1.02] shadow-[0_0_20px_rgba(255,255,255,0.12)]"
          >
            Download for Windows
          </Link>

          {/* Mobile Menu Toggle Button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden rounded-lg p-2 text-zinc-400 hover:bg-zinc-900 hover:text-white"
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

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-zinc-800 bg-[#050505]/95 backdrop-blur-2xl px-6 pt-2 pb-6 space-y-3">
          <Link href="/#features" onClick={() => setMobileMenuOpen(false)} className="block py-2 text-sm font-medium text-zinc-300 hover:text-white">Features</Link>
          <Link href="/#fingerprints" onClick={() => setMobileMenuOpen(false)} className="block py-2 text-sm font-medium text-zinc-300 hover:text-white">Fingerprints</Link>
          <Link href="/#proxy" onClick={() => setMobileMenuOpen(false)} className="block py-2 text-sm font-medium text-zinc-300 hover:text-white">Proxy Engine</Link>
          <Link href="/pricing" onClick={() => setMobileMenuOpen(false)} className="block py-2 text-sm font-medium text-zinc-300 hover:text-white">Pricing</Link>
          <Link href="/docs" onClick={() => setMobileMenuOpen(false)} className="block py-2 text-sm font-medium text-zinc-300 hover:text-white">Documentation</Link>
          <div className="pt-2 flex flex-col gap-2">
            <Link href="/login" onClick={() => setMobileMenuOpen(false)} className="w-full text-center rounded-lg border border-zinc-800 py-2.5 text-sm font-medium text-zinc-300">Sign In</Link>
            <Link href="/download" onClick={() => setMobileMenuOpen(false)} className="w-full text-center rounded-lg bg-white text-black py-2.5 text-sm font-semibold">Download for Windows</Link>
          </div>
        </div>
      )}
    </header>
  );
}
