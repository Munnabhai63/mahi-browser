# MAHI BROWSER Architecture Documentation

## 1. Architectural Principles

MAHI BROWSER follows a strict **modular, layered desktop architecture** dividing responsibilities between the Electron Main process (backend services, database, process management) and the Renderer process (React UI, state management, components).

```
+-----------------------------------------------------------------------+
|                           REACT RENDERER                              |
|   - 16 Functional Pages (Dashboard, Profiles, Wizard, Proxies, etc.) |
|   - Zustand Stores (useProfileStore, useProxyStore, etc.)             |
|   - Tailwind CSS + Lucide Icons + Responsive Light/Dark Themes        |
+-----------------------------------------------------------------------+
                                  |
                           contextBridge
                     (Typed window.mahiAPI)
                                  |
+-----------------------------------------------------------------------+
|                          MAIN PROCESS (IPC)                           |
|   - IPC Handlers with Zod Validation Schemas                          |
|   - Event Broadcasters (profile:statusChanged, activity:logAdded)     |
+-----------------------------------------------------------------------+
       |                  |                 |                  |
+--------------+  +---------------+  +--------------+  +---------------+
|  PROFILE     |  |  PROXY & SEC  |  |  PROCESS     |  |  AUTOMATION   |
|  SERVICE     |  |  ENGINE       |  |  MANAGER     |  |  ENGINE       |
|  - CRUD      |  |  - AES-256-GCM|  |  - PID track |  |  - Playwright |
|  - Isolation |  |  - Ping Test  |  |  - Graceful  |  |  - Step runner|
|  - Archives  |  |  - Sanitizer  |  |  - Crashes   |  |  - Screenshots|
+--------------+  +---------------+  +--------------+  +---------------+
       |                  |                 |                  |
+-----------------------------------------------------------------------+
|                            STORAGE LAYER                              |
|   - SQLite Database with WAL Mode & Auto-Migrations                   |
|   - Profile Storage Isolation: /profiles/<profile-id>/...             |
|   - Encrypted Archives: .mahi-profile                                 |
+-----------------------------------------------------------------------+
```

---

## 2. Directory Isolation Model

Every profile is allocated a distinct directory under the user data storage path:

```
AppData/Roaming/mahi_browser/
├── mahi_browser.sqlite           <-- SQLite database (WAL mode)
├── .mahi_master.key              <-- 256-bit AES master key
└── profiles/
    ├── profile-001/
    │   ├── Default/
    │   │   ├── Network/Cookies   <-- Isolated Chromium Cookies
    │   │   ├── History           <-- Isolated Chromium History
    │   │   ├── Local Storage/    <-- Isolated Web LocalStorage
    │   │   └── Extensions/       <-- Isolated Extensions
    │   ├── mahi_cookies.json     <-- Mahi custom imported cookies
    │   └── mahi_history.json     <-- Mahi custom history entries
    └── profile-002/
        └── ...
```

When launching Profile 001, the browser is spawned with `--user-data-dir=.../profiles/profile-001/`. Under no circumstances is profile storage shared or leaked between instances.

---

## 3. Process Management Lifecycle

The `ProcessManager` service tracks all browser child processes:

```
   [START]
      |
      v
  (STARTING)  ---> Spawn browser process with configured flags & userDataDir
      |
      +------------> Success: Store PID, transition to (RUNNING)
      |
      +------------> Failure: Capture error, transition to (ERROR)
      |
   (RUNNING)  <---> Real-time event broadcasting to UI
      |
   [STOP]
      |
      v
  (STOPPING)  ---> Send SIGTERM to PID
      |
      +------------> Normal exit: Cleanup active entry -> (STOPPED)
      |
      +------------> Fallback timer (3000ms): Force kill with SIGKILL -> (STOPPED)
```

If the browser crashes or the user closes the window manually, the `child.on('exit')` listener automatically catches the event and updates the database and UI in real time.

---

## 4. Local REST API Architecture

A lightweight HTTP server runs on `127.0.0.1:32123` (customizable) for headless automation:
- Authenticated via HTTP `Authorization: Bearer <token>` header.
- Token is randomly generated on first run and stored securely in SQLite.
- CORS-enabled for localhost clients.
- Sanitized error responses prevent information leakage.
