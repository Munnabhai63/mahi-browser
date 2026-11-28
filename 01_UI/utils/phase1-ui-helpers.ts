/**
 * Phase 1 Shared UI Helpers
 * Centralized, pure logic shared between Desktop UI (ProfilesList, ProxyConfigModal),
 * Web Dashboard (ProfilesPage), and automated parity tests.
 */

export type SupportedProxyProtocol = 'http' | 'https' | 'socks4' | 'socks5';

export interface ParsedProxyInput {
  protocol: SupportedProxyProtocol;
  host: string;
  port: number;
  username?: string;
  password?: string;
}

/**
 * 1-Click Smart Proxy Parser (GoLogin Section 3.C parity)
 * Supports:
 * - host:port
 * - host:port:user:pass
 * - user:pass@host:port
 * - proto://user:pass@host:port (with URI-encoded passwords and trailing slashes)
 */
export function parseProxyInput(input: string): ParsedProxyInput | null {
  let s = (input || '').trim().replace(/^["']|["']$/g, '');
  if (!s) return null;

  let protocol: SupportedProxyProtocol = 'http';

  // 1. Detect protocol prefix first
  const protoMatch = s.match(/^(https?|socks[45]?):\/\//i);
  if (protoMatch) {
    const p = protoMatch[1].toLowerCase();
    if (p === 'http' || p === 'https' || p === 'socks4' || p === 'socks5') {
      protocol = p;
    }
    s = s.slice(protoMatch[0].length);
  }

  // 2. Remove trailing slashes or URL path segments
  s = s.replace(/\/+.*$/, '');

  let username = '';
  let password = '';

  // 3. Detect user:pass@host:port format
  const atIdx = s.indexOf('@');
  if (atIdx > 0) {
    const creds = s.slice(0, atIdx);
    s = s.slice(atIdx + 1);
    const [u, ...pParts] = creds.split(':');
    try {
      username = decodeURIComponent(u || '');
      password = decodeURIComponent(pParts.join(':') || '');
    } catch {
      username = u || '';
      password = pParts.join(':') || '';
    }
  }

  // 4. Parse host:port or host:port:user:pass
  const parts = s.split(':');
  if (parts.length >= 2) {
    const host = parts[0].trim();
    const port = parseInt(parts[1].trim(), 10);
    if (parts.length >= 4 && atIdx === -1) {
      username = parts[2].trim();
      password = parts.slice(3).join(':').trim();
    }
    return {
      protocol,
      host,
      port,
      username: username || undefined,
      password: password || undefined,
    };
  }

  return null;
}

export type LatencyBadgeKind = 'timeout' | 'fast' | 'moderate' | 'untested';

export interface LatencyBadgeState {
  kind: LatencyBadgeKind;
  color: 'rose' | 'emerald' | 'amber' | 'slate';
  text: string;
  title: string;
}

/**
 * Classifies proxy latency according to Section 3.C:
 * - FAILED / DEAD / ERROR -> 'Timeout' (rose)
 * - < 150ms -> '${latencyMs}ms' (emerald)
 * - >= 150ms -> '${latencyMs}ms' (amber)
 * - Untested -> 'Ping' (slate)
 */
export function getLatencyBadgeState(status?: string, latencyMs?: number): LatencyBadgeState {
  const normStatus = (status || '').toUpperCase();
  if (normStatus === 'FAILED' || normStatus === 'DEAD' || normStatus === 'ERROR') {
    return {
      kind: 'timeout',
      color: 'rose',
      text: 'Timeout',
      title: 'Proxy connection failed or timed out. Click to re-ping.',
    };
  }

  if (typeof latencyMs === 'number' && latencyMs > 0) {
    if (latencyMs < 150) {
      return {
        kind: 'fast',
        color: 'emerald',
        text: `${latencyMs}ms`,
        title: `Latency: ${latencyMs}ms (<150ms Excellent). Click to re-ping.`,
      };
    }
    return {
      kind: 'moderate',
      color: 'amber',
      text: `${latencyMs}ms`,
      title: `Latency: ${latencyMs}ms (>=150ms Moderate). Click to re-ping.`,
    };
  }

  return {
    kind: 'untested',
    color: 'slate',
    text: 'Ping',
    title: 'Click to ping proxy latency',
  };
}

export type ProfilePillState =
  | 'LOCKED'
  | 'SYNCING'
  | 'STARTING'
  | 'RUNNING'
  | 'CONFLICT'
  | 'FAILED'
  | 'PENDING'
  | 'OFFLINE'
  | 'SYNCED'
  | 'READY';

export interface ResolvedProfilePill {
  state: ProfilePillState;
  label: string;
  badgeClass: string;
  tooltip?: string;
}

/**
 * Resolves the 5 Section 3.C Profile Status Pills and dashboard sync states:
 * - LOCKED: 'In use by {deviceName}' (rose)
 * - SYNCING: 'Syncing {progress}%' (sky-blue)
 * - STARTING: 'Launching...' (amber)
 * - RUNNING: 'Running' (emerald)
 * - CONFLICT: 'CONFLICT' (rose)
 * - FAILED: 'FAILED' (rose)
 * - PENDING: 'PENDING' (cyan)
 * - OFFLINE: 'OFFLINE' (slate)
 * - SYNCED / READY: 'Ready' or 'SYNCED' (neutral border + emerald dot)
 */
export function resolveProfileStatusPill(params: {
  isLocked?: boolean;
  lockedBy?: string;
  isSyncing?: boolean;
  syncProgress?: number;
  isStarting?: boolean;
  isRunning?: boolean;
  syncStatus?: string;
  runtimeStatus?: string;
}): ResolvedProfilePill {
  if (params.isLocked) {
    const dev = params.lockedBy || 'Another Device';
    return {
      state: 'LOCKED',
      label: `In use by ${dev}`,
      tooltip: `Profile locked by ${dev}`,
      badgeClass: 'bg-rose-500/15 text-rose-500 border-rose-500/30',
    };
  }

  if (params.isSyncing || params.syncStatus === 'SYNCING') {
    const pct = params.syncProgress !== undefined ? `${params.syncProgress}%` : '...';
    return {
      state: 'SYNCING',
      label: `Syncing ${pct}`,
      tooltip: 'Syncing browser session to cloud storage',
      badgeClass: 'bg-sky-500/15 text-sky-500 border-sky-500/30 animate-pulse',
    };
  }

  if (params.isStarting || params.runtimeStatus === 'STARTING') {
    return {
      state: 'STARTING',
      label: 'Launching...',
      tooltip: 'Profile is launching',
      badgeClass: 'bg-amber-500/15 text-amber-500 border-amber-500/30',
    };
  }

  if (params.isRunning || params.runtimeStatus === 'RUNNING') {
    return {
      state: 'RUNNING',
      label: 'Running',
      tooltip: 'Profile is actively running',
      badgeClass: 'bg-emerald-600 text-white border-emerald-500',
    };
  }

  const s = (params.syncStatus || '').toUpperCase();
  if (s === 'CONFLICT') {
    return {
      state: 'CONFLICT',
      label: 'CONFLICT',
      tooltip: 'Cloud sync conflict detected',
      badgeClass: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
    };
  }

  if (s === 'FAILED' || s === 'ERROR') {
    return {
      state: 'FAILED',
      label: 'FAILED',
      tooltip: 'Cloud sync failed',
      badgeClass: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
    };
  }

  if (s === 'PENDING') {
    return {
      state: 'PENDING',
      label: 'PENDING',
      tooltip: 'Pending cloud sync',
      badgeClass: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
    };
  }

  if (s === 'OFFLINE') {
    return {
      state: 'OFFLINE',
      label: 'OFFLINE',
      tooltip: 'Profile is offline',
      badgeClass: 'bg-slate-800 text-slate-400 border-slate-700',
    };
  }

  if (s === 'SYNCED') {
    return {
      state: 'SYNCED',
      label: 'SYNCED',
      tooltip: 'Synced with cloud storage',
      badgeClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    };
  }

  return {
    state: 'READY',
    label: 'Ready',
    tooltip: 'Profile is ready to launch',
    badgeClass: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700',
  };
}

export type SyncProgressMap = Record<string, { percent: number; stage: string }>;

export interface SyncProgressEvent {
  profileId?: string;
  percent?: number;
  stage?: string;
}

/**
 * Pure reducer for desktop real-time syncProgressMap.
 * Clears profile entry on COMPLETED, ERROR, or CONFLICT stages, or when percent >= 100.
 */
export function reduceSyncProgressMap(
  prev: SyncProgressMap,
  ev: SyncProgressEvent
): SyncProgressMap {
  if (!ev?.profileId) return prev;
  const isFinished =
    ev.stage === 'COMPLETED' ||
    ev.stage === 'ERROR' ||
    ev.stage === 'CONFLICT' ||
    (typeof ev.percent === 'number' && ev.percent >= 100);

  if (isFinished) {
    if (!prev[ev.profileId]) return prev;
    const updated = { ...prev };
    delete updated[ev.profileId];
    return updated;
  }

  return {
    ...prev,
    [ev.profileId]: {
      percent: typeof ev.percent === 'number' ? ev.percent : 0,
      stage: ev.stage || 'SYNCING',
    },
  };
}
