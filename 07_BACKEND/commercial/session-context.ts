/**
 * session-context.ts
 * Holds the currently authenticated commercial user ID in the main process memory.
 * This is the unified source of truth for "who is logged in" on the backend,
 * dynamically synchronized with encrypted disk session storage (account-session.enc).
 * UI sends commercialToken on login; we store userId here so IPC handlers and REST APIs can
 * filter profiles and other resources by owner.
 */

import { getAccountSession, clearEncryptedSession } from '../../08_SECURITY/account-service.js';

let _activeUserId: string | null = null;

/**
 * Set after a successful commercial:login, commercial:register or account auth call.
 * Pass the verified userId from loginUser() / registerUser().
 */
export function setActiveUserId(userId: string | null): void {
  _activeUserId = userId;
}

/**
 * Returns the currently logged-in user's ID, or null if no one is authenticated.
 * Resolves session split-brain by falling back to encrypted disk session
 * (account-session.enc) if in-memory state is uninitialized.
 */
export function getActiveUserId(): string | null {
  if (_activeUserId) {
    return _activeUserId;
  }
  try {
    const session = getAccountSession();
    if (session?.account_id) {
      _activeUserId = session.account_id;
      return _activeUserId;
    }
  } catch {}
  return null;
}

/**
 * Call on commercial logout to clear both in-memory and encrypted disk session states.
 */
export function clearActiveSession(): void {
  _activeUserId = null;
  try {
    clearEncryptedSession();
  } catch {}
}
