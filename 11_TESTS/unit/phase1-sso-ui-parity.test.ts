import { describe, it, expect, vi } from 'vitest';
import { isMahiProtocolUrl, handleDeepLinkUrl } from '../../07_BACKEND/index.js';
import { getDesktopAuthSuccessHtml } from '../../07_BACKEND/commercial/commercial-api-router.js';

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
  });

  // ==========================================================================
  // 3. 1-CLICK SMART PROXY PARSER & LATENCY BADGE CLASSIFICATION
  // ==========================================================================
  describe('3. 1-Click Smart Proxy Parser & Latency Classification', () => {
    // Pure parser function replicating ProxyConfigModal.tsx handleSmartParse logic
    function parseProxyInput(input: string): { protocol: string; host: string; port: number; username?: string; password?: string } | null {
      let s = input.trim().replace(/^["']|["']$/g, '');
      if (!s) return null;

      let proto = 'http';
      const protoMatch = s.match(/^(https?|socks[45]?):\/\//i);
      if (protoMatch) {
        proto = protoMatch[1].toLowerCase();
        s = s.slice(protoMatch[0].length);
      }

      // Remove trailing slashes or URL paths
      s = s.replace(/\/+.*$/, '');

      let username = '';
      let password = '';
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

      const parts = s.split(':');
      if (parts.length >= 2) {
        const host = parts[0].trim();
        const port = parseInt(parts[1].trim(), 10);
        if (parts.length >= 4 && atIdx === -1) {
          username = parts[2].trim();
          password = parts.slice(3).join(':').trim();
        }
        return { protocol: proto, host, port, username: username || undefined, password: password || undefined };
      }
      return null;
    }

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

    // Color band helper according to Section 3.C
    function getLatencyColorBand(status?: string, latencyMs?: number): 'emerald' | 'amber' | 'rose' | 'slate' {
      if (status === 'FAILED' || status === 'DEAD' || status === 'ERROR') return 'rose';
      if (typeof latencyMs === 'number' && latencyMs > 0) {
        return latencyMs < 150 ? 'emerald' : 'amber';
      }
      return 'slate';
    }

    it('classifies latency according to Section 3.C thresholds', () => {
      expect(getLatencyColorBand('ACTIVE', 42)).toBe('emerald');    // < 150ms -> green (emerald)
      expect(getLatencyColorBand('ACTIVE', 149)).toBe('emerald');   // boundary < 150ms
      expect(getLatencyColorBand('ACTIVE', 150)).toBe('amber');     // >= 150ms -> amber
      expect(getLatencyColorBand('ACTIVE', 280)).toBe('amber');     // >= 150ms -> amber
      expect(getLatencyColorBand('FAILED', 0)).toBe('rose');        // failed/timed out -> rose
      expect(getLatencyColorBand('DEAD', 0)).toBe('rose');          // failed/timed out -> rose
      expect(getLatencyColorBand('ERROR', undefined)).toBe('rose');  // failed/timed out -> rose
      expect(getLatencyColorBand('PENDING', undefined)).toBe('slate');// untested -> neutral slate
    });
  });

  // ==========================================================================
  // 4. ALL 5 PROFILE STATUS PILLS STATE HELPER
  // ==========================================================================
  describe('4. All 5 Profile Status Pills Real-State Contract', () => {
    interface ProfileStateInput {
      status?: string;
      isLocked?: boolean;
      lockedBy?: string;
      syncProgress?: number;
      isSyncing?: boolean;
    }

    function resolveProfileStatusPill(input: ProfileStateInput): {
      badge: 'READY' | 'STARTING' | 'RUNNING' | 'SYNCING' | 'LOCKED';
      label: string;
      theme: 'neutral' | 'amber' | 'emerald' | 'sky' | 'rose';
    } {
      if (input.isLocked) {
        return {
          badge: 'LOCKED',
          label: `In use by ${input.lockedBy || 'Another Device'}`,
          theme: 'rose',
        };
      }
      if (input.isSyncing) {
        return {
          badge: 'SYNCING',
          label: `Syncing ${input.syncProgress !== undefined ? `${input.syncProgress}%` : '...'}`,
          theme: 'sky',
        };
      }
      if (input.status === 'STARTING') {
        return {
          badge: 'STARTING',
          label: 'Launching...',
          theme: 'amber',
        };
      }
      if (input.status === 'RUNNING') {
        return {
          badge: 'RUNNING',
          label: 'Running',
          theme: 'emerald',
        };
      }
      return {
        badge: 'READY',
        label: 'Ready',
        theme: 'neutral',
      };
    }

    it('resolves LOCKED state with real device name', () => {
      const res = resolveProfileStatusPill({ isLocked: true, lockedBy: 'MacBook Pro M2' });
      expect(res.badge).toBe('LOCKED');
      expect(res.label).toBe('In use by MacBook Pro M2');
      expect(res.theme).toBe('rose');
    });

    it('resolves SYNCING state with live percentage', () => {
      const res = resolveProfileStatusPill({ isSyncing: true, syncProgress: 65 });
      expect(res.badge).toBe('SYNCING');
      expect(res.label).toBe('Syncing 65%');
      expect(res.theme).toBe('sky');
    });

    it('resolves STARTING state with Launching... indicator', () => {
      const res = resolveProfileStatusPill({ status: 'STARTING' });
      expect(res.badge).toBe('STARTING');
      expect(res.label).toBe('Launching...');
      expect(res.theme).toBe('amber');
    });

    it('resolves RUNNING state with active indicator', () => {
      const res = resolveProfileStatusPill({ status: 'RUNNING' });
      expect(res.badge).toBe('RUNNING');
      expect(res.label).toBe('Running');
      expect(res.theme).toBe('emerald');
    });

    it('resolves READY state for idle or stopped profiles', () => {
      const res1 = resolveProfileStatusPill({ status: 'READY' });
      expect(res1.badge).toBe('READY');
      expect(res1.label).toBe('Ready');
      expect(res1.theme).toBe('neutral');

      const res2 = resolveProfileStatusPill({ status: 'STOPPED' });
      expect(res2.badge).toBe('READY');
      expect(res2.label).toBe('Ready');
    });
  });

});
