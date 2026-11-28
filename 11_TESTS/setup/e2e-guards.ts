/**
 * Shared runtime capability guards for E2E and stress test suites.
 * Ensures headless CI never attempts to spawn unbundled Chrome binaries
 * or contact live internet origins unless explicitly opted in.
 */

import { detectSystemBrowsers } from '../../02_BROWSER/detector.js';
import { isProductionChromiumInstalled } from '../../02_BROWSER/managed-engine.js';

export function hasLaunchableChromium(): boolean {
  try {
    if (isProductionChromiumInstalled()) return true;
    return detectSystemBrowsers().length > 0;
  } catch {
    return false;
  }
}

export function canRunRealBrowserTests(): boolean {
  const optedIn =
    process.env.RUN_REAL_BROWSER_TESTS === '1' ||
    process.env.MAHI_E2E === '1';
  return optedIn && hasLaunchableChromium();
}

export function canRunLiveNetworkTests(): boolean {
  const networkOptedIn =
    process.env.RUN_LIVE_NETWORK_TESTS === '1' ||
    process.env.MAHI_E2E === '1';
  return canRunRealBrowserTests() && networkOptedIn;
}

export function canRunPackagedAcceptanceTests(): boolean {
  return process.env.RUN_PACKAGED_ACCEPTANCE_TESTS === '1';
}
