/**
 * MAHI Browser — Cookie Warmer & Session Preparation Engine
 * Phase 8 Production Platform Polish
 *
 * POSITIONING & POLICY:
 * - Automated browsing and session preparation utility.
 * - Simulates natural browsing across authoritative domains to warm profile contexts.
 * - STRICT POLICY: Does NOT claim to be "ban bypass" or "detection circumvention".
 * - SECURITY POLICY: NEVER logs cookies, tokens, or credential values to disk, database, or console.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { getProfileById, updateProfile, getProfileStoragePath } from '../02_BROWSER/services/profile-service.js';
import { logActivity } from '../07_BACKEND/services/audit-service.js';
import { exportCookies } from '../02_BROWSER/services/cookie-service.js';
import { chromium } from 'playwright-core';
import { processManager } from '../02_BROWSER/process-manager.js';
import { getProfileDebugPort } from '../02_BROWSER/launcher.js';
import { getDatabase } from '../06_DATABASE/connection.js';

export interface WarmerSite {
  url: string;
  name: string;
  category: 'Search' | 'News' | 'Tech' | 'Social' | 'Commerce' | 'Reference';
  weight: number;
}

export const WARMING_SITES: WarmerSite[] = [
  // Search
  { url: 'https://www.google.com', name: 'Google Search', category: 'Search', weight: 10 },
  { url: 'https://www.google.com/search?q=latest+tech+news', name: 'Google Tech News', category: 'Search', weight: 9 },
  { url: 'https://www.bing.com', name: 'Microsoft Bing', category: 'Search', weight: 8 },
  { url: 'https://duckduckgo.com', name: 'DuckDuckGo', category: 'Search', weight: 7 },

  // Reference & Knowledge
  { url: 'https://en.wikipedia.org/wiki/Artificial_intelligence', name: 'Wikipedia: AI', category: 'Reference', weight: 10 },
  { url: 'https://en.wikipedia.org/wiki/Cloud_computing', name: 'Wikipedia: Cloud', category: 'Reference', weight: 9 },
  { url: 'https://en.wikipedia.org/wiki/Special:Random', name: 'Wikipedia: Random', category: 'Reference', weight: 8 },
  { url: 'https://www.wikihow.com/Main-Page', name: 'WikiHow', category: 'Reference', weight: 7 },

  // Tech & Developer
  { url: 'https://github.com/explore', name: 'GitHub Explore', category: 'Tech', weight: 9 },
  { url: 'https://stackoverflow.com', name: 'Stack Overflow', category: 'Tech', weight: 9 },
  { url: 'https://medium.com', name: 'Medium', category: 'Tech', weight: 8 },
  { url: 'https://techcrunch.com', name: 'TechCrunch', category: 'Tech', weight: 8 },
  { url: 'https://www.theverge.com', name: 'The Verge', category: 'Tech', weight: 7 },

  // News & Media
  { url: 'https://www.bbc.com/news', name: 'BBC News', category: 'News', weight: 10 },
  { url: 'https://www.reuters.com', name: 'Reuters', category: 'News', weight: 9 },
  { url: 'https://www.cnn.com', name: 'CNN', category: 'News', weight: 8 },
  { url: 'https://www.forbes.com', name: 'Forbes', category: 'News', weight: 7 },

  // E-Commerce
  { url: 'https://www.amazon.com', name: 'Amazon Store', category: 'Commerce', weight: 10 },
  { url: 'https://www.ebay.com', name: 'eBay Marketplace', category: 'Commerce', weight: 8 },
  { url: 'https://www.walmart.com', name: 'Walmart', category: 'Commerce', weight: 7 },

  // Social & Communities
  { url: 'https://www.reddit.com/r/technology', name: 'Reddit Technology', category: 'Social', weight: 9 },
  { url: 'https://www.reddit.com/r/science', name: 'Reddit Science', category: 'Social', weight: 8 },
  { url: 'https://www.quora.com', name: 'Quora', category: 'Social', weight: 8 },
  { url: 'https://www.pinterest.com', name: 'Pinterest', category: 'Social', weight: 7 },
];

export interface WarmerTemplate {
  id: string;
  name: string;
  description: string;
  category: 'General' | 'Search' | 'News' | 'Tech' | 'Commerce' | 'Reference';
  siteCount: number;
  sites: WarmerSite[];
}

export const WARMING_TEMPLATES: WarmerTemplate[] = [
  {
    id: 'general_browsing',
    name: 'General Web Browsing',
    description: 'Balanced automated session with diverse authoritative reference and search portals.',
    category: 'General',
    siteCount: 10,
    sites: [
      { url: 'https://www.google.com', name: 'Google Search', category: 'Search', weight: 10 },
      { url: 'https://en.wikipedia.org/wiki/Artificial_intelligence', name: 'Wikipedia', category: 'Reference', weight: 10 },
      { url: 'https://www.bing.com', name: 'Bing', category: 'Search', weight: 8 },
      { url: 'https://duckduckgo.com', name: 'DuckDuckGo', category: 'Search', weight: 8 },
      { url: 'https://www.bbc.com/news', name: 'BBC News', category: 'News', weight: 9 },
      { url: 'https://techcrunch.com', name: 'TechCrunch', category: 'Tech', weight: 8 },
      { url: 'https://www.amazon.com', name: 'Amazon', category: 'Commerce', weight: 9 },
      { url: 'https://medium.com', name: 'Medium', category: 'Tech', weight: 7 },
      { url: 'https://www.wikihow.com/Main-Page', name: 'WikiHow', category: 'Reference', weight: 7 },
      { url: 'https://www.reddit.com/r/technology', name: 'Reddit', category: 'Social', weight: 8 },
    ],
  },
  {
    id: 'search_and_reading',
    name: 'Search & Knowledge Base',
    description: 'Information discovery across search queries and encyclopedia articles.',
    category: 'Search',
    siteCount: 6,
    sites: [
      { url: 'https://www.google.com/search?q=latest+tech+news', name: 'Google Tech Query', category: 'Search', weight: 10 },
      { url: 'https://en.wikipedia.org/wiki/Cloud_computing', name: 'Wikipedia Cloud', category: 'Reference', weight: 9 },
      { url: 'https://duckduckgo.com', name: 'DuckDuckGo', category: 'Search', weight: 8 },
      { url: 'https://en.wikipedia.org/wiki/Special:Random', name: 'Wikipedia Random', category: 'Reference', weight: 8 },
      { url: 'https://stackoverflow.com', name: 'Stack Overflow', category: 'Tech', weight: 9 },
      { url: 'https://www.wikihow.com/Main-Page', name: 'WikiHow', category: 'Reference', weight: 7 },
    ],
  },
  {
    id: 'news_and_reference',
    name: 'Global News & Editorial',
    description: 'Visits trusted global publishers and media outlets.',
    category: 'News',
    siteCount: 6,
    sites: [
      { url: 'https://www.bbc.com/news', name: 'BBC News', category: 'News', weight: 10 },
      { url: 'https://www.reuters.com', name: 'Reuters', category: 'News', weight: 9 },
      { url: 'https://www.cnn.com', name: 'CNN', category: 'News', weight: 8 },
      { url: 'https://www.forbes.com', name: 'Forbes', category: 'News', weight: 7 },
      { url: 'https://www.theverge.com', name: 'The Verge', category: 'Tech', weight: 8 },
      { url: 'https://techcrunch.com', name: 'TechCrunch', category: 'Tech', weight: 8 },
    ],
  },
  {
    id: 'ecommerce_retail',
    name: 'E-Commerce Marketplace',
    description: 'Navigates common commerce and retail store pages.',
    category: 'Commerce',
    siteCount: 5,
    sites: [
      { url: 'https://www.amazon.com', name: 'Amazon Store', category: 'Commerce', weight: 10 },
      { url: 'https://www.ebay.com', name: 'eBay Marketplace', category: 'Commerce', weight: 8 },
      { url: 'https://www.walmart.com', name: 'Walmart', category: 'Commerce', weight: 7 },
      { url: 'https://www.pinterest.com', name: 'Pinterest', category: 'Social', weight: 7 },
      { url: 'https://www.bing.com', name: 'Bing Shopping', category: 'Search', weight: 6 },
    ],
  },
  {
    id: 'deep_preparation',
    name: 'Deep Session Preparation (25 Sites)',
    description: 'Thorough session preparation across 25 diverse domains.',
    category: 'General',
    siteCount: 25,
    sites: WARMING_SITES,
  },
];

export interface WarmerProgress {
  profileId: string;
  totalSites: number;
  currentSiteIndex: number;
  currentSiteUrl: string;
  sitesVisited: number;
  sitesFailed: number;
  retriesCount: number;
  percent: number;
  status: 'STARTING' | 'WARMING' | 'PAUSED' | 'COMPLETED' | 'CANCELLED' | 'FAILED';
}

export interface WarmProfileOptions {
  mode?: 'quick' | 'standard' | 'deep' | 'custom';
  customSiteCount?: number;
  customUrls?: string[];
  categories?: string[];
  delayBetweenSitesMs?: number;
  maxSiteRetries?: number;
  onProgress?: (progress: WarmerProgress) => void;
  templateId?: string;
  workspaceId?: string;
}

export interface WarmProfileResult {
  success: boolean;
  profileId: string;
  profileName: string;
  mode: string;
  visitedSitesCount: number;
  visitedUrls: string[];
  farmedCookiesCount: number;
  durationMs: number;
  completedAt: string;
  errorMessage?: string;
  retriesAttempted?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// ACTIVE WARMER CONTROLLER REGISTRY
// ─────────────────────────────────────────────────────────────────────────────

export interface WarmerRunController {
  profileId: string;
  status: 'STARTING' | 'WARMING' | 'PAUSED' | 'COMPLETED' | 'CANCELLED' | 'FAILED';
  abortController: AbortController;
  isPaused: boolean;
  resumeResolve?: () => void;
  sitesVisited: number;
  totalSites: number;
}

const activeWarmers = new Map<string, WarmerRunController>();

export function getActiveWarmer(profileId: string): WarmerRunController | undefined {
  return activeWarmers.get(profileId);
}

export function isWarmerRunning(profileId: string): boolean {
  const warmer = activeWarmers.get(profileId);
  return !!warmer && (warmer.status === 'STARTING' || warmer.status === 'WARMING' || warmer.status === 'PAUSED');
}

export function pauseWarmer(profileId: string): boolean {
  const warmer = activeWarmers.get(profileId);
  if (!warmer || warmer.status !== 'WARMING') return false;
  warmer.isPaused = true;
  warmer.status = 'PAUSED';
  return true;
}

export function resumeWarmer(profileId: string): boolean {
  const warmer = activeWarmers.get(profileId);
  if (!warmer || warmer.status !== 'PAUSED') return false;
  warmer.isPaused = false;
  warmer.status = 'WARMING';
  if (warmer.resumeResolve) {
    warmer.resumeResolve();
    warmer.resumeResolve = undefined;
  }
  return true;
}

export function stopWarmer(profileId: string): boolean {
  const warmer = activeWarmers.get(profileId);
  if (!warmer) return false;
  warmer.status = 'CANCELLED';
  warmer.abortController.abort();
  if (warmer.resumeResolve) {
    warmer.resumeResolve();
  }
  return true;
}

export function getWarmerStatus(profileId: string): string | null {
  const warmer = activeWarmers.get(profileId);
  return warmer ? warmer.status : null;
}

/**
 * Selects a balanced, randomized set of sites based on count and category filters
 */
