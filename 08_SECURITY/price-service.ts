import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import { app } from './electron-bridge.js';
import { getWritableUserDataDir } from '../07_BACKEND/utils/runtime-paths.js';

const CONTENT_JSON_URL = 'https://mahibrowser.com/content.json';
const DEFAULT_PRICE_INR = 599;
const FETCH_TIMEOUT_MS = 3000;

function getUserDataPath(): string {
  return getWritableUserDataDir();
}

function getPriceCacheFilePath(): string {
  return path.join(getUserDataPath(), 'price-cache.json');
}

let cachedPriceInr: number = (() => {
  try {
    const cacheFile = getPriceCacheFilePath();
    if (fs.existsSync(cacheFile)) {
      const parsed = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
      if (typeof parsed?.price_inr === 'number' && parsed.price_inr > 0) {
        return parsed.price_inr;
      }
    }
  } catch {}
  return DEFAULT_PRICE_INR;
})();

/**
 * Returns current active price in INR (cached or default 599).
 */
export function getDynamicPrice(): number {
  return cachedPriceInr;
}

/**
 * Overrides in-memory price (useful for testing).
 */
export function setDynamicPriceForTesting(price: number): void {
  cachedPriceInr = price;
}

/**
 * Fetches latest price_inr from https://mahibrowser.com/content.json with 3s timeout.
 * Updates in-memory cache and persists to disk.
 */
export async function fetchDynamicPrice(): Promise<number> {
  return new Promise((resolve) => {
    let resolved = false;

    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        resolve(cachedPriceInr);
      }
    }, FETCH_TIMEOUT_MS);

    try {
      const req = https.get(
        CONTENT_JSON_URL,
        {
          timeout: FETCH_TIMEOUT_MS,
          headers: { 'User-Agent': 'MAHI-BROWSER-Client/1.0.3' },
        },
        (res) => {
          if (res.statusCode !== 200) {
            clearTimeout(timer);
            if (!resolved) {
              resolved = true;
              resolve(cachedPriceInr);
            }
            return;
          }

          let body = '';
          res.setEncoding('utf8');
          res.on('data', (chunk) => {
            body += chunk;
          });
          res.on('end', () => {
            clearTimeout(timer);
            if (resolved) return;
            resolved = true;

            try {
              const data = JSON.parse(body);
              const rawVal = data?.price_inr ?? data?.pricing?.price_inr;
              const numPrice = Number(rawVal);
              if (!isNaN(numPrice) && numPrice > 0) {
                cachedPriceInr = numPrice;
                try {
                  const cacheFile = getPriceCacheFilePath();
                  const dir = path.dirname(cacheFile);
                  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
                  fs.writeFileSync(
                    cacheFile,
                    JSON.stringify({ price_inr: numPrice, updated_at: Date.now() }),
                    'utf8'
                  );
                } catch {}
              }
            } catch {}

            resolve(cachedPriceInr);
          });
        }
      );

      req.on('error', () => {
        clearTimeout(timer);
        if (!resolved) {
          resolved = true;
          resolve(cachedPriceInr);
        }
      });

      req.on('timeout', () => {
        req.destroy();
        clearTimeout(timer);
        if (!resolved) {
          resolved = true;
          resolve(cachedPriceInr);
        }
      });
    } catch {
      clearTimeout(timer);
      if (!resolved) {
        resolved = true;
        resolve(cachedPriceInr);
      }
    }
  });
}

/**
 * Initializes non-blocking background price fetching on startup.
 */
export function startPriceSync(): void {
  // Initial non-blocking fetch on startup
  fetchDynamicPrice().catch(() => {});

  // Periodic refresh every 6 hours
  setInterval(() => {
    fetchDynamicPrice().catch(() => {});
  }, 6 * 60 * 60 * 1000);
}
