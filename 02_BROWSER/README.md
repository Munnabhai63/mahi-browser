# 02_BROWSER — Browser Engine, Stealth & Profiles

This folder contains the core browser automation, Chromium launching, stealth fingerprint injection, and profile/proxy business logic.

## Directory Structure
- launcher.ts: Stealth Chromium process launcher, CDP remote debug orchestrator
- detector.ts: Operating system browser detector (Chrome, Edge, Chromium)
- process-manager.ts: Child process lifecycle manager & PID tracker
- proxy-tunnel.ts: Local HTTP/HTTPS upstream proxy forwarder
- proxy-auth-extension.ts: Dynamic unpacked extension for proxy credentials
- cdp-proxy-authenticator.ts: CDP-level HTTP 407 challenge solver
- services/:
  - profile-service.ts: Profile CRUD, soft-deletion, trash bin recovery
  - proxy-service.ts: Proxy storage, encryption & profile assignment
  - proxy-test-service.ts: Latency & connectivity benchmark engine
  - cookie-service.ts: Direct Chromium SQLite cookie reader/writer
  - history-service.ts: Chromium SQLite history parser & cleaner
  - extension-service.ts: CRX installer & Web Store downloader
  - archive-service.ts: Profile backup & export (.mahiprofile packages)
  - profile-lock-service.ts: Multi-user concurrency locker
  - folder-service.ts: Profile grouping folders
  - workspace-service.ts: Multi-tenant team workspace manager
  - universal-importer-service.ts: Bulk CSV/TXT/JSON parser
