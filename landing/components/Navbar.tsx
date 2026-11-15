'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { BRAND } from '../lib/brand';

export default function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <Link href="/" className="brand-logo-clean flex items-center gap-3 transition-opacity hover:opacity-90">
          <img
            src={BRAND.assets.logo}
            alt="MAHI Browser Logo"
            width={38}
            height={38}
            draggable={false}
            className="h-9 w-9 rounded-lg object-contain select-none"
            style={{ userSelect: 'none' }}
          />
          <div className="flex flex-col">
            <span className="font-bold text-lg leading-tight tracking-tight text-white flex items-center gap-1.5">
              MAHI <span className="text-red-500 font-extrabold">Browser</span>
              <span className="rounded bg-red-950/60 px-1.5 py-0.5 text-[10px] font-semibold text-red-400 border border-red-800/50">v{BRAND.version}</span>
            </span>
            <span className="text-[10px] text-slate-400 tracking-wider uppercase font-medium">Dual-Engine Anti-Detect</span>
          </div>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-300">
          <Link href="/#features" className="transition hover:text-red-400">Features</Link>
          <Link href="/#dual-engine" className="transition hover:text-red-400">Dual Engine</Link>
          <Link href="/pricing" className="transition hover:text-red-400">Pricing</Link>
          <Link href="/compare/gologin-alternative" className="transition hover:text-red-400">vs GoLogin</Link>
          <Link href="/docs" className="transition hover:text-red-400">Docs</Link>
          <Link href="/blog" className="transition hover:text-red-400">Blog</Link>
        </nav>

        {/* Right CTA */}
        <div className="hidden sm:flex items-center gap-3">
          <Link
            href="/login"
            className="rounded-lg px-3.5 py-2 text-sm font-medium text-slate-300 transition hover:bg-slate-800 hover:text-white"
          >
            Sign In
          </Link>
          <Link
            href="/download"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-red-600 to-rose-700 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-red-900/30 transition hover:from-red-500 hover:to-rose-600 focus:outline-none focus:ring-2 focus:ring-red-500/50 active:scale-[0.98]"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download Free
          </Link>
        </div>

        {/* Mobile menu button */}
        <button
          type="button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white"
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

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-slate-800 bg-slate-950 px-4 pt-2 pb-6 space-y-3">
          <Link href="/#features" onClick={() => setMobileMenuOpen(false)} className="block py-2 text-sm font-medium text-slate-200">Features</Link>
          <Link href="/#dual-engine" onClick={() => setMobileMenuOpen(false)} className="block py-2 text-sm font-medium text-slate-200">Dual Engine</Link>
          <Link href="/pricing" onClick={() => setMobileMenuOpen(false)} className="block py-2 text-sm font-medium text-slate-200">Pricing</Link>
          <Link href="/compare/gologin-alternative" onClick={() => setMobileMenuOpen(false)} className="block py-2 text-sm font-medium text-slate-200">vs GoLogin</Link>
          <Link href="/docs" onClick={() => setMobileMenuOpen(false)} className="block py-2 text-sm font-medium text-slate-200">Documentation</Link>
          <Link href="/blog" onClick={() => setMobileMenuOpen(false)} className="block py-2 text-sm font-medium text-slate-200">Technical Blog</Link>
          <div className="pt-2 flex flex-col gap-2">
            <Link href="/login" onClick={() => setMobileMenuOpen(false)} className="w-full text-center rounded-lg border border-slate-800 py-2.5 text-sm font-medium text-slate-200">Sign In</Link>
            <Link href="/download" onClick={() => setMobileMenuOpen(false)} className="w-full text-center rounded-lg bg-red-600 py-2.5 text-sm font-semibold text-white">Download MAHI Browser</Link>
          </div>
        </div>
      )}
    </header>
  );
}
