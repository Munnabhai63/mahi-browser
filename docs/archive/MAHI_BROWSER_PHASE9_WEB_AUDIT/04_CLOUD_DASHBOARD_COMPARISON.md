# MAHI BROWSER — PHASE 9 MASTER AUDIT
## 04. CLOUD DASHBOARD SOURCE vs PRODUCTION ROUTE
**Audit Date:** October 13, 2026  
**Auditor:** Antigravity Autonomous Orchestrator  
**Local Implementation:** `07_BACKEND/server/web-admin-html.ts` & `07_BACKEND/server/app.ts`  
**Production Route:** `https://mahibrowser.com/dashboard` & `https://mahibrowser.com/admin`  

---

### 1. The Core Architectural Finding

In the local architecture:
- `07_BACKEND/server/app.ts` (line 167) defines:
  ```typescript
  // 0. Standalone Web Admin Control Center UI
  if ((cleanPath === '' || cleanPath === '/' || cleanPath === '/admin' || cleanPath === '/web' || cleanPath === '/dashboard') && method === 'GET') {
    return sendHTML(res, 200, getWebAdminHtml());
  }
  ```
- When navigated locally, `/dashboard` serves the **MAHI Commercial Admin Control Center** (`web-admin-html.ts`, 74,589 bytes, 1,360 lines), featuring:
  - Total registered commercial users counter
  - Active licenses overview
  - Team workspaces & member permissions
  - Plan and pricing catalog editor
  - Fleet devices & active token sessions
  - Audit activity logs
  - Cloud profile sync quota and storage usage

In live production:
- Navigating to `https://mahibrowser.com/dashboard` returns HTTP 200 with 99,646 bytes.
- The delivered HTML is **NOT** the Web Admin Dashboard. It is the **public marketing landing page** (`landing/index.html`).
- When a user logs in via `https://mahibrowser.com/login`, the web page does not redirect into a functional cloud dashboard; it redirects back to `/download` or the landing page.

---

### 2. Side-by-Side Comparison Matrix

| Dashboard Feature | Local Source Implementation | Live Production Behavior | Parity Status |
|---|---|---|---|
| Dashboard Entry Route (`/dashboard`) | Serves Commercial Admin & User Hub | Serves Public Marketing Landing Page | **BROKEN / UNROUTED** |
| User Profile & Account Overview | Full user table (`getCentralUserById`) | Not rendered (Landing page only) | **LOCAL ONLY** |
| Active Sessions & Device Revocation | Connected fleet tokens & device IDs | Not accessible on web | **LOCAL ONLY** |
| Plan & Subscription Status | Plan tier badge, expiry, upgrade actions | Not accessible on web | **LOCAL ONLY** |
| Cloud Profile Sync Manager | Encrypted profile vault & sync status | Not accessible on web | **LOCAL ONLY** |
| Team Workspaces UI | Workspace creation & member invites | Not accessible on web | **LOCAL ONLY** |
| Billing & Licensing Portal | License keys, extension, activation | Not accessible on web | **LOCAL ONLY** |
| Admin Security Secret Gate | Secured via `getAdminWebSecret()` | Not exposed | **SECURED LOCALLY** |

---

### 3. Root Cause Analysis
1. The production Nginx server configuration uses an SPA fallback rule:
   ```nginx
   location / {
       try_files $uri $uri/ /index.html;
   }
   ```
2. Nginx does not proxy requests for `/dashboard` or `/admin` to the local Node.js backend running on the VPS.
3. As a result, requests for `/dashboard` fall through directly to `/index.html`.
