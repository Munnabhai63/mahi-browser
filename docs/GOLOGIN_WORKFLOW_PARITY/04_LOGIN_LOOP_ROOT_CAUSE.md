# 04. LOGIN LOOP ROOT CAUSE ANALYSIS
## Technical Diagnosis: Anatomy of the Desktop Redirect Loop to Download Portal

- **Date:** October 13, 2026
- **Problem Statement:** Clicking "Continue with Google" in the desktop MAHI Browser redirects the user's external browser to the website download page (`/download`), while the desktop client waits indefinitely for a manually pasted token.
- **Affected Components:**
  1. `01_UI/components/AccountModal.tsx` (Lines 163–175)
  2. `07_BACKEND/commercial/google-oauth-service.ts` (Lines 108–151, `resolvePostAuthRedirect`)
  3. `07_BACKEND/commercial/commercial-api-router.ts` (Lines 407–510)
  4. `07_BACKEND/server/app.ts` (Lines 180–187, `/dashboard` route mapping)

---

## 1. Full Trace of the Pre-Fix Desktop OAuth Flow

Below is the chronological execution path of the failure mode:

### Step 1: User Initiates Login in Desktop App
* Location: `01_UI/components/AccountModal.tsx`
* Code:
  ```typescript
  const handleGoogleLogin = () => {
    setIsGoogleLoading(true);
    setErrorMessage(null);
    setSuccessInfo('Opening Google sign-in in your default browser...');
    const googleAuthUrl = 'https://admin.mahibrowser.com/api/v1/auth/google/start?intent=desktop_login';
    if (typeof window !== 'undefined') {
      window.open(googleAuthUrl, '_blank');
    }
    setShowTokenInput(true);
    setTimeout(() => {
      setIsGoogleLoading(false);
    }, 2000);
  };
  ```
* **Immediate In-App Effect:**
  - The desktop app sets `showTokenInput = true`.
  - It renders: *"Please paste your session token from the browser"*.
  - It opens the user's external browser to `https://admin.mahibrowser.com/api/v1/auth/google/start?intent=desktop_login`.

---

### Step 2: Backend OAuth Generation
* Location: `07_BACKEND/commercial/commercial-api-router.ts` (Lines 407–438) & `google-oauth-service.ts`
* Execution:
  - `intent = 'desktop_login'` is extracted from the query parameters.
  - `generateOAuthAuthorization({ intent, ... })` is called.
  - Inside `generateOAuthAuthorization`:
    ```typescript
    const returnUrl = resolvePostAuthRedirect({
      intent,
      planId,
      billingCycle,
      returnUrl: params.returnUrl,
    });
    ```
  - State is saved into SQLite table `oauth_states`.

---

### Step 3: THE ROOT CAUSE — Missing `desktop_login` Intent Mapping
* Location: `07_BACKEND/commercial/google-oauth-service.ts` (Lines 122–151)
* Existing code:
  ```typescript
  export function resolvePostAuthRedirect(params: {
    intent?: string;
    planId?: string;
    billingCycle?: string;
    returnUrl?: string;
  } = {}): string {
    const { intent, planId, billingCycle, returnUrl } = params;

    if (returnUrl && isSafeInternalUrl(returnUrl)) {
      return returnUrl.trim();
    }

    const normalizedIntent = (intent || '').toLowerCase();

    if (normalizedIntent === 'download') {
      return '/download';
    }

    if (normalizedIntent === 'trial') {
      const query = new URLSearchParams();
      query.set('onboarding', 'trial');
      if (planId && planId !== 'free') {
        query.set('plan', planId);
      }
      return `/dashboard?${query.toString()}`;
    }

    if (normalizedIntent === 'paid' || normalizedIntent === 'checkout') {
      return '/pricing';
    }

    if (normalizedIntent === 'demo') {
      return '/book-demo';
    }

    // FALLTHROUGH: Default canonical route for normal login / signup
    return '/dashboard';
  }
  ```
* **Failure Analysis:**
  - `normalizedIntent` is `'desktop_login'`.
  - There was **NO** check for `'desktop_login'`!
  - Therefore, the code fell through to the default statement: **`return '/dashboard';`**!

---

### Step 4: OAuth Callback Execution
* Location: `07_BACKEND/commercial/commercial-api-router.ts` (Lines 442–502)
* After the user successfully signs in on `accounts.google.com`:
  - Google redirects to `/api/v1/auth/google/callback?code=...&state=...`.
  - Backend verifies state, exchanges code for Google tokens, and fetches profile.
  - Identity is linked or verified. `authResult.token` (JWT) is issued.
  - Backend computes target URL:
    ```typescript
    const targetUrl = authResult.returnUrl.startsWith('http')
      ? authResult.returnUrl
      : `${authResult.returnUrl}${authResult.returnUrl.includes('?') ? '&' : '?'}token=${authResult.token}&login=success`;
    ```
  - Since `authResult.returnUrl` evaluated to `'/dashboard'`, the browser was sent an HTTP 302 Redirect to:
    `Location: /dashboard?token=<JWT>&login=success`.

---

### Step 5: The Web Server Serves `download.html` on `/dashboard`
* Location: `07_BACKEND/server/app.ts` (Lines 180–187)
* Existing code:
  ```typescript
  // 0. Customer Account & Onboarding Dashboard (/dashboard)
  if (cleanPath === '/dashboard' && method === 'GET') {
    const downloadHtmlPath = path.join(process.cwd(), 'landing', 'download.html');
    if (fs.existsSync(downloadHtmlPath)) {
      return sendHTML(res, 200, fs.readFileSync(downloadHtmlPath, 'utf8'));
    }
    const info = getDistributionInfo();
    return sendHTML(res, 200, getDownloadPortalHtml(info));
  }
  ```
* **The Fatal Trap:**
  - `/dashboard` does NOT serve an account management page or a token bridge.
  - `/dashboard` literally serves **`landing/download.html`**!
  - The user's external browser loaded the download page, which showed:
    `"Account Required to Download"` or the `"Download MAHI Browser (x64)"` button!
  - The JWT was stuck in the address bar query string: `https://mahibrowser.com/dashboard?token=eyJ...`.

---

### Step 6: Broken Handoff to Desktop
* The user, having already downloaded and opened MAHI Browser, was baffled by being redirected back to the download page.
* Meanwhile, inside the desktop app:
  - No automated mechanism captured the token from the external browser.
  - The modal displayed an empty text input: *"Paste Session Token from Browser"*.
  - Because no everyday customer knows how to copy a query parameter token from a URL bar into a desktop app, the login failed to complete.

---

## 2. Summary of Root Cause Invariants

1. **Intent Neglect:** `resolvePostAuthRedirect` lacked a handler for `desktop_login`.
2. **Path Collateral:** `/dashboard` unconditionally rendered the download portal (`download.html`).
3. **Missing Automated Return Channel:** No OS deep link (`mahi://auth?...`) or local loopback endpoint (`127.0.0.1:32123`) was triggered to transfer the session into Electron.
4. **Unacceptable UX Fallback:** Desktop expected the user to manually copy and paste raw cryptographic bearer tokens.
