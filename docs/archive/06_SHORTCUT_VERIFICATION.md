# 06 — WINDOWS SHORTCUT AUDIT & VERIFICATION

**Date:** October 13, 2026  
**Platform:** Windows 11 x64  
**Audit Status:** ✅ **ALL SHORTCUTS VALIDATED & RESOLVED**

---

## 1. Shortcut Resolution Audit Table

| Shortcut Name | Location | Target Path | Arguments | Working Directory | Purpose | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **MAHI Browser** | Desktop | `C:\Users\munaf\AppData\Local\Programs\MAHI BROWSER\MAHI Browser.exe` | *(None)* | `C:\Users\munaf\AppData\Local\Programs\MAHI BROWSER` | Main Production App | ✅ Verified |
| **MAHI Browser** | Start Menu (`Programs\`) | `C:\Users\munaf\AppData\Local\Programs\MAHI BROWSER\MAHI Browser.exe` | *(None)* | `C:\Users\munaf\AppData\Local\Programs\MAHI BROWSER` | Windows Start Menu | ✅ Verified |
| **MAHI Browser - TEST** | Desktop | `C:\Users\munaf\Desktop\MAHI_BROWSER_DESKTOP_TEST\build\win-unpacked\MAHI Browser.exe` | `--user-data-dir="C:\Users\munaf\Desktop\MAHI_BROWSER_DESKTOP_TEST\user_data"` | `C:\Users\munaf\Desktop\MAHI_BROWSER_DESKTOP_TEST\build\win-unpacked` | Isolated Testbed | ✅ Verified |

## 2. Safety Guarantees
- The desktop shortcut **MAHI Browser** launches the newly upgraded application and seamlessly loads the user's real `%APPDATA%\mahi-browser` profile workspace.
- The testbed shortcut **MAHI Browser - TEST** remains strictly quarantined, passing its isolated `--user-data-dir` flag to prevent mixing disposable testing data with real profiles.
- No obsolete temporary shortcuts remain.
