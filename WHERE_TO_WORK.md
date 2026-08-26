# WHERE TO WORK ‑ Qyick Action Guide

Use this simple lookup table to immediately find where to make any code change.

---

| What do I want to change? | Open this folder |
|---|---|
| **Buttons, UI colors, pages, sidebar, tabs, React state** | `01_UI/` |
| **Browser launching, anti-bot flags, profiles, proxies, cookies** | `02_BROWSER/` |
| **Hardware ID, ADB mobile 4G/5G IP rotation, desktop shortcuts** | `03_HARDWARE/` |
| **License keys, activation, plan limits, expiry dates** | `04_LICENSING/` |
| **Master PIN code, app locking, admin authentication** | `05_AUTH/` |
| **Database tables, SQL queries, schema migrations** | `06_DATABASE/` |
| **Electron main process, IOC handlers, REST API, Web Admin** | `07_BACKEND/` |
| **Password encryption, token hashing, error sanitization** | `08_SECURITY/` |
| **RPA automation, mouse/keyboard mirroring, cookie warmer** | `09_AUTOMATION/` |
| **IPC type definitions, Zod schemas, default constants, preload** | `10_CONFIG/` |
| **Writing or running automated tests** | `11_TESTS/` |
| **Batch files, build commands, shortcut scripts** | `12_SCRIPTS/` |
| **Icons, images, splash screen, cookie editor extension** | `13_ASSETS/` |
| **Documentation, API docs, system guides** | `14_DOCS/` |

---

## Examples

- **Task**: "Change sidebar color to emerald green"  
  🐉>Open `01_UI/components/Sidebar.tsx`

- **Task**: "Add a new Chromium launch argument for stealth"  
  🐉>Open `02_BROWSER/launcher.tsx`

- **Task**: "Add a new REST API endpoint"  
  🐉>Open `07_BACKEND/api/local-api-server.ts` or `07_BACKEND/server/app.ts`

- **Task**: "Add a new database column to profiles table"  
  🐉>Open `06_DATABASE/schema.tsx`

- **Task**: "Add a new IPC method"  
  🐉>Define type in `10_CONFIG/shared/types/ipc.ts`, expose in `10_CONFIG/preload/index.ts`, register in `07_BACKEND/ipc/register-handlers.ts`