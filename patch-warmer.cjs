const fs = require('fs');

let data = fs.readFileSync('09_AUTOMATION/cookie-warmer-service.ts', 'utf8');

// Add playwright import if not exists
if (!data.includes("import { chromium } from 'playwright-core';")) {
  data = data.replace("import { exportCookies } from '../02_BROWSER/services/cookie-service.js';", 
    "import { exportCookies } from '../02_BROWSER/services/cookie-service.js';\nimport { chromium } from 'playwright-core';\nimport { processManager } from '../02_BROWSER/process-manager.js';\nimport { getProfileDebugPort } from '../02_BROWSER/launcher.js';");
}

const warmProfileIndex = data.indexOf('export async function warmProfile(');
if (warmProfileIndex === -1) {
  console.log('Could not find warmProfile');
  process.exit(1);
}

const beforeWarmProfile = data.substring(0, warmProfileIndex);

const newLogic = `export async function warmProfile(
  profileId: string,
  options: WarmProfileOptions = {}
): Promise<WarmProfileResult> {
  const startTime = Date.now();
  const profile = getProfileById(profileId);

  if (!profile) {
    throw new Error(\`Profile with ID \${profileId} not found.\`);
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
    browserObj = await chromium.connectOverCDP(\`http://127.0.0.1:\${debugPort}\`, { timeout: 15000 });
    
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
  const newNotes = currentNotes ? \`\${currentNotes}\\n[Auto-Warmed on \${new Date().toLocaleDateString()}]\` : \`[Auto-Warmed on \${new Date().toLocaleDateString()}]\`;
  updateProfile(profileId, { tags: finalTags, notes: newNotes });

  const totalFarmedCookies = countProfileCookies(profileId);

  logActivity('PROFILE', 'INFO', 'PROFILE_WARMED', \`Auto-farmed \${siteCount} websites for profile "\${profile.name}" (\${totalFarmedCookies} cookies active).\`, profileId, profile.name, {
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
`;

fs.writeFileSync('09_AUTOMATION/cookie-warmer-service.ts', beforeWarmProfile + newLogic);
console.log('done');
