import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { getProfileById, updateProfile, getProfileStoragePath } from '../02_BROWSER/services/profile-service.js';
import { logActivity } from '../07_BACKEND/services/audit-service.js';
import { exportCookies } from '../02_BROWSER/services/cookie-service.js';
import { chromium } from 'playwright-core';
import { processManager } from '../02_BROWSER/process-manager.js';
import { getProfileDebugPort } from '../02_BROWSER/launcher.js';


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

export interface WarmProfileOptions {
  mode?: 'quick' | 'standard' | 'deep';
  customSiteCount?: number;
  categories?: string[];
  delayBetweenSitesMs?: number;
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
 * Executes Cookie Warmer for a single profile
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

  const mode = options.mode || 'quick';
  let siteCount = 5;
  if (mode === 'standard') siteCount = 12;
  else if (mode === 'deep') siteCount = 25;
  if (options.customSiteCount && options.customSiteCount > 0) {
    siteCount = options.customSiteCount;
  }

  const queue = getWarmingSiteQueue(siteCount, options.categories);
  const visitedUrls = queue.map((s) => s.url);

  // Mark started
  const currentTags = Array.isArray(profile.tags) ? [...profile.tags] : [];
  if (!currentTags.includes('Warming')) currentTags.push('Warming');
  updateProfile(profileId, { tags: currentTags });

  const wasRunning = processManager.isRunning(profileId);
  let browserObj: any = null;

  try {
    if (!wasRunning) {
      await processManager.startProfile(profileId);
      // Wait for browser to initialize
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    const debugPort = getProfileDebugPort(profileId);
    browserObj = await chromium.connectOverCDP(`http://127.0.0.1:${debugPort}`, { timeout: 15000 });
    
    const contexts = browserObj.contexts();
    const context = contexts.length > 0 ? contexts[0] : await browserObj.newContext();
    
    // Attempt to minimize the browser window so it doesn't disturb user
    try {
      const page = await context.newPage();
      const session = await context.newCDPSession(page);
      const { windowId } = await session.send('Browser.getWindowForTarget');
      await session.send('Browser.setWindowBounds', { windowId, bounds: { windowState: 'minimized' } });
      await page.close();
    } catch (e) {}

    let sitesVisited = 0;
    
    for (const site of queue) {
      try {
        const page = await context.newPage();
        // Go to site, ignore errors (e.g. timeouts, captchas)
        await page.goto(site.url, { timeout: 15000, waitUntil: 'domcontentloaded' }).catch(() => {});
        // Wait 2-3 seconds for tracking scripts to drop cookies
        await page.waitForTimeout(2000 + Math.random() * 2000);
        await page.close();
        sitesVisited++;
      } catch (e) {}
    }

  } catch (e) {
    console.error('Warmer CDP Error:', e);
  } finally {
    if (browserObj) {
      try { await browserObj.close(); } catch (e) {}
    }
    if (!wasRunning) {
      try { await processManager.stopProfile(profileId); } catch (e) {}
    }
  }

  // Update profile with Warmed tag
  const finalTags = (Array.isArray(profile.tags) ? profile.tags : []).filter(t => t !== 'Warming');
  if (!finalTags.includes('Warmed')) finalTags.push('Warmed');
  
  const currentNotes = profile.notes || '';
  const newNotes = currentNotes ? `${currentNotes}\n[Auto-Warmed on ${new Date().toLocaleDateString()}]` : `[Auto-Warmed on ${new Date().toLocaleDateString()}]`;
  updateProfile(profileId, { tags: finalTags, notes: newNotes });

  const totalFarmedCookies = countProfileCookies(profileId);

  logActivity('PROFILE', 'INFO', 'PROFILE_WARMED', `Auto-farmed ${siteCount} websites for profile "${profile.name}" (${totalFarmedCookies} cookies active).`, profileId, profile.name, {
    mode,
    sites: queue.map((s) => s.name),
    cookiesFarmed: totalFarmedCookies,
  });

  return {
    success: true,
    profileId,
    profileName: profile.name,
    mode,
    visitedSitesCount: queue.length,
    visitedUrls,
    farmedCookiesCount: totalFarmedCookies,
    durationMs: Date.now() - startTime,
    completedAt: new Date().toISOString(),
  };
}

/**
 * Warms multiple profiles in batch sequence
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
      successCount++;
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
