import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { isMahiProtocolUrl, handleDeepLinkUrl } from '../../07_BACKEND/index.js';
import { getDesktopAuthSuccessHtml } from '../../07_BACKEND/commercial/commercial-api-router.js';
import {
  parseProxyInput,
  getLatencyBadgeState,
  resolveProfileStatusPill,
  reduceSyncProgressMap,
  SyncProgressMap,
} from '../../01_UI/utils/phase1-ui-helpers.js';

describe('PHASE 1: Dual-Protocol SSO Handoff & UI/UX Parity Audit', () => {

  // ==========================================================================
  // 1. DUAL PROTOCOL URI VALIDATION & DEEP-LINK HELPER
  // ==========================================================================
  describe('1. Dual-Protocol Deep Link Validation (mahibrowser:// & mahi://)', () => {
    it('accepts canonical mahibrowser:// protocol URLs', () => {
      expect(isMahiProtocolUrl('mahibrowser://auth-callback?code=abc&ticket=xyz')).toBe(true);
      expect(isMahiProtocolUrl('mahibrowser://auth?handoff=mb_web_12345')).toBe(true);
      expect(isMahiProtocolUrl('mahibrowser://auth-callback')).toBe(true);
    });

    it('accepts backward-compatible mahi:// protocol URLs', () => {
      expect(isMahiProtocolUrl('mahi://auth?code=abc&ticket=xyz')).toBe(true);
      expect(isMahiProtocolUrl('mahi://auth-callback?handoff=mb_web_12345')).toBe(true);
      expect(isMahiProtocolUrl('mahi://auth')).toBe(true);
    });

    it('strictly rejects unauthorized or spoofed protocols', () => {
      expect(isMahiProtocolUrl('https://mahibrowser.com/auth')).toBe(false);
      expect(isMahiProtocolUrl('http://127.0.0.1:32123')).toBe(false);
      expect(isMahiProtocolUrl('gologin://auth-callback')).toBe(false);
      expect(isMahiProtocolUrl('javascript:alert(1)')).toBe(false);
      expect(isMahiProtocolUrl('file:///C:/Users/')).toBe(false);
      expect(isMahiProtocolUrl('')).toBe(false);
      expect(isMahiProtocolUrl(null)).toBe(false);
      expect(isMahiProtocolUrl(undefined)).toBe(false);
      expect(isMahiProtocolUrl(12345)).toBe(false);
    });

    it('rejects invalid hostnames in handleDeepLinkUrl without crashing', async () => {
      // Valid schemes but malicious/unexpected hostnames
      const res1 = await handleDeepLinkUrl('mahibrowser://evil-phishing.com/callback?token=hack');
      expect(res1).toBe(false);

      const res2 = await handleDeepLinkUrl('mahi://untrusted-host?code=123');
      expect(res2).toBe(false);

      const res3 = await handleDeepLinkUrl('not-a-valid-url');
      expect(res3).toBe(false);
    });
  });

  // ==========================================================================
  // 2. ZERO-TOKEN SECURITY RULE & DESKTOP AUTH SUCCESS HTML
  // ==========================================================================
  describe('2. Zero-Token Server HTML Handoff & Security Invariants', () => {
    it('generates desktop auth success page with canonical mahibrowser:// and fallback mahi://', () => {
      const code = 'mb_code_test_pkce_secret_123';
      const ticket = 'dsk_ticket_vault_999';
      const email = 'auditor@mahibrowser.com';

      const html = getDesktopAuthSuccessHtml({
        code,
        handoff: ticket,
        email,
        plan: 'pro',
      });

      // 1. Must contain canonical mahibrowser://auth-callback with code and ticket
      expect(html).toContain('mahibrowser://auth-callback?code=');
      expect(html).toContain(encodeURIComponent(code));
      expect(html).toContain(encodeURIComponent(ticket));

      // 2. Must contain backward-compatible mahi://auth for legacy protocol handlers
      expect(html).toContain('mahi://auth?code=');

      // 3. Strict Zero-Token Rule: MUST NOT leak raw JWT token= in URL or HTML
      expect(html).not.toContain('token=');
      expect(html).not.toContain('eyJhbGci');
    });

    it('does not create crash-log.txt in repo root during test execution', () => {
      const rootCrashLog = path.join(process.cwd(), 'crash-log.txt');
      expect(fs.existsSync(rootCrashLog)).toBe(false);
    });
  });

  // ==========================================================================
  // 3. 1-CLICK SMART PROXY PARSER (DIRECT FROM PRODUCTION HELPER)
  // ==========================================================================
  describe('3. 1-Click Smart Proxy Parser (Production Helper)', () => {
    it('parses raw ip:port:user:pass correctly', () => {
      const parsed = parseProxyInput('185.199.110.153:8080:myuser:mypassword');
      expect(parsed).toEqual({
        protocol: 'http',
        host: '185.199.110.153',
        port: 8080,
        username: 'myuser',
        password: 'mypassword',
      });
    });

    it('parses socks5://user:pass@host:port URL format', () => {
      const parsed = parseProxyInput('socks5://proxyuser:p%40ssword123@10.0.0.1:1080');
      expect(parsed).toEqual({
        protocol: 'socks5',
        host: '10.0.0.1',
        port: 1080,
        username: 'proxyuser',
        password: 'p@ssword123',
      });
    });

    it('parses http://host:port direct proxy format with trailing slashes', () => {
      const parsed = parseProxyInput('http://192.168.1.100:3128///');
      expect(parsed).toEqual({
        protocol: 'http',
        host: '192.168.1.100',
        port: 3128,
        username: undefined,
        password: undefined,
      });
    });

    it('returns null for empty or invalid proxy string', () => {
      expect(parseProxyInput('')).toBeNull();
      expect(parseProxyInput('   ')).toBeNull();
      expect(parseProxyInput('single-word-without-port')).toBeNull();
    });
  });

  // ==========================================================================
  // 4. LATENCY BADGE CLASSIFICATION (DIRECT FROM PRODUCTION HELPER)
  // ==========================================================================
  describe('4. Proxy Latency Badge Classification (Section 3.C)', () => {
    it('classifies latency according to Section 3.C thresholds', () => {
      const fast = getLatencyBadgeState('LIVE', 42);
      expect(fast.kind).toBe('fast');
      expect(fast.color).toBe('emerald');
      expect(fast.text).toBe('42ms');

      const boundaryFast = getLatencyBadgeState('READY', 149);
      expect(boundaryFast.kind).toBe('fast');
      expect(boundaryFast.color).toBe('emerald');

      const moderate = getLatencyBadgeState('LIVE', 150);
      expect(moderate.kind).toBe('moderate');
      expect(moderate.color).toBe('amber');
      expect(moderate.text).toBe('150ms');

      const high = getLatencyBadgeState('LIVE', 320);
      expect(high.kind).toBe('moderate');
      expect(high.color).toBe('amber');

      // Treats FAILED, DEAD, and ERROR uniformly as Timeout
      const failed = getLatencyBadgeState('FAILED', 0);
      expect(failed.kind).toBe('timeout');
      expect(failed.color).toBe('rose');
      expect(failed.text).toBe('Timeout');

      const dead = getLatencyBadgeState('DEAD', 0);
      expect(dead.kind).toBe('timeout');
      expect(dead.color).toBe('rose');
      expect(dead.text).toBe('Timeout');

      const error = getLatencyBadgeState('ERROR', undefined);
      expect(error.kind).toBe('timeout');
      expect(error.color).toBe('rose');
      expect(error.text).toBe('Timeout');

      // Untested returns Ping
      const untested = getLatencyBadgeState('UNKNOWN', 0);
      expect(untested.kind).toBe('untested');
      expect(untested.color).toBe('slate');
      expect(untested.text).toBe('Ping');
    });
  });

  // ==========================================================================
  // 5. PROFILE STATUS PILL & DASHBOARD RESOLUTION (PRODUCTION HELPER)
  // ==========================================================================
  describe('5. Profile Status Pills & Dashboard States (Production Helper)', () => {
    it('resolves LOCKED state with real device name', () => {
      const res = resolveProfileStatusPill({ isLocked: true, lockedBy: 'MacBook Pro M2' });
      expect(res.state).toBe('LOCKED');
      expect(res.label).toBe('In use by MacBook Pro M2');
      expect(res.badgeClass).toContain('rose-500');
    });

    it('resolves SYNCING state with live percentage', () => {
      const res = resolveProfileStatusPill({ isSyncing: true, syncProgress: 65 });
      expect(res.state).toBe('SYNCING');
      expect(res.label).toBe('Syncing 65%');
      expect(res.badgeClass).toContain('sky-500');
    });

    it('resolves STARTING state with Launching... indicator', () => {
      const res = resolveProfileStatusPill({ runtimeStatus: 'STARTING' });
      expect(res.state).toBe('STARTING');
      expect(res.label).toBe('Launching...');
      expect(res.badgeClass).toContain('amber-500');
    });

    it('resolves RUNNING state with active indicator', () => {
      const res = resolveProfileStatusPill({ runtimeStatus: 'RUNNING' });
      expect(res.state).toBe('RUNNING');
      expect(res.label).toBe('Running');
      expect(res.badgeClass).toContain('emerald-600');
    });

    it('resolves dashboard sync states distinctly without collapsing into READY', () => {
      // CONFLICT
      const conflict = resolveProfileStatusPill({ syncStatus: 'CONFLICT' });
      expect(conflict.state).toBe('CONFLICT');
      expect(conflict.label).toBe('CONFLICT');
      expect(conflict.badgeClass).toContain('rose-500');

      // FAILED / ERROR
      const failed = resolveProfileStatusPill({ syncStatus: 'FAILED' });
      expect(failed.state).toBe('FAILED');
      expect(failed.label).toBe('FAILED');

      // PENDING
      const pending = resolveProfileStatusPill({ syncStatus: 'PENDING' });
      expect(pending.state).toBe('PENDING');
      expect(pending.label).toBe('PENDING');

      // OFFLINE
      const offline = resolveProfileStatusPill({ syncStatus: 'OFFLINE' });
      expect(offline.state).toBe('OFFLINE');
      expect(offline.label).toBe('OFFLINE');

      // SYNCED
      const synced = resolveProfileStatusPill({ syncStatus: 'SYNCED' });
      expect(synced.state).toBe('SYNCED');
      expect(synced.label).toBe('SYNCED');

      // READY
      const ready = resolveProfileStatusPill({ syncStatus: 'UNKNOWN' });
      expect(ready.state).toBe('READY');
      expect(ready.label).toBe('Ready');
    });
  });

  // ==========================================================================
  // 6. DESKTOP CLOUD SYNC PROGRESS REDUCER (STUCK-STATE PREVENTION)
  // ==========================================================================
  describe('6. Desktop Sync Progress Reducer (reduceSyncProgressMap)', () => {
    it('updates progress map for active syncing profile', () => {
      let map: SyncProgressMap = {};
      map = reduceSyncProgressMap(map, { profileId: 'prof-1', percent: 45, stage: 'UPLOADING' });
      expect(map['prof-1']).toEqual({ percent: 45, stage: 'UPLOADING' });
    });

    it('clears progress on COMPLETED stage or percent >= 100', () => {
      let map: SyncProgressMap = { 'prof-1': { percent: 90, stage: 'FINALIZING' } };
      map = reduceSyncProgressMap(map, { profileId: 'prof-1', percent: 100, stage: 'FINALIZING' });
      expect(map['prof-1']).toBeUndefined();

      map = { 'prof-2': { percent: 80, stage: 'UPLOADING' } };
      map = reduceSyncProgressMap(map, { profileId: 'prof-2', percent: 85, stage: 'COMPLETED' });
      expect(map['prof-2']).toBeUndefined();
    });

    it('clears progress on ERROR and CONFLICT stages to prevent stuck 0% display', () => {
      let map: SyncProgressMap = {
        'prof-err': { percent: 12, stage: 'UPLOADING' },
        'prof-conf': { percent: 5, stage: 'RESOLVING' },
      };

      // ERROR must clear
      map = reduceSyncProgressMap(map, { profileId: 'prof-err', stage: 'ERROR' });
      expect(map['prof-err']).toBeUndefined();

      // CONFLICT must clear
      map = reduceSyncProgressMap(map, { profileId: 'prof-conf', stage: 'CONFLICT' });
      expect(map['prof-conf']).toBeUndefined();
    });
  });

});
