import React from 'react';
import { Loader2 } from 'lucide-react';

interface PageLoadingFallbackProps {
  fullScreen?: boolean;
  label?: string;
}

/** Lightweight Suspense boundary fallback for lazy-loaded views and entries. */
export const PageLoadingFallback: React.FC<PageLoadingFallbackProps> = ({
  fullScreen = false,
  label = 'Loading view...',
}) => (
  <div
    className={`${
      fullScreen ? 'h-screen w-screen' : 'h-full w-full min-h-[240px]'
    } flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 font-sans select-none`}
    role="status"
    aria-live="polite"
  >
    <Loader2 className="w-6 h-6 animate-spin text-teal-500 mb-2.5" />
    <span className="text-xs font-medium tracking-wide">{label}</span>
  </div>
);
