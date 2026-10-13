# MAHI BROWSER — PHASE 15 MASTER RELEASE & CLEANUP
## Report 09: Old Build Dependency Audit & Absolute Asset Protection

**Date:** October 14, 2026  
**Scope:** Root-level candidate build folders  

---

### 1. Absolute Protection Notice: `Mahi terabox`

**DIRECTORY STATUS: ABSOLUTELY PROTECTED**
- **Path:** `C:\Users\munaf\Desktop\mahai brouser\Mahi terabox`
- **Policy:** Explicitly excluded from cleanup. No deletion, no relocation, no renaming, no quarantine, and no modifications inside this folder.
- **Rationale:** Identified as containing active source, shortcuts, and components related to the Main MAHI Browser Admin Panel and Student Dashboard.

---

### 2. Dependency Audit of Candidate Folders

| Candidate Folder | Size | Process Check | Shortcut Check | Build Script Check | Verdict |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `release-candidate\` | ~1,550 MB | No running process | No desktop/start shortcuts resolve here | Build outputs to `release\`. No build script references this | **Candidate for Approval Gate B** |
| `release-preview\` | ~986 MB | No running process | `StarterProfilesSection.tsx` was fixed to use canonical path | No build script references this | **Candidate for Approval Gate B** |
| `release-v1.1.2\` | ~564 MB | No running process | No shortcuts resolve here | Unpacked duplicate of `release\MAHI-Browser-Setup-1.1.2.exe` | **Candidate for Approval Gate B** |
| `release\` | ~410 MB | **ACTIVE** | Contains authoritative release binaries | Active build output target | **KEEP — DO NOT TOUCH** |

---

### 3. Safety Guarantees
- All release installers, setup files, and updater metadata (`latest.yml`) are preserved in `release\`.
- Real user data in `%APPDATA%\MAHI BROWSER` has zero linkage to these folders.
