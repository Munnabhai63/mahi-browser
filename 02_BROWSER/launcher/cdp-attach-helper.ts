import net from 'node:net';
import { chromium, type Browser, type Page } from 'rebrowser-playwright-core';
import { getDatabase } from '../../06_DATABASE/connection.js';
import { log } from './launcher-shared.js';

/**
 * Computes deterministic CDP Remote Debugging Port for a given profile.
 */
export function getProfileDebugPort(profileId: string): number {
  let hash = 0;
  for (let i = 0; i < profileId.length; i++) {
    hash = (hash << 5) - hash + profileId.charCodeAt(i);
    hash |= 0;
  }
  return 34000 + (Math.abs(hash) % 15000);
}

/**
 * Allocates an ephemeral loopback TCP port for CDP automation sessions so
 * concurrent launches and non-automation profiles never expose predictable fixed ports.
 */
export async function allocateEphemeralDebugPort(): Promise<number> {
  return await new Promise<number>((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address();
      const port = addr && typeof addr === 'object' ? addr.port : 0;
      srv.close(() => {
        if (port > 0) resolve(port);
        else reject(new Error('Failed to allocate ephemeral loopback port'));
      });
    });
  });
}

export function readAllowCdpDebugPortSettingSafe(): boolean {
  try {
    const db = getDatabase();
    if (!db) return false;
    const row = db.prepare('SELECT value_json FROM app_settings WHERE key = ?').get('main_config') as
      | { value_json: string }
      | undefined;
    if (!row?.value_json) return false;
    const parsed = JSON.parse(row.value_json);
    return parsed?.security?.allowCdpDebugPort === true;
  } catch {
    return false;
  }
}

/**
 * Engine-level CDP timezone & locale override.
 * Issues Emulation.setTimezoneOverride and Emulation.setLocaleOverride via CDP
 * with Target.setAutoAttach to ensure all targets (pages, workers, iframes)
 * inherit native V8 timezone without JS proxy traps.
 */
export async function applyCdpOverrides(debugPort: number, tz: string, locale: string): Promise<boolean> {
  if (!tz && !locale) return false;
  const endpoint = `http://127.0.0.1:${debugPort}`;
  let browser: Browser | null = null;
  try {
    // poll /json/version until CDP answers (browser is still booting)
    for (let i = 0; i < 25; i++) {
      try {
        const r = await fetch(`${endpoint}/json/version`);
        if (r.ok) break;
      } catch (pollErr) {
        log.debug('CDP /json/version boot poll waiting', {
          debugPort,
          attempt: i + 1,
          err: pollErr instanceof Error ? pollErr.message : String(pollErr),
        });
      }
      if (i === 24) return false;
      await new Promise((r) => setTimeout(r, 120));
    }
    browser = await chromium.connectOverCDP(endpoint, { timeout: 8000 });
    const ctx = browser.contexts()[0];
    if (!ctx) return false;

    // apply to every current page
    const applyTo = async (page: Page) => {
      const cdp = await ctx.newCDPSession(page);
      if (tz) await cdp.send('Emulation.setTimezoneOverride', { timezoneId: tz });
      if (locale) await cdp.send('Emulation.setLocaleOverride', { locale });
      await cdp.detach().catch((detachErr: unknown) => {
        log.debug('CDP session detach skipped', {
          debugPort,
          err: detachErr instanceof Error ? detachErr.message : String(detachErr),
        });
      });
    };
    const pages = ctx.pages();
    if (pages.length === 0) {
      const p = await ctx.newPage();
      await applyTo(p);
    } else {
      for (const p of pages) await applyTo(p);
    }

    // apply to pages created later (user opens new tab)
    ctx.on('page', (p: Page) => {
      applyTo(p).catch((pageErr: unknown) => {
        log.debug('Failed applying CDP emulation override to new page', {
          debugPort,
          err: pageErr instanceof Error ? pageErr.message : String(pageErr),
        });
      });
    });

    return true;
  } catch (err) {
    log.debug('CDP timezone/locale override skipped', {
      debugPort,
      err: err instanceof Error ? err.message : String(err),
    });
    return false;
  } finally {
    // DISCONNECT only — never call browser.close() in a way that kills the browser
    try {
      await browser?.close({ reason: 'cdp-override-done' });
    } catch (closeErr) {
      log.debug('CDP Playwright handle close skipped', {
        debugPort,
        err: closeErr instanceof Error ? closeErr.message : String(closeErr),
      });
    }
  }
}
