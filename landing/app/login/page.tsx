'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { BRAND } from '../../lib/brand';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg(null);

    try {
      const resp = await fetch(`${BRAND.apiUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await resp.json().catch(() => ({}));
      if (resp.ok && data.token) {
        localStorage.setItem('mahi_auth_token', data.token);
        localStorage.setItem('mahi_access_token', data.token);
        window.location.href = `${BRAND.appUrl}/overview?token=${data.token}`;
      } else {
        setErrorMsg(data.message || data.error || 'Invalid credentials. Please verify your email and password.');
      }
    } catch {
      setErrorMsg('Network error connecting to MAHI Cloud Auth Gateway.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleOAuth = () => {
    window.location.href = `${BRAND.apiUrl}/api/v1/auth/google/start?redirect_uri=${encodeURIComponent(
      `${BRAND.website}/download`
    )}`;
  };

  return (
    <div className="mx-auto flex min-h-[75vh] max-w-md items-center justify-center px-4 py-12">
      <div className="w-full space-y-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-6 sm:p-8 backdrop-blur-md shadow-2xl">
        <div className="text-center space-y-2">
          <Link href="/" className="inline-block brand-logo-clean">
            <img
              src={BRAND.assets.logo}
              alt="MAHI Browser"
              width={48}
              height={48}
              draggable={false}
              className="mx-auto h-12 w-12 rounded-xl object-contain select-none"
              style={{ userSelect: 'none' }}
            />
          </Link>
          <h1 className="text-2xl font-extrabold text-white">Sign In to MAHI Cloud</h1>
          <p className="text-xs text-slate-400">
            Access your encrypted browser profiles, team workspaces, and automation pipelines.
          </p>
        </div>

        {errorMsg && (
          <div className="rounded-lg border border-red-800/60 bg-red-950/40 p-3 text-xs text-red-300">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Email Address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@agency.com"
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:border-red-500 focus:outline-none"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-slate-300">
                Password
              </label>
              <Link href="/book-demo" className="text-[11px] text-red-400 hover:text-red-300">
                Forgot password?
              </Link>
            </div>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:border-red-500 focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-lg bg-red-600 py-2.5 text-xs sm:text-sm font-bold text-white transition hover:bg-red-500 disabled:opacity-50"
          >
            {isLoading ? 'Signing In...' : 'Sign In'}
          </button>
        </form>

        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-800" />
          </div>
          <div className="relative flex justify-center text-[10px] uppercase">
            <span className="bg-slate-900 px-2 text-slate-400">Or continue with</span>
          </div>
        </div>

        <button
          onClick={handleGoogleOAuth}
          type="button"
          className="w-full flex items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-950 py-2.5 text-xs font-semibold text-slate-200 transition hover:bg-slate-800 hover:text-white"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          Google Workspace OAuth
        </button>

        <p className="text-center text-xs text-slate-400">
          Don&apos;t have an account?{' '}
          <Link href="/signup" className="font-semibold text-red-400 hover:text-red-300">
            Create account
          </Link>
        </p>
      </div>
    </div>
  );
}
