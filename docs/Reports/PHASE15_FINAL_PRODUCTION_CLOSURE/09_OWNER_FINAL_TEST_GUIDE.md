# MAHI BROWSER v1.1.3 — OWNER FINAL ACCEPTANCE TEST GUIDE
## Document: 09_OWNER_FINAL_TEST_GUIDE.md
**Target Product:** MAHI Browser v1.1.3 Production Release  
**Live Website:** `https://mahibrowser.com`  
**Direct Download:** `https://mahibrowser.com/download/setup`  
**Target Platform:** Windows 10 & 11 x64  
**Date:** October 14, 2026

---

### WELCOME TO THE FINAL OWNER ACCEPTANCE TEST

All background engineering, VPS synchronization, and automated verification suites have concluded successfully. You can now perform the definitive owner testing following this verified sequence:

---

### STEP 1: PUBLIC DOWNLOAD VERIFICATION (ANONYMOUS CLIENT)

1. Open your standard web browser (Chrome, Edge, Brave, etc.) in an incognito or private window.
2. Navigate to: **`https://mahibrowser.com`**
3. Locate the primary hero button:
   - **`[ Download MAHI Browser (v1.1.3) ]`**
4. Click the button.
5. **Expected Behavior:**
   - The installer file **`MAHI-Browser-Setup-1.1.3.exe`** immediately begins downloading.
   - You are **NOT** redirected to `/signup`.
   - You are **NOT** redirected to `/login`.
   - You are **NOT** redirected to another download intermediate page.
6. Verify file size in your browser's download manager: **282 MB (295,622,638 bytes)**.

---

### STEP 2: INSTALLATION & WINDOWS DEFENDER SMARTSCREEN

1. Run the downloaded **`MAHI-Browser-Setup-1.1.3.exe`**.
2. **SmartScreen Prompt (Expected):**
   - Because EV code-signing certificates are in process and this is an unsigned production build, Windows Defender SmartScreen may display:
     `"Windows protected your PC"`
   - Click **"More info"** &rarr; Click **"Run anyway"**.
3. Complete the setup wizard.
4. MAHI Browser will launch automatically on your desktop.

---

### STEP 3: IN-APP AUTHENTICATION & ONBOARDING

1. On first launch, you will see the modern in-app login/signup screen.
2. Choose either option:
   - **Continue with Google:** Click Google SSO &rarr; complete browser authorization &rarr; instantly returns to MAHI Browser.
   - **Email & Password Registration:** Click "Create Account" &rarr; enter your email & password &rarr; click "Create Account".
   - **Existing Account Login:** Enter your existing email & password.
3. **Expected Behavior:**
   - Authentication completes directly inside the application.
   - Your account plan badge (e.g., *Active 7-Day Trial* or *PRO Plan*) is visible in the top-right header.
   - You land directly on the **Profiles Dashboard**.

---

### STEP 4: QUICK PROFILE CREATION (VERIFY PREVIOUS P1 BUG FIX)

1. In the top action bar, click **"Quick Create Profile"** (or the **"+"** button).
2. Enter a profile name (e.g., `Owner Test Profile 1`) or leave the default.
3. Click **"Create Profile"**.
4. **Expected Behavior (CRITICAL BUG FIX):**
   - The profile is created **instantly**.
   - **NO** error toast appears stating *"Creation Failed — Unauthorized. Invalid or missing authentication credentials."*
   - The profile appears immediately in the profile grid with status **STOPPED**.

---

### STEP 5: CREATE & RUN + CHROMIUM ENGINE VERIFICATION

1. Click the green **"Run"** button next to your new profile (or use **"Create & Run"**).
2. **Expected Behavior:**
   - The unbranded production Chromium browser launches within 1-2 seconds.
   - Browser launches with hardware fingerprint masking and direct network connectivity.
3. In MAHI Browser, the profile status changes to **RUNNING** with active uptime metrics.
4. Close the Chromium browser window (or click **"Stop"** in MAHI Browser).
5. Status returns cleanly to **STOPPED**.

---

### STEP 6: SESSION PERSISTENCE CHECK

1. Close MAHI Browser completely (ensure no processes remain in taskbar).
2. Re-open MAHI Browser from your Desktop or Start Menu.
3. **Expected Behavior:**
   - The app opens directly to the Dashboard.
   - You remain signed in.
   - Your previously created profile is present and intact in the list.

---

### STEP 7: ADMIN PORTAL VERIFICATION

1. Navigate to: **`https://admin.mahibrowser.com`**
2. Sign in with administrative credentials.
3. Verify customer subscriptions, license keys, and real-time funnel telemetry metrics.
