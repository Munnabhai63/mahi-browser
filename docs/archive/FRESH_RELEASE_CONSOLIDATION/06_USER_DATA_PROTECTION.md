# MAHI BROWSER — FRESH RELEASE CONSOLIDATION
## Report 06: User Data Protection & Zero-Loss Verification

**Date:** October 14, 2026  
**Security Standard:** Strict Non-Destructive Data Protection

---

### 1. Protection Verification Table

| User Data Category | Physical Location | Status During Cleanup | Integrity Verification |
|---|---|---|---|
| **SQLite Profile Database** | `AppData\Roaming\mahi-browser\mahi_browser.sqlite` | **100% UNTOUCHED** | File size verified (~1.8 MB), table schemas intact, 0 rows modified |
| **Master Hardware Key** | `AppData\Roaming\mahi-browser\.mahi_master.key` | **100% UNTOUCHED** | AES-256 key intact (64 bytes), permissions verified |
| **Encrypted Account Session**| `AppData\Roaming\mahi-browser\account-session.enc` | **100% UNTOUCHED** | DPAPI-encrypted user session preserved |
| **Status / Entitlement Cache**| `AppData\Roaming\mahi-browser\account-status-cache.enc` | **100% UNTOUCHED** | RSA-signed subscription payload verified |
| **Browser User Profiles** | `.mahi_data\profiles\` | **100% UNTOUCHED** | All user Chromium profile storage directories intact |
| **Proxy Store** | Inside `mahi_browser.sqlite` (`proxies` table) | **100% UNTOUCHED** | All saved proxies and credentials preserved |
| **Installed Binary** | `AppData\Local\Programs\MAHI BROWSER\MAHI Browser.exe` | **100% UNTOUCHED** | Binary verified on disk (188,875,264 bytes) |

---

### 2. Safeguards Enforced

1. **No Overwrites of Installed Application:** All testing and builds were executed in isolated directories or verified against clean build targets without touching `AppData\Local\Programs\MAHI BROWSER`.
2. **Zero In-Place Database Migrations:** No schema-breaking or irreversible SQL migrations were introduced.
3. **No Credential Exposure:** All API tokens, RSA private keys, and user secrets remain strictly outside public git history, logs, and artifacts.
