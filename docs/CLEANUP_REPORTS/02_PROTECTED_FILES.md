# MAHI BROWSER — DESKTOP CLEANUP & CONSOLIDATION
## REPORT 02: PROTECTED ASSETS AND SAFETY BOUNDARIES

**Project:** MAHI Browser  
**Host System:** Windows 11  
**Auditor:** Antigravity Autonomous Systems Orchestrator  
**Status:** **PROTECTED & 100% PRESERVED ON SYSTEM**

---

### 1. Authoritative Main Source Code Repository

- **Path:** `C:\Users\munaf\Desktop\mahai brouser`
- **Footprint:** 22.04 GB (292,450 files)
- **Role:** The authoritative and primary development codebase. Contains:
  - Complete git commit history (`.git/`)
  - All source trees: `01_UI/`, `02_BROWSER/`, `03_HARDWARE/`, `07_BACKEND/`, `10_CONFIG/`, `11_TESTS/`, `12_SCRIPTS/`
  - Commercial entitlement architecture
  - Landing page assets (`landing/`)
  - Sub-application `Mahi terabox` (which powers the Mahi Admin Panel)
- **Protection Rule:** DO NOT TOUCH, MOVE, RENAME OR MODIFY. Retained in place on Desktop.

---

### 2. Main Installed Desktop Browser

- **Path:** `C:\Users\munaf\AppData\Local\Programs\MAHI BROWSER\MAHI Browser.exe`
- **Desktop Shortcut:** `C:\Users\munaf\Desktop\MAHI Browser.lnk`
- **Installed Version:** v1.1.1 RC1 (Chromium 138 / Electron 33)
- **Protection Rule:** Retained in place; desktop shortcut preserved and verified.

---

### 3. Real Customer & Browser Application Data

- **Root Location:** `C:\Users\munaf\AppData\Roaming\mahi-browser`
- **Contents:**
  - 289 Active profile configurations (`profiles/`)
  - Encrypted Master Vault (`master_vault.json`)
  - Cookies, sessions, local storage databases
  - Proxy credential stores
  - Commercial subscription licenses
- **Secondary Discovered Profile:** `C:\Users\munaf\Desktop\mahai` (Chromium profile containing cookies, history, and WebRTC caches)
- **Protection Rule:** Strictly protected. Zero profile deletion or modifications. Retained intact.

---

### 4. MAHI Browser Admin Panel Installation & Launchers

Forensic inspection revealed the exact runtime architecture of the Admin Panel:
- **Application Directory:** `C:\Users\munaf\Desktop\mahai brouser\Mahi terabox`
- **Desktop Shortcut:** `C:\Users\munaf\Desktop\Mahi Admin Panel.lnk`
  - Target: `C:\Program Files\nodejs\node.exe`
  - Arguments: `"C:\Users\munaf\Desktop\mahai brouser\Mahi terabox\node_modules\.bin\electron-vite" dev`
  - Working Directory: `C:\Users\munaf\Desktop\mahai brouser\Mahi terabox`
- **Batch Launcher:** `C:\Users\munaf\Desktop\Mahi Admin Panel.bat`
- **Student Dashboard Launcher:** `C:\Users\munaf\Desktop\Mahi Student Dashboard.lnk` & `.bat`
- **Web Admin Launchers:** `MAHI Super Admin Console.lnk` and `MAHI Web Admin.lnk` (pointing to `mahai brouser\12_SCRIPTS\`)
- **Protection Rule:** All admin components, node_modules, shortcuts, and batch scripts are 100% preserved.

---

### 5. Active Development / Test Build

- **Path:** `C:\Users\munaf\Desktop\MAHI_BROWSER_DESKTOP_TEST`
- **Shortcut:** `C:\Users\munaf\Desktop\MAHI Browser - TEST.lnk`
- **Active Lock Status:** 4 running `MAHI Browser.exe` processes (PIDs 23876, 30440, 31000, 33740) are actively executing from this folder.
- **Protection Rule:** In strict accordance with the rule to never break active processes or shortcuts, this directory was retained in place on the Desktop.

---

### 6. User Personal Applications & Non-MAHI Shortcuts

All personal icons and applications on the Desktop were 100% isolated and preserved:
- `Antigravity.lnk`, `AutoClip.lnk`, `CapCut.lnk`, `Discord.lnk`, `Donut.lnk`, `GoLogin.lnk`, `Handy.lnk`, `Kairo (Riyal Muna) - Chrome.lnk`, `Muna - Chrome.lnk`, `MostLogin.lnk`, `Movavi Screen Recorder.lnk`, `My 4K Downloader.lnk`, `Open Generative AI.lnk`, `Opera Browser.lnk`, `ScreenRec.lnk`, `Telegram.lnk`, `TeraBoxx Fleet Agent.lnk`, `WhatsApp.lnk`, `Wondershare Filmora 14.lnk`, `YOYO SMM Admin Panel.lnk`, `YOYO SMM Dashboard.lnk`.
- Personal directories: `Antigravity_Full_Backup`, `Antigravity_Before_Update`, `Antigravity_Backup`, `Old Firefox Data`, `obs-studio`, `vid iq`, `YOYO_SMM_Shortcuts_and_Assets`.
- Personal documents: `referral_accounts.txt`, `hanumanchalisa-622234_l.jpg`, `cooking for garna.txt`, `Goodnovel.txt`, `Note from ChatGPT.txt`, `changes.jsonl`, `New Text Document.txt`.
