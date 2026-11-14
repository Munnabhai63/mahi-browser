import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { ErrorBoundary } from '../../01_UI/components/ErrorBoundary.js';
import { useProfileStore } from '../../01_UI/stores/useProfileStore.js';
import { useAccountStore } from '../../01_UI/stores/useAccountStore.js';

describe('Task 8: UI Resilience, ErrorBoundary & Error Surfaces Suite', () => {
  beforeEach(() => {
    // Reset stores
    useProfileStore.setState({
      profiles: [],
      loading: false,
    });

    useAccountStore.setState({
      currentUser: null,
      accountSession: null,
      planLimits: { isPro: false, plan: 'free', maxProfiles: 15, expiresAt: null },
    });
  });

  describe('1. React ErrorBoundary Component Lifecycle & State', () => {
    it('should derive hasError: true when a fatal render error occurs', () => {
      const error = new Error('Test Crash: Component crashed during render');
      const derived = ErrorBoundary.getDerivedStateFromError(error);

      expect(derived.hasError).toBe(true);
      expect(derived.error).toBe(error);
    });

    it('should track error info on componentDidCatch without crashing the host', () => {
      const boundary = new ErrorBoundary({ children: React.createElement('div', null, 'content') });
      const error = new Error('Runtime error in child');
      const errorInfo = { componentStack: '\n    in ProblematicChild\n    in App' };

      const setStateSpy = vi.spyOn(boundary, 'setState').mockImplementation((update: any) => {
        Object.assign(boundary.state, typeof update === 'function' ? update(boundary.state) : update);
      });

      boundary.componentDidCatch(error, errorInfo);

      expect(setStateSpy).toHaveBeenCalledWith({ errorInfo });
      expect(boundary.state.errorInfo).toEqual(errorInfo);
    });

    it('should trigger onReset callback and reset internal error state on handleReset', () => {
      let resetCalled = false;
      const boundary = new ErrorBoundary({
        children: null,
        onReset: () => {
          resetCalled = true;
        },
      });

      // Simulate boundary having caught an error
      boundary.state = {
        hasError: true,
        error: new Error('Simulated failure'),
        errorInfo: { componentStack: 'mock' } as any,
        showDetails: true,
      };

      const setStateSpy = vi.spyOn(boundary, 'setState').mockImplementation((update: any) => {
        Object.assign(boundary.state, typeof update === 'function' ? update(boundary.state) : update);
      });

      boundary.handleReset();

      expect(resetCalled).toBe(true);
      expect(setStateSpy).toHaveBeenCalledWith({
        hasError: false,
        error: null,
        errorInfo: null,
        showDetails: false,
      });
      expect(boundary.state.hasError).toBe(false);
      expect(boundary.state.error).toBeNull();
      expect(boundary.state.errorInfo).toBeNull();
      expect(boundary.state.showDetails).toBe(false);
    });

    it('should render fallback element when provided in props', () => {
      const fallbackElem = React.createElement('div', { id: 'custom-fallback' }, 'Custom Crash Screen');
      const boundary = new ErrorBoundary({
        children: null,
        fallback: fallbackElem,
      });

      boundary.state = {
        hasError: true,
        error: new Error('Crash'),
        errorInfo: null,
        showDetails: false,
      };

      const rendered = boundary.render();
      expect(rendered).toBe(fallbackElem);
    });
  });

  describe('2. Profile Store Stuck-Loading Prevention', () => {
    it('should reset loading: false in finally when window.mahiAPI is absent', async () => {
      const originalAPI = (globalThis as any).window?.mahiAPI;
      try {
        if ((globalThis as any).window) {
          (globalThis as any).window.mahiAPI = undefined;
        }

        useProfileStore.setState({ loading: true });
        await useProfileStore.getState().fetchProfiles();

        // Must NOT remain stuck in loading: true
        expect(useProfileStore.getState().loading).toBe(false);
      } finally {
        if ((globalThis as any).window) {
          (globalThis as any).window.mahiAPI = originalAPI;
        }
      }
    });

    it('should reset loading: false in finally when getProfiles throws an error', async () => {
      (globalThis as any).window = (globalThis as any).window || {};
      (globalThis as any).window.mahiAPI = {
        getProfiles: vi.fn().mockRejectedValue(new Error('SQLite busy: database is locked')),
      };

      useProfileStore.setState({ loading: true });
      await useProfileStore.getState().fetchProfiles();

      // Must cleanly reset loading state to false
      expect(useProfileStore.getState().loading).toBe(false);
      expect((globalThis as any).window.mahiAPI.getProfiles).toHaveBeenCalledTimes(1);
    });

    it('should load profiles and set loading: false on successful fetch', async () => {
      const mockProfiles = [
        { id: 'p1', name: 'Profile One', status: 'READY' },
        { id: 'p2', name: 'Profile Two', status: 'READY' },
      ];

      (globalThis as any).window = (globalThis as any).window || {};
      (globalThis as any).window.mahiAPI = {
        getProfiles: vi.fn().mockResolvedValue(mockProfiles),
      };

      await useProfileStore.getState().fetchProfiles();

      expect(useProfileStore.getState().loading).toBe(false);
      expect(useProfileStore.getState().profiles).toEqual(mockProfiles);
    });
  });

  describe('3. Account Plan Limits Cache Bypassing ({ force: true })', () => {
    it('should pass { force: true } parameter to accountGetPlanLimits when explicitly requested', async () => {
      const mockGetLimits = vi.fn().mockResolvedValue({ isPro: true, plan: 'pro', maxProfiles: 100, expiresAt: null });
      const mockGetSession = vi.fn().mockResolvedValue({ email: 'user@mahibrowser.com', saved_at: new Date().toISOString() });

      (globalThis as any).window = (globalThis as any).window || {};
      (globalThis as any).window.mahiAPI = {
        accountGetPlanLimits: mockGetLimits,
        accountGetSession: mockGetSession,
      };

      await useAccountStore.getState().fetchPlanLimits({ force: true });

      expect(mockGetLimits).toHaveBeenCalledWith({ force: true });
      expect(useAccountStore.getState().planLimits.plan).toBe('pro');
    });

    it('should automatically invoke fetchPlanLimits({ force: true }) upon accountLogin', async () => {
      const mockGetLimits = vi.fn().mockResolvedValue({ isPro: true, plan: 'enterprise', maxProfiles: 500, expiresAt: null });
      const mockGetSession = vi.fn().mockResolvedValue({ email: 'vip@mahibrowser.com', token: 'jwt_vip', saved_at: new Date().toISOString() });
      const mockLogin = vi.fn().mockResolvedValue({ success: true, token: 'jwt_vip' });

      (globalThis as any).window = (globalThis as any).window || {};
      (globalThis as any).window.mahiAPI = {
        accountLogin: mockLogin,
        accountGetPlanLimits: mockGetLimits,
        accountGetSession: mockGetSession,
        getProfiles: vi.fn().mockResolvedValue([]),
      };

      const result = await useAccountStore.getState().accountLogin('vip@mahibrowser.com', 'Pass12345!');

      expect(result.success).toBe(true);
      expect(mockLogin).toHaveBeenCalled();
      expect(mockGetLimits).toHaveBeenCalledWith({ force: true });
    });

    it('should automatically invoke fetchPlanLimits({ force: true }) upon accountLoginWithToken', async () => {
      const mockGetLimits = vi.fn().mockResolvedValue({ isPro: true, plan: 'pro_plus', maxProfiles: 250, expiresAt: null });
      const mockGetSession = vi.fn().mockResolvedValue({ email: 'oauth@mahibrowser.com', token: 'oauth_jwt', saved_at: new Date().toISOString() });
      const mockLoginWithToken = vi.fn().mockResolvedValue({ success: true, token: 'oauth_jwt' });

      (globalThis as any).window = (globalThis as any).window || {};
      (globalThis as any).window.mahiAPI = {
        accountLoginWithToken: mockLoginWithToken,
        accountGetPlanLimits: mockGetLimits,
        accountGetSession: mockGetSession,
        getProfiles: vi.fn().mockResolvedValue([]),
      };

      const result = await useAccountStore.getState().accountLoginWithToken('oauth_jwt_123');

      expect(result.success).toBe(true);
      expect(mockLoginWithToken).toHaveBeenCalledWith('oauth_jwt_123');
      expect(mockGetLimits).toHaveBeenCalledWith({ force: true });
    });
  });
});
