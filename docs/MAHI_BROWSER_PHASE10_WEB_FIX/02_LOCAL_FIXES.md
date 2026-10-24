# MAHI BROWSER — PHASE 10
## 02. MINIMAL LOCAL SOURCE FIXES
**Date:** October 13, 2026  
**Auditor:** Antigravity Autonomous Orchestrator  
**Status:** Applied Locally & Verified in Staging (Zero Production Code Touched)  

---

### 1. Summary of Surgical Changes

All changes were strictly limited to fixing confirmed routing, security, and metadata issues without redesigning any UI or modifying existing user profiles:

| File Modified | Nature of Fix | Lines Affected | Rationale |
|---|---|---|---|
| `landing/download.html` | Checksum & Branding | L565 | Replaced placeholder SHA-256 with verified hash (`562F70...62621F`). Preserved "Created by Munna Bhai" attribution. |
| `03_HARDWARE/distribution-service.ts` | Path Resolution | L44–L65 | Added `process.env.RELEASE_DIR` and candidate paths to find the 282 MB installer on Windows and Linux VPS. |
| `07_BACKEND/server/web-admin-html.ts` | Security Hardening | L7–L11, L177 | Removed hardcoded `adminSecret` extraction and HTML value leakage. Requires explicit secret input. |
| `07_BACKEND/server/app.ts` | Routing Separation | L166–L188 | Separated `/dashboard` (Customer Portal -> `download.html`) from `/admin` (Web Admin -> `web-admin-html.ts`). |

---

### 2. Code Diffs & Technical Verification

#### A. `landing/download.html`
```diff
- <span><strong>SHA256:</strong> 11B29D...7BACAA</span>
+ <span><strong>SHA256:</strong> <span title="562F70075F6B5ED7B8BBF2FF270D7FF36AE45A53559C020C39429784EC62621F">562F70...62621F</span></span>
```

#### B. `03_HARDWARE/distribution-service.ts`
```diff
 export function getReleaseDirectory(): string {
+  if (process.env.RELEASE_DIR && fs.existsSync(process.env.RELEASE_DIR)) {
+    return process.env.RELEASE_DIR;
+  }
   const cwd = process.cwd();
   const relDir = path.join(cwd, 'release');
...
   const candidateDirs = [
+    path.join(os.homedir(), 'Desktop', 'MAHI_BROWSER_UPGRADE_INSTALLER'),
     path.join(os.homedir(), 'Desktop', 'mahai brouser', 'release'),
     path.join(os.homedir(), 'Desktop', 'mahi browser', 'release'),
+    '/var/www/mahibrowser.com/release',
+    '/var/www/mahibrowser/release',
   ];
```

#### C. `07_BACKEND/server/web-admin-html.ts`
```diff
 export function getWebAdminHtml(): string {
-  const adminSecret = getAdminWebSecret();
   return `<!DOCTYPE html>
...
- <input type="password" id="admin-secret-input" value="${adminSecret}" placeholder="Admin Secret" class="...">
+ <input type="password" id="admin-secret-input" value="" placeholder="Enter Admin Secret" class="...">
```

#### D. `07_BACKEND/server/app.ts`
```diff
- if ((cleanPath === '' || cleanPath === '/' || cleanPath === '/admin' || cleanPath === '/web' || cleanPath === '/dashboard') && method === 'GET') {
-   return sendHTML(res, 200, getWebAdminHtml());
- }
+ // 0. Standalone Web Admin Control Center UI (Restricted to /admin and /web)
+ if ((cleanPath === '/admin' || cleanPath === '/web') && method === 'GET') {
+   return sendHTML(res, 200, getWebAdminHtml());
+ }
+
+ // 0. Public Root Landing Page
+ if ((cleanPath === '' || cleanPath === '/') && method === 'GET') {
+   const indexPath = path.join(process.cwd(), 'landing', 'index.html');
+   if (fs.existsSync(indexPath)) return sendHTML(res, 200, fs.readFileSync(indexPath, 'utf8'));
+ }
+
+ // 0. Customer Account & Onboarding Dashboard (/dashboard)
+ if (cleanPath === '/dashboard' && method === 'GET') {
+   const downloadHtmlPath = path.join(process.cwd(), 'landing', 'download.html');
+   if (fs.existsSync(downloadHtmlPath)) return sendHTML(res, 200, fs.readFileSync(downloadHtmlPath, 'utf8'));
+   return sendHTML(res, 200, getDownloadPortalHtml(getDistributionInfo()));
+ }
```
