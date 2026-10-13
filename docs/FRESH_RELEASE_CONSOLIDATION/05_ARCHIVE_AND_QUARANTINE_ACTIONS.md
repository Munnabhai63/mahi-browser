# MAHI BROWSER — FRESH RELEASE CONSOLIDATION
## Report 05: Archive & Quarantine Actions

**Date:** October 14, 2026  
**Destination Vault:** `C:\Users\munaf\Documents\MAHI_BROWSER_ARCHIVE`

---

### 1. Archive Directory Setup & Verification

The central archive has been structured according to strict separation of concerns:
```
C:\Users\munaf\Documents\MAHI_BROWSER_ARCHIVE\
├── Release_History\              <- Authoritative installer and portable binaries (v1.1.1, v1.1.2)
├── Test_Artifacts\               <- Preserved test exports, sample databases, mock sessions
├── Old_Builds\                   <- Compressed recovery archives (mahai brouser.zip)
├── Verified_Backups\             <- Cryptographically signed pre-upgrade and safe backups
├── Backups\                      <- Local pre-upgrade 1.1.2 snapshots
├── Cleanup_Reports\              <- Master cleanup audit reports
│   └── FRESH_RELEASE_CONSOLIDATION\
├── Reports\                      <- Milestone reports
│   ├── QUICK_PROFILE_AUTH_BUG_FIX\
│   └── MAHI_FINAL_USER_FLOW\
└── Quarantine_Pending_Deletion\  <- Staging area for items proposed for permanent deletion
```

---

### 2. Actions Executed Under Stage 1 (Autonomous Safe Cleanup)

1. **Release History Population:**
   - Copied `MAHI-Browser-Setup-1.1.2.exe` to `Release_History\`. Verified SHA-256 matches `a7f493586e0d56cf655e84192eb4479b8586fffaf83b475f3a4861c17ff298b1`.
   - Copied `MAHI-Browser-Portable-1.1.2.exe` to `Release_History\`. Verified SHA-256 matches `36788bcb18b21aae55e56d3710be6f0c3417b76f087daeecc85625b33bd1e8e4`.
   - Copied `MAHI-Browser-Setup-1.1.1.exe` to `Release_History\`. Verified SHA-256 matches `11b29d929bdf63e2b44fa8527cb05c9a6b9a27d2bb60d0983ab63b7a307bacaa`.
   - Copied `MAHI-Browser-Portable-1.1.1.exe` to `Release_History\`. Verified SHA-256 matches `ad5a79366564a65fdf7123a0ee3a1f699000e74b467319aa48064c30960a99fa`.
   - Copied `latest.yml` release manifest to `Release_History\`.

2. **Test Artifact Relocation:**
   - Copied `.test_data\test_export.mahi-profile` to `Test_Artifacts\`.
   - Copied `.test_data\test_mahi_profiles_1791573099885_bbtby.sqlite` to `Test_Artifacts\`.

3. **Quarantine Staging (Stage 2 Proposal):**
   - The obsolete directories (`release-candidate`, `release-preview`, `release-v1.1.2`, `Mahi terabox`) are cataloged in `08_PERMANENT_DELETION_APPROVAL_LIST.md` awaiting explicit owner approval before any physical removal.
