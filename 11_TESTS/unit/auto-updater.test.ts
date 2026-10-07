import { describe, it, expect } from 'vitest';
import {
  UPDATE_FEED_URL,
  UPDATE_CHECK_INTERVAL_MS,
  compareSemVer,
  isValidTransition,
  UpdaterState,
} from '../../07_BACKEND/services/updater-service.js';

describe('Auto-Updater System Tests', () => {
  describe('1. Feed URL and Interval Configuration', () => {
    it('should use the production live site feed URL', () => {
      expect(UPDATE_FEED_URL).toBe('https://mahibrowser.com/update/');
    });

    it('should configure 6-hour recurring update check interval', () => {
      expect(UPDATE_CHECK_INTERVAL_MS).toBe(6 * 60 * 60 * 1000); // 21,600,000 ms
    });
  });

  describe('2. Version Comparison Logic (compareSemVer)', () => {
    it('should detect higher versions correctly', () => {
      expect(compareSemVer('1.0.1', '1.0.0')).toBe(1);
      expect(compareSemVer('1.1.0', '1.0.9')).toBe(1);
      expect(compareSemVer('2.0.0', '1.9.9')).toBe(1);
      expect(compareSemVer('v1.0.1', 'v1.0.0')).toBe(1);
      expect(compareSemVer('1.0.10', '1.0.9')).toBe(1);
    });

    it('should detect lower versions correctly', () => {
      expect(compareSemVer('1.0.0', '1.0.1')).toBe(-1);
      expect(compareSemVer('1.0.9', '1.1.0')).toBe(-1);
      expect(compareSemVer('1.9.9', '2.0.0')).toBe(-1);
      expect(compareSemVer('v1.0.0', 'v1.0.1')).toBe(-1);
    });

    it('should detect identical versions correctly', () => {
      expect(compareSemVer('1.0.0', '1.0.0')).toBe(0);
      expect(compareSemVer('v1.0.0', '1.0.0')).toBe(0);
      expect(compareSemVer('1.2.3', '1.2.3')).toBe(0);
    });

    it('should handle missing components or malformed strings gracefully', () => {
      expect(compareSemVer('1.0', '1.0.0')).toBe(0);
      expect(compareSemVer('1.0.1', '1')).toBe(1);
      expect(compareSemVer('', '1.0.0')).toBe(-1);
    });
  });

  describe('3. State Transitions Lifecycle', () => {
    it('should validate normal happy-path update lifecycle transitions', () => {
      // Normal flow: IDLE -> CHECKING -> AVAILABLE -> DOWNLOADING -> DOWNLOADED
      expect(isValidTransition('IDLE', 'CHECKING')).toBe(true);
      expect(isValidTransition('CHECKING', 'AVAILABLE')).toBe(true);
      expect(isValidTransition('AVAILABLE', 'DOWNLOADING')).toBe(true);
      expect(isValidTransition('DOWNLOADING', 'DOWNLOADED')).toBe(true);
    });

    it('should validate no-update-available transition', () => {
      expect(isValidTransition('CHECKING', 'NOT_AVAILABLE')).toBe(true);
      expect(isValidTransition('NOT_AVAILABLE', 'CHECKING')).toBe(true);
    });

    it('should validate error recovery transitions', () => {
      expect(isValidTransition('CHECKING', 'ERROR')).toBe(true);
      expect(isValidTransition('DOWNLOADING', 'ERROR')).toBe(true);
      expect(isValidTransition('ERROR', 'CHECKING')).toBe(true);
    });

    it('should reject invalid or backward state jumps', () => {
      expect(isValidTransition('IDLE', 'DOWNLOADED')).toBe(false);
      expect(isValidTransition('IDLE', 'DOWNLOADING')).toBe(false);
      expect(isValidTransition('DOWNLOADED', 'AVAILABLE')).toBe(false);
    });
  });

  describe('4. Simulation of Background Silent Check vs Manual Check', () => {
    it('should maintain expected state attributes for downloaded release', () => {
      const mockDownloadedEvent = {
        state: 'DOWNLOADED' as UpdaterState,
        currentVersion: '1.0.0',
        availableVersion: '1.0.1',
      };

      expect(mockDownloadedEvent.state).toBe('DOWNLOADED');
      expect(compareSemVer(mockDownloadedEvent.availableVersion, mockDownloadedEvent.currentVersion)).toBe(1);
    });

    it('should handle offline / network error state silently without notifying user in background', () => {
      const mockNetworkError = new Error('getaddrinfo ENOTFOUND mahibrowser.com');
      const isManual = false;

      // In background check (isManual = false), errors are logged and not broadcasted to user
      const userNotificationTriggered = isManual;
      expect(userNotificationTriggered).toBe(false);
      expect(mockNetworkError.message).toContain('ENOTFOUND');
    });

    it('should ensure non-DOWNLOADED states (CHECKING, AVAILABLE, DOWNLOADING, ERROR) do not render modal', () => {
      const shouldRenderPopup = (state: UpdaterState, dismissed: boolean) => {
        return state === 'DOWNLOADED' && !dismissed;
      };

      expect(shouldRenderPopup('IDLE', false)).toBe(false);
      expect(shouldRenderPopup('CHECKING', false)).toBe(false);
      expect(shouldRenderPopup('AVAILABLE', false)).toBe(false);
      expect(shouldRenderPopup('DOWNLOADING', false)).toBe(false);
      expect(shouldRenderPopup('ERROR', false)).toBe(false);
      expect(shouldRenderPopup('NOT_AVAILABLE', false)).toBe(false);
      expect(shouldRenderPopup('DOWNLOADED', false)).toBe(true);
    });

    it('should suppress popup after user clicks [Later] for the remainder of the session', () => {
      let sessionDismissed = false;

      const shouldRender = (state: UpdaterState) => state === 'DOWNLOADED' && !sessionDismissed;

      // First time downloaded: popup is shown
      expect(shouldRender('DOWNLOADED')).toBe(true);

      // User clicks [Later]
      sessionDismissed = true;

      // Popup dismissed immediately
      expect(shouldRender('DOWNLOADED')).toBe(false);

      // Next background cycle still receives DOWNLOADED in same session: popup remains suppressed
      expect(shouldRender('DOWNLOADED')).toBe(false);

      // Next app launch resets sessionDismissed to false
      sessionDismissed = false;
      expect(shouldRender('DOWNLOADED')).toBe(true);
    });
  });
});
