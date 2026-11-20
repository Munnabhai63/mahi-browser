# MAHI BROWSER — AUTO-UPDATE RELEASE PROCEDURE & OPERATIONS MANUAL

This document describes the complete release procedure for publishing software updates to MAHI BROWSER via the live production feed at `https://mahibrowser.com/update/`.

---

## 1. Architecture Overview

- **Update Feed URL:** `https://mahibrowser.com/update/`
- **Provider:** Generic (`electron-updater`)
- **Hosting Location:** VPS `/var/www/mahi/update/` (IP: `<VPS_HOST>`)
- **Main Download Location:** VPS `/var/www/mahi/download/MAHI-Setup.exe`
- **Update Cadence:** Automatic check after 10 seconds on app launch + periodic check every 6 hours
- **Download Behavior:** 100% silent background download
- **User Notification:** When download completes and passes SHA-512 verification, a single modal popup appears:
  > *"नया update ready (v`<version>`). Restart करके update करें?"*
  > Buttons: `[Update & Restart]` / `[Later]`
- **Session Dismissal:** Clicking `[Later]` suppresses the popup for the rest of that session; checks resume upon next launch.
- **Fail-Safe:** Offline or network errors during background updates are completely silent (zero user-facing error dialogues or toasts).

---

## 2. Step-by-Step Release Procedure (Copy-Paste Ready)

Whenever you prepare a new release (e.g., bumping from `1.0.1` to `1.0.2`):

### Step 1: Bump Version in `package.json`
Update the `"version"` field in `package.json`:
```json
{
  "name": "mahi-browser",
  "version": "1.0.2"
}
```

### Step 2: Build and Package Distributable
Run the full build and electron-builder packaging pipeline:
```powershell
npm run build && npm run dist
```
This generates the following artifacts in the `release/` folder:
- `release/latest.yml` (Contains version, target URL, and sha512 checksum)
- `release/MAHI BROWSER-1.0.2-Setup.exe` (Versioned installer)
- `release/MAHI BROWSER-1.0.2-Setup.exe.blockmap` (Blockmap for differential download)

### Step 3: Upload 3 Update Files to VPS
Run the exact `scp` command to upload all 3 update files to the update feed directory:
```powershell
scp "release/latest.yml" "release/MAHI BROWSER-1.0.2-Setup.exe" "release/MAHI BROWSER-1.0.2-Setup.exe.blockmap" root@<VPS_HOST>:/var/www/mahi/update/
```

### Step 4: Ensure Proper Permissions & Copy to Main Download Link
SSH into the server or run via remote command:
```powershell
ssh root@<VPS_HOST> "chown -R www-data:www-data /var/www/mahi/update && chmod 644 /var/www/mahi/update/* && cp '/var/www/mahi/update/MAHI BROWSER-1.0.2-Setup.exe' /var/www/mahi/download/MAHI-Setup.exe && chown www-data:www-data /var/www/mahi/download/MAHI-Setup.exe"
```

### Step 5: Done!
- Existing users will automatically detect the new release within 6 hours (or 10 seconds after launching the app).
- New visitors clicking the download button on the website get the latest build from `/download/MAHI-Setup.exe`.

---

## 3. Feed Retention Policy

To manage disk space while allowing users on older versions to update smoothly:
- **Keep the last 2 versions' files** in `/var/www/mahi/update/`.
- Clean older versions periodically:
```bash
# Example on VPS:
cd /var/www/mahi/update
# Keep current and previous version files, remove older:
ls -lt "MAHI BROWSER-*-Setup.exe"*
```

---

## 4. Verification Checkpoints

To verify that the update feed is operating properly:
```bash
# 1. Verify latest.yml headers and text content
curl -i https://mahibrowser.com/update/latest.yml

# 2. Verify installer binary serves with octet-stream and byte-range support
curl -I "https://mahibrowser.com/update/MAHI%20BROWSER-1.0.2-Setup.exe"

# 3. Verify main website download button serves attachment
curl -I https://mahibrowser.com/download/MAHI-Setup.exe
```
