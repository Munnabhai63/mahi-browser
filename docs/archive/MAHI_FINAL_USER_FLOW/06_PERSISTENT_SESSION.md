# MAHI BROWSER — USER JOURNEY RESTRUCTURE
## Report 06: Persistent Session Across App Restarts

**Date:** October 14, 2026  
**Component:** `01_UI/stores/useAccountStore.ts`  
**Status:** Implemented & Tested

---

### 1. Root Cause of Previous Session Loss

In earlier versions of `useAccountStore.ts`:
- The default state initialized `rememberMe: false`.
- The `onRehydrateStorage` callback explicitly contained logic that reset `currentUser = null` if `rememberMe` was false.
- As a result, every time a user closed and reopened MAHI Browser, they appeared logged out and had to re-authenticate.

---

### 2. Surgical Fix Applied

In `01_UI/stores/useAccountStore.ts`:
1. Changed initial default:
   ```typescript
   rememberMe: true, // Default to true so users stay logged in across app restarts
   ```
2. Updated the `partialize` filter in `persist`:
   ```typescript
   partialize: (state) => ({
     currentUser: state.currentUser,
     currentTeam: state.currentTeam,
     accountSession: state.accountSession,
     rememberMe: state.rememberMe,
   }),
   ```
3. Updated `onRehydrateStorage`:
   - If stored `accountSession` or `currentUser` exists, retain it.
   - Run a silent background session check to verify token freshness rather than blindly clearing user data.

---

### 3. Verification

- Tested closing and restarting the application state.
- The session, user profile, plan limits, and authentication tokens remained intact.
- On launch, the app immediately transitions into the authenticated dashboard without prompting the login modal again.
