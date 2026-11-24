import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useToastStore, resetToastDebounceHistoryForTests } from '../../01_UI/stores/useToastStore.js';

describe('Account Modal Toast Fix & Toast Store Debounce', () => {
  beforeEach(() => {
    useToastStore.getState().clearAllToasts();
    resetToastDebounceHistoryForTests();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. useToastStore Debounce & Deduplication', () => {
    it('deduplicates identical rapid toasts within debounce window', () => {
      const store = useToastStore.getState();

      // Fire 5 identical toasts in rapid succession
      for (let i = 0; i < 5; i++) {
        store.showToast({
          type: 'success',
          title: 'Signed In',
          message: 'Account signed in successfully via deep link!',
        });
      }

      // Exactly 1 toast should be present in the store
      const toasts = useToastStore.getState().toasts;
      expect(toasts.length).toBe(1);
      expect(toasts[0].title).toBe('Signed In');
      expect(toasts[0].message).toBe('Account signed in successfully via deep link!');
    });

    it('allows distinct toasts to be displayed simultaneously', () => {
      const store = useToastStore.getState();

      store.showToast({
        type: 'success',
        title: 'Toast 1',
        message: 'Message 1',
      });

      store.showToast({
        type: 'error',
        title: 'Toast 2',
        message: 'Message 2',
      });

      store.showToast({
        type: 'info',
        title: 'Toast 3',
        message: 'Message 3',
      });

      const toasts = useToastStore.getState().toasts;
      expect(toasts.length).toBe(3);
      expect(toasts.map((t) => t.title)).toEqual(['Toast 1', 'Toast 2', 'Toast 3']);
    });

    it('allows identical toasts after debounce window expires', () => {
      vi.useFakeTimers();
      const store = useToastStore.getState();

      store.showToast({
        type: 'success',
        title: 'Signed In',
        message: 'Welcome back!',
      });
      expect(useToastStore.getState().toasts.length).toBe(1);

      // Advance by 1,600ms (beyond 1,500ms debounce window)
      vi.advanceTimersByTime(1600);

      store.showToast({
        type: 'success',
        title: 'Signed In',
        message: 'Welcome back!',
      });

      // Second identical toast is allowed after debounce window
      expect(useToastStore.getState().toasts.length).toBe(2);

      vi.useRealTimers();
    });
  });

  describe('2. AccountModal Status-Change Transition Logic', () => {
    // Pure unit evaluation of the transition decision matrix implemented in AccountModal
    function evaluateAccountStatusTransition(params: {
      wasSignedIn: boolean;
      wasPendingGoogle: boolean;
      isNowSignedIn: boolean;
    }): { shouldTriggerDeepLinkToast: boolean; shouldCloseModal: boolean } {
      const { wasSignedIn, wasPendingGoogle, isNowSignedIn } = params;
      const isTransitionToSignedIn = (!wasSignedIn && isNowSignedIn) || (wasPendingGoogle && isNowSignedIn);

      if (isTransitionToSignedIn) {
        return { shouldTriggerDeepLinkToast: true, shouldCloseModal: true };
      }

      return { shouldTriggerDeepLinkToast: false, shouldCloseModal: false };
    }

    it('Case A: Signed-out user transitions to signed-in -> fires toast and closes modal', () => {
      const result = evaluateAccountStatusTransition({
        wasSignedIn: false,
        wasPendingGoogle: false,
        isNowSignedIn: true,
      });

      expect(result.shouldTriggerDeepLinkToast).toBe(true);
      expect(result.shouldCloseModal).toBe(true);
    });

    it('Case B: Already signed-in user receives status refresh -> NO toast and modal remains open', () => {
      const result = evaluateAccountStatusTransition({
        wasSignedIn: true,
        wasPendingGoogle: false,
        isNowSignedIn: true,
      });

      expect(result.shouldTriggerDeepLinkToast).toBe(false);
      expect(result.shouldCloseModal).toBe(false);
    });

    it('Case C: User in active Google/OAuth pending flow -> fires toast and closes modal', () => {
      const result = evaluateAccountStatusTransition({
        wasSignedIn: false,
        wasPendingGoogle: true,
        isNowSignedIn: true,
      });

      expect(result.shouldTriggerDeepLinkToast).toBe(true);
      expect(result.shouldCloseModal).toBe(true);
    });

    it('Case D: Signed-out user remains signed-out -> NO toast and modal remains open', () => {
      const result = evaluateAccountStatusTransition({
        wasSignedIn: false,
        wasPendingGoogle: false,
        isNowSignedIn: false,
      });

      expect(result.shouldTriggerDeepLinkToast).toBe(false);
      expect(result.shouldCloseModal).toBe(false);
    });
  });
});
