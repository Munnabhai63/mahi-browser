import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { initSqlEngine } from '../../06_DATABASE/connection.js';
import { initializeDatabase } from '../../06_DATABASE/schema.js';
import { MobileSecureStorage } from '../../01_UI/mobile/storage/mobile-secure-storage.js';
import { BiometricAuthService } from '../../01_UI/mobile/security/biometric-auth.js';
import { OfflineCacheManager } from '../../01_UI/mobile/offline/offline-cache.js';
import { MobileCompanionService } from '../../07_BACKEND/services/mobile-companion-service.js';

describe('Phase 11 — Mobile Companion Unit Tests', () => {
  beforeAll(async () => {
    await initSqlEngine();
    initializeDatabase();
  });

  beforeEach(() => {
    MobileCompanionService.resetForTest();
  });


  describe('Mobile Token Storage (Keystore / AES-256-GCM)', () => {
    it('encrypts and retrieves authentication tokens without storing plaintext', async () => {
      const storage = MobileSecureStorage.getInstance();
      await storage.clearTokens();

      const tokens = {
        accessToken: 'access_jwt_header.payload.signature',
        refreshToken: 'refresh_token_hardware_bound_xyz',
        userId: 'usr_mobile_001',
        email: 'mobile.user@mahibrowser.com',
        storedAt: new Date().toISOString(),
      };

      await storage.saveTokens(tokens);

      const retrieved = await storage.getTokens();
      expect(retrieved).not.toBeNull();
      expect(retrieved?.accessToken).toBe(tokens.accessToken);
      expect(retrieved?.refreshToken).toBe(tokens.refreshToken);
      expect(retrieved?.userId).toBe('usr_mobile_001');

      // Clear tokens
      await storage.clearTokens();
      const afterClear = await storage.getTokens();
      expect(afterClear).toBeNull();
    });

    it('reports hardware Keystore availability', () => {
      const storage = MobileSecureStorage.getInstance();
      expect(storage.isHardwareKeystoreAvailable()).toBe(true);
    });
  });

  describe('Biometric App Lock Gate', () => {
    it('manages biometric state and session locking', async () => {
      const bioService = BiometricAuthService.getInstance();
      bioService.setBiometricEnabled(true);
      expect(bioService.isBiometricEnabled()).toBe(true);

      const availability = await bioService.checkAvailability();
      expect(availability.isAvailable).toBe(true);
      expect(availability.biometryType).toBe('FINGERPRINT');

      // Simulate lock on background
      bioService.lockApp();
      expect(bioService.isSessionUnlocked()).toBe(false);

      // Authenticate
      const authResult = await bioService.promptAuthenticate('Unlock MAHI Mobile');
      expect(authResult.success).toBe(true);
      expect(bioService.isSessionUnlocked()).toBe(true);
    });
  });

  describe('Push Notification Privacy & Sanitization', () => {
    it('strictly sanitizes and redacts credentials from push payloads', async () => {
      await MobileCompanionService.registerDeviceToken('usr_test_1', {
        deviceId: 'pixel8_test',
        pushToken: 'fcm_token_sample_123',
        deviceModel: 'Pixel 8 Pro',
        osVersion: 'Android 14',
        appVersion: '11.0.0',
      });

      // Send notification containing sensitive fields in data
      const notif = await MobileCompanionService.sendNotification(
        'usr_test_1',
        'SECURITY',
        'New Sign-in Detected',
        'Signed in from Android',
        {
          ip: '198.51.100.12',
          token: 'SUPER_SECRET_BEARER_TOKEN_DO_NOT_LEAK',
          password: 'plain_user_password',
          cookie: 'session_id=secret_cookie_data',
          proxySecret: 'proxy_pass_1234',
        }
      );

      expect(notif).not.toBeNull();
      expect(notif?.data?.ip).toBe('198.51.100.12');
      // Verify sensitive keys are redacted
      expect(notif?.data?.token).toBe('[REDACTED]');
      expect(notif?.data?.password).toBe('[REDACTED]');
      expect(notif?.data?.cookie).toBe('[REDACTED]');
      expect(notif?.data?.proxySecret).toBe('[REDACTED]');
    });

    it('honors category notification preferences', async () => {
      await MobileCompanionService.registerDeviceToken('usr_test_pref', {
        deviceId: 'samsung_s24',
        pushToken: 'fcm_token_pref',
      });

      // Disable automation notifications
      await MobileCompanionService.updateNotificationPreferences('usr_test_pref', {
        automationAlerts: false,
      });

      // Try sending AUTOMATION notification
      const resultAuto = await MobileCompanionService.sendNotification(
        'usr_test_pref',
        'AUTOMATION',
        'Workflow Completed',
        'Your workflow finished'
      );
      expect(resultAuto).toBeNull(); // Muted by user preference

      // Send SECURITY notification (still enabled)
      const resultSec = await MobileCompanionService.sendNotification(
        'usr_test_pref',
        'SECURITY',
        'Security Alert',
        'Password changed'
      );
      expect(resultSec).not.toBeNull();
    });
  });

  describe('Offline Cache & Mutation Queue', () => {
    it('provides cached responses and queues safe mutations when offline', () => {
      const cache = OfflineCacheManager.getInstance();
      cache.setOnline(false);
      expect(cache.isOnline()).toBe(false);

      // Cache profiles
      const mockProfiles = [{ id: 'p1', name: 'Cached Profile 1' }];
      cache.setCached('profiles_list', mockProfiles);

      const retrieved = cache.getCached<typeof mockProfiles>('profiles_list');
      expect(retrieved).toEqual(mockProfiles);

      // Enqueue mutation
      cache.enqueueAction({
        endpoint: '/api/v1/remote/profiles/p1/rotate-proxy',
        method: 'POST',
        payload: { proxyId: 'prx_us_01' },
      });

      const queue = cache.getQueue();
      expect(queue.length).toBe(1);
      expect(queue[0].endpoint).toBe('/api/v1/remote/profiles/p1/rotate-proxy');

      cache.clearQueue();
      expect(cache.getQueue().length).toBe(0);
      cache.setOnline(true);
    });
  });

  describe('Deep Link Safety & Dispatch Validation', () => {
    it('validates custom URI schemes and prevents open redirects', () => {
      const validateDeepLink = (urlStr: string): { valid: boolean; route?: string } => {
        try {
          const parsed = new URL(urlStr);
          if (parsed.protocol === 'mahi:' && parsed.hostname === 'app') {
            const allowedPaths = ['/verify', '/invite', '/reset-password', '/cloud-session'];
            if (allowedPaths.includes(parsed.pathname)) {
              return { valid: true, route: parsed.pathname };
            }
          }
          if (parsed.protocol === 'https:' && parsed.hostname === 'app.mahibrowser.com') {
            if (parsed.pathname.startsWith('/mobile/')) {
              return { valid: true, route: parsed.pathname.replace('/mobile', '') };
            }
          }
          return { valid: false };
        } catch {
          return { valid: false };
        }
      };

      // Valid links
      expect(validateDeepLink('mahi://app/invite?workspaceId=ws_123').valid).toBe(true);
      expect(validateDeepLink('mahi://app/verify?token=abc').valid).toBe(true);
      expect(validateDeepLink('https://app.mahibrowser.com/mobile/verify?token=xyz').valid).toBe(true);

      // Malicious / open redirect attempts
      expect(validateDeepLink('mahi://malicious.com/exploit').valid).toBe(false);
      expect(validateDeepLink('https://evil.com/mobile/phish').valid).toBe(false);
      expect(validateDeepLink('javascript:alert(1)').valid).toBe(false);
    });
  });
});
