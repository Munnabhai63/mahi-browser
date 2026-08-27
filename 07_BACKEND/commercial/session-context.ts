/**
 * session-context.ts
 * Holds the currently authenticated commercial user ID in the main process memory.
 * This is the single source of truth for "who is logged in" on the backend.
 * UI sends commercialToken on login; we store userId here so IPC handlers can
 * filter profiles and other resources by owner.
 */

let _activeUserId: string | null = null;

/**
 * Set after a successful commercial:login or commercial:register IPC call.
 * Pass the verified userId from loginUser() / registerUser().
 */
export function setActiveUserId(userId: string | null): void {
  _activeUserId = userId;
}

/**
 * Returns the currently logged-in user's ID, or null if no one is authenticated.
 * All profile IPC handlers must use this to scope their queries.
 */
export function getActiveUserId(): string | null {
  return _activeUserId;
}

/**
 * Call on commercial logout to clear the server-side session.
 */
export function clearActiveSession(): void {
  _activeUserId = null;
}