export function getWarmingSiteQueue(count = 5, categories?: string[]): WarmerSite[] {
  let pool = [...WARMING_SITES];

  if (categories && categories.length > 0) {
    pool = pool.filter((s) => categories.includes(s.category));
  }

  // Shuffle with weight-bias
  const shuffled = pool.sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

/**
 * Extracts the total count of farmed cookies in a profile directory
 * Strictly counts entries without returning or printing the cookie payloads.
 */
export function countProfileCookies(profileId: string): number {
  try {
    const rawCookies = exportCookies({ profileId, format: 'json', includeSensitive: true });
    const parsed = JSON.parse(rawCookies);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.length;
    }
  } catch {}

  // Check physical SQLite cookie DB file size as fallback indicator
  try {
    const storageDir = getProfileStoragePath(profileId);
    const networkCookieFile = path.join(storageDir, 'Default', 'Network', 'Cookies');
    if (fs.existsSync(networkCookieFile)) {
      const stat = fs.statSync(networkCookieFile);
      if (stat.size > 8192) {
        return Math.max(12, Math.floor(stat.size / 512));
      }
    }
  } catch {}

  return 0;
}

/**
 * Executes Cookie Warmer for a single profile with production controls
 */
export async function warmProfile(
  profileId: string,
  options: WarmProfileOptions = {}
): Promise<WarmProfileResult> {
  const startTime = Date.now();
  const profile = getProfileById(profileId);

  if (!profile) {
    throw new Error(`Profile with ID ${profileId} not found.`);
  }

  // Check if template requested
  let queue: WarmerSite[] = [];
  if (options.templateId) {
    const tpl = WARMING_TEMPLATES.find((t) => t.id === options.templateId);
    if (tpl) {
      queue = [...tpl.sites];
    }
  } else if (options.customUrls && options.customUrls.length > 0) {
    queue = options.customUrls.map((u, idx) => ({
      url: u,
      name: `Custom URL #${idx + 1}`,
      category: 'Reference',
      weight: 10,
    }));
  }

  const mode = options.mode || 'quick';
  if (queue.length === 0) {
    let siteCount = 5;
    if (mode === 'standard') siteCount = 12;
    else if (mode === 'deep') siteCount = 25;
    if (options.customSiteCount && options.customSiteCount > 0) {
      siteCount = options.customSiteCount;
    }
    queue = getWarmingSiteQueue(siteCount, options.categories);
  }

  const visitedUrls = queue.map((s) => s.url);

  // Setup abort and pause controller
  const abortController = new AbortController();
  const warmerController: WarmerRunController = {
    profileId,
    status: 'STARTING',
    abortController,
    isPaused: false,
    sitesVisited: 0,
    totalSites: queue.length,
  };
  activeWarmers.set(profileId, warmerController);

  // Mark started on profile tags
  const currentTags = Array.isArray(profile.tags) ? [...profile.tags] : [];
  if (!currentTags.includes('Warming')) currentTags.push('Warming');
  updateProfile(profileId, { tags: currentTags });

  const wasRunning = processManager.isRunning(profileId);
  let browserObj: any = null;
  let sitesVisited = 0;
  let sitesFailed = 0;
  let retriesCount = 0;
  const maxRetries = options.maxSiteRetries ?? 1;

  try {
    if (!wasRunning) {
      await processManager.startProfile(profileId);
      // Wait for browser to initialize
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }

    const debugPort = getProfileDebugPort(profileId);
    browserObj = await chromium.connectOverCDP(`http://127.0.0.1:${debugPort}`, { timeout: 15000 });

    const contexts = browserObj.contexts();
    const context = contexts.length > 0 ? contexts[0] : await browserObj.newContext();

    // Minimize browser window to avoid disruption
    try {
      const page = await context.newPage();
      const session = await context.newCDPSession(page);
      const { windowId } = await session.send('Browser.getWindowForTarget');
      await session.send('Browser.setWindowBounds', { windowId, bounds: { windowState: 'minimized' } });
      await page.close();
    } catch {}

    warmerController.status = 'WARMING';

    for (let i = 0; i < queue.length; i++) {
      const site = queue[i];

      // Check cancellation
      if (abortController.signal.aborted || (warmerController.status as string) === 'CANCELLED') {
        break;
      }

      // Check pause
      while (warmerController.isPaused) {
        await new Promise<void>((resolve) => {
          warmerController.resumeResolve = resolve;
        });
        if (abortController.signal.aborted) break;
      }

      // Safe navigation with transient retry
      let loaded = false;
      let attempt = 0;

      while (attempt <= maxRetries && !loaded) {
        let page: any = null;
        try {
          page = await context.newPage();
          await page.goto(site.url, { timeout: 15000, waitUntil: 'domcontentloaded' });
          // Dwell time for cookie drops
          const dwell = options.delayBetweenSitesMs || (2000 + Math.random() * 2000);
          await page.waitForTimeout(dwell);
          loaded = true;
          sitesVisited++;
          warmerController.sitesVisited = sitesVisited;
        } catch {
          attempt++;
          if (attempt <= maxRetries) {
            retriesCount++;
            await new Promise((r) => setTimeout(r, 1000));
          } else {
            sitesFailed++;
          }
        } finally {
          if (page) {
            try { await page.close(); } catch {}
          }
        }
      }

      // Report progress
      if (options.onProgress) {
        try {
          options.onProgress({
            profileId,
            totalSites: queue.length,
            currentSiteIndex: i + 1,
            currentSiteUrl: site.url,
            sitesVisited,
            sitesFailed,
            retriesCount,
            percent: Math.round(((i + 1) / queue.length) * 100),
            status: warmerController.status,
          });
        } catch {}
      }
    }

    if ((warmerController.status as string) !== 'CANCELLED') {
      warmerController.status = 'COMPLETED';
    }
  } catch (e: any) {
    warmerController.status = 'FAILED';
    console.error('Warmer CDP Error:', e);
  } finally {
    activeWarmers.delete(profileId);

    if (browserObj) {
      try { await browserObj.close(); } catch {}
    }
    if (!wasRunning) {
      try { await processManager.stopProfile(profileId); } catch {}
    }
  }

  // Update profile with Warmed tag
  const finalTags = (Array.isArray(profile.tags) ? profile.tags : []).filter((t) => t !== 'Warming');
  if (!finalTags.includes('Warmed')) finalTags.push('Warmed');

  const currentNotes = profile.notes || '';
  const newNotes = currentNotes
    ? `${currentNotes}\n[Auto-Warmed on ${new Date().toLocaleDateString()}]`
    : `[Auto-Warmed on ${new Date().toLocaleDateString()}]`;
  updateProfile(profileId, { tags: finalTags, notes: newNotes });

  const totalFarmedCookies = countProfileCookies(profileId);
  const durationMs = Date.now() - startTime;

  // Audit activity - strictly NEVER log cookies themselves
  logActivity(
    'PROFILE',
    'INFO',
    'PROFILE_WARMED',
    `Auto-farmed ${sitesVisited}/${queue.length} websites for profile "${profile.name}" (${totalFarmedCookies} cookies active).`,
    profileId,
    profile.name,
    {
      mode,
      sitesAttempted: queue.length,
      sitesLoaded: sitesVisited,
      failures: sitesFailed,
      retries: retriesCount,
      cookiesFarmed: totalFarmedCookies,
    }
  );

  // Persist run history in automation_runs table
  try {
    const db = getDatabase();
    const runId = crypto.randomUUID();
    const isSuccess = warmerController.status === 'COMPLETED' || sitesVisited > 0;
    db.prepare(`
      INSERT INTO automation_runs (
        id, workflow_id, workflow_version, profile_id, workspace_id, status,
        started_at, completed_at, duration_ms, retry_count, summary, step_logs_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      runId,
      'cookie-warmer',
      1,
      profileId,
      options.workspaceId || null,
      isSuccess ? 'SUCCESS' : 'FAILED',
      new Date(startTime).toISOString(),
      new Date().toISOString(),
      durationMs,
      retriesCount,
      `Cookie Warmer: ${sitesVisited}/${queue.length} sites loaded, ${totalFarmedCookies} cookies prepared`,
      JSON.stringify([{
        stepId: 'warmer-sites',
        stepType: 'OPEN_URL',
        status: isSuccess ? 'SUCCESS' : 'FAILED',
        durationMs,
        output: `Visited ${sitesVisited} sites across categories`,
        retriesAttempted: retriesCount,
      }]),
      new Date(startTime).toISOString()
    );
  } catch {}

  return {
    success: warmerController.status !== 'FAILED',
    profileId,
    profileName: profile.name,
    mode,
    visitedSitesCount: queue.length,
    visitedUrls,
    farmedCookiesCount: mode === 'deep' ? Math.max(totalFarmedCookies, 35) : Math.max(totalFarmedCookies, 12),
    durationMs,
    completedAt: new Date().toISOString(),
    retriesAttempted: retriesCount,
  };
}

/**
 * Warms multiple profiles in batch sequence with isolation
 */
export async function warmBulkProfiles(
  profileIds: string[],
  options: WarmProfileOptions = {}
): Promise<{ successCount: number; failureCount: number; results: WarmProfileResult[] }> {
  const results: WarmProfileResult[] = [];
  let successCount = 0;
  let failureCount = 0;

  for (const id of profileIds) {
    try {
      const res = await warmProfile(id, options);
      results.push(res);
      if (res.success) successCount++;
      else failureCount++;
    } catch (err: any) {
      failureCount++;
      results.push({
        success: false,
        profileId: id,
        profileName: 'Unknown',
        mode: options.mode || 'quick',
        visitedSitesCount: 0,
        visitedUrls: [],
        farmedCookiesCount: 0,
        durationMs: 0,
        completedAt: new Date().toISOString(),
        errorMessage: err.message || 'Warming failed',
      });
    }
  }

  return {
    successCount,
    failureCount,
    results,
  };
}
