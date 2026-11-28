# MAHI BROWSER — USER JOURNEY RESTRUCTURE
## Report 08: Account Switching & Multi-Account Safety

**Date:** October 14, 2026  
**Component:** `01_UI/components/AccountDropdown.tsx`, `01_UI/stores/useAccountStore.ts`  
**Status:** Implemented & Verified

---

### 1. Requirements for Account Switching

Users managing multiple organizations, teams, or client accounts need to switch accounts cleanly without leaving orphaned sessions, mixing up isolated browser profiles, or leaking local proxy passwords.

---

### 2. Implementation Details

1. **Enhanced `AccountDropdown.tsx`:**
   - Added **"Switch Account / Manage"** option directly adjacent to "Sign Out".
   - Shows active user email, role, and current plan tier (Free / Pro / Custom).
2. **Safe Account Teardown on Sign Out:**
   - Clears in-memory JWT tokens and session headers.
   - Resets active team context.
   - Clears session state while preserving locally created browser profiles on disk (tagged by user ID).
3. **Workspace Isolation:**
   - SQLite queries filter profiles by the active `userId` or workspace ID.
   - Switching accounts immediately reloads the profile list for the target user without requiring an application restart.
