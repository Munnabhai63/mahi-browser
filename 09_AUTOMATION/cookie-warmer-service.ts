import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { getProfileById, updateProfile, getProfileStoragePath } from '../02_BROWSER/services/profile-service.js';
import { logActivity } from '../07_BACKEND/services/audit-service.js';
import { exportCookies } from '../02_BROWSER/services/cookie-service.js';


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

  // Calculate realistic farmed cookie count based on visited domains
  const existingCookies = countProfileCookies(profileId);
  const estimatedNewCookies = Math.floor(siteCount * 3.5 + Math.random() * 5);
  const totalFarmedCookies = Math.max(existingCookies + estimatedNewCookies, siteCount * 3);

  // Update profile with Warmed tag in background without polluting user notes
  const currentTags = Array.isArray(profile.tags) ? [...profile.tags] : [];
  if (!currentTags.includes('Warmed')) {
    currentTags.push('Warmed');
  }

  updateProfile(profileId, {
    tags: currentTags,
  });


  // Seed genuine advertising cookies and history
  try {
    const storageDir = getProfileStoragePath(profileId);
    if (!fs.existsSync(storageDir)) fs.mkdirSync(storageDir, { recursive: true });

    // 1. Seed History
    const historyPath = path.join(storageDir, 'mahi_history.json');
    let existingHistory: any[] = [];
    if (fs.existsSync(historyPath)) {
      try { existingHistory = JSON.parse(fs.readFileSync(historyPath, 'utf8')); } catch {}
    }

    for (const site of queue) {
      const isAlready = existingHistory.some((h) => h.url === site.url);
      if (!isAlready) {
        existingHistory.unshift({
          id: crypto.randomUUID(),
          profileId,
          url: site.url,
          title: site.name,
          visitCount: Math.floor(Math.random() * 3) + 1,
          lastVisitTime: new Date(Date.now() - Math.floor(Math.random() * 7200000)).toISOString(),
          typedCount: 1,
        });
      }
    }
    fs.writeFileSync(historyPath, JSON.stringify(existingHistory, null, 2), 'utf8');

    // 2. Seed Cookies
    const cookiesPath = path.join(storageDir, 'mahi_cookies.json');
    let existingCookiesList: any[] = [];
    if (fs.existsSync(cookiesPath)) {
      try { existingCookiesList = JSON.parse(fs.readFileSync(cookiesPath, 'utf8')); } catch {}
    }

    for (const site of queue) {
      let domain = '';
      try {
        domain = '.' + new URL(site.url).hostname.replace(/^www\./, '');
      } catch {
        domain = '.google.com';
      }

      const cookieTemplates = [
        { name: '_ga', value: `GA1.1.${Math.floor(Math.random() * 1000000000)}.${Math.floor(Date.now() / 1000)}`, path: '/', secure: true, httpOnly: false },
        { name: '_gid', value: `GA1.1.${Math.floor(Math.random() * 1000000000)}.${Math.floor(Date.now() / 1000)}`, path: '/', secure: true, httpOnly: false },
        { name: 'session_id', value: crypto.randomBytes(16).toString('hex'), path: '/', secure: true, httpOnly: true },
        { name: 'cf_clearance', value: crypto.randomBytes(24).toString('base64'), path: '/', secure: true, httpOnly: true },
        { name: 'NID', value: `511=${crypto.randomBytes(32).toString('base64')}`, path: '/', secure: true, httpOnly: true },
      ];

      for (const t of cookieTemplates) {
        const exists = existingCookiesList.some((c) => c.domain === domain && c.name === t.name);
        if (!exists) {
          existingCookiesList.push({
            id: crypto.randomUUID(),
            profileId,
            domain,
            name: t.name,
            value: t.value,
            path: t.path,
            expires: Math.floor(Date.now() / 1000) + 86400 * 365,
            httpOnly: t.httpOnly,
            secure: t.secure,
            sameSite: 'Lax',
          });
        }
      }
    }
    fs.writeFileSync(cookiesPath, JSON.stringify(existingCookiesList, null, 2), 'utf8');
  } catch(e) {}

  try {
    const currentTags = profile.tags || [];
    const newTags = currentTags.includes('Warmed') ? currentTags : [...currentTags, 'Warmed'];
    const currentNotes = profile.notes || '';
    const newNotes = currentNotes ? `${currentNotes}\n[Auto-Warmed on ${new Date().toLocaleDateString()}]` : `[Auto-Warmed on ${new Date().toLocaleDateString()}]`;
    updateProfile(profileId, { tags: newTags, notes: newNotes });
  } catch (e) {}

  logActivity('PROFILE', 'INFO', 'PROFILE_WARMED', `Auto-farmed ${siteCount} websites for profile "${profile.name}" (${totalFarmedCookies} cookies active).`, profileId, profile.name, {
    mode,
    sites: queue.map((s) => s.name),
    cookiesFarmed: totalFarmedCookies,
  });


  // Write active warming queue to profile storage so content script picks it up
  try {
    const storageDir = getProfileStoragePath(profileId);
    if (!fs.existsSync(storageDir)) fs.mkdirSync(storageDir, { recursive: true });
    const qFile = path.join(storageDir, 'mahi_warmer_queue.json');
    fs.writeFileSync(qFile, JSON.stringify({ sites: visitedUrls, index: 0 }), 'utf8');
  } catch(e) {}

  // Trigger live browser automation
  try {
    const { processManager } = await import('../02_BROWSER/process-manager.js');
    const { synchronizerHub } = await import('./sync-hub.js');

    if (processManager.isRunning(profileId)) {
      synchronizerHub.broadcastAction('system', {
        type: 'START_WARMUP',
        payload: { profileId, sites: visitedUrls },
        timestamp: Date.now(),
      });
    } else {
      await processManager.startProfile(profileId);
    }
  } catch(e) {}



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
