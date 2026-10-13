# MAHI BROWSER — PHASE 15 MASTER RELEASE & CLEANUP
## Report 05: Public Download Security & Infrastructure Architecture

**Date:** October 14, 2026  
**Component:** Public Distribution & Endpoint Hardening  

---

### 1. Architectural Separation

The owner policy dictates strict separation between public software distribution and private customer data:

```
┌──────────────────────────────────────────────┐
│        PUBLIC DISTRIBUTION ENDPOINTS         │
│  - /download/setup                           │
│  - /releases/MAHI-Browser-Setup-1.1.2.exe    │
│  - /releases/latest.yml                      │
│                                              │
│  * No signup or login required               │
│  * Static binary delivery via Nginx alias    │
│  * Rate-limited to prevent bandwidth abuse   │
└──────────────────────────────────────────────┘
                       ▲
                       │ STRICT SEPARATION
                       ▼
┌──────────────────────────────────────────────┐
│     AUTHENTICATED CUSTOMER & ADMIN APIS      │
│  - /api/v1/auth/*                            │
│  - /api/v1/commercial/*                      │
│  - /api/v1/admin/*                           │
│  - /dashboard, /admin                        │
│                                              │
│  * Mandatory JWT Bearer or Session Token     │
│  * Encrypted SQLite & Cloud Sync storage     │
│  * Strict CORS and loopback guards           │
└──────────────────────────────────────────────┘
```

---

### 2. Security Controls Enforced

1. **No Path Traversal:** Nginx aliases use explicit, pinned absolute paths to `MAHI-Browser-Setup-1.1.2.exe` (or approved candidate), preventing arbitrary directory traversal.
2. **Directory Listing Disabled:** `autoindex off;` enforced across all `/releases/` and `/download/` locations.
3. **MIME Type Enforcement:** Binary served with `default_type application/octet-stream;` and `Content-Disposition: attachment; filename="..."`.
4. **Bandwidth & Rate Limiting:** Staged `limit_req zone=download_zone burst=5 nodelay;` to protect VPS upstream bandwidth from automated scrapers.
5. **No Exposure of Credentials:** No API keys, database files, or secrets are exposed in public routes.
