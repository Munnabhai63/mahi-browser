# MAHI BROWSER — Commercial Architecture Specification

## Overview

This document details the commercial User + Admin architecture engineered around the existing MAHI Browser software.

---

## 1. System Architecture Map

The system separates into two distinct products sharing a unified backend and SQLite database:

```text
                               +------------------------------------------+
                               |               MAHI SYSTEM                |
                               +------------------------------------------+
                                                    |
                                    +---------------+---------------+
                                    |        CENTRAL BACKEND        |
                                    |         REST & AUTH           |
                                    +---------------+---------------+
                                                    |
                         +--------------------------+--------------------------+
                         |                                                     |
                         v                                                     v
         +-------------------------------+                     +-------------------------------+
         |       USER APPLICATION        |                     |      ADMIN CONTROL PANEL      |
         |    (Existing MAHI Browser)    |                     |   (Protected Web Dashboard)   |
         +-------------------------------+                     +-------------------------------+
         | • Preserved UI, UX & Layouts  |                     | • Real-time Platform Metrics  |
         | • Isolated Browser Profiles   |                     | • User Management & Bans      |
         | • Stealth & CDP Mirroring     |                     | • Plan & Pricing Matrix       |
         | • Proxy & Cookie Tools        |                     | • License Generation & Expiry |
         | • Entitlement Guard Decorator |                     | • Device Activation & Revoke  |
         | • User Account & Devices UI   |                     | • RBAC & Tamper-proof Audit   |
         +-------------------------------+                     +-------------------------------+
                         |                                                     |
                         +--------------------------+--------------------------+
                                                    |
                                                    v
                                       +-------------------------+
                                       |     SQLITE DATABASE     |
                                       |    (Migrations v1-v8)   |
                                       +-------------------------+
```

---

## 2. Protected Features Guarantee

The following core feature engines are protected and remain intact:
* **Browser Engine & Launcher (`02_BROWSER/launcher.ts`)**: Custom Chromium launch flags, anti-bot parameters, CDP port binding.
* **Process Manager (`02_BROWSER/process-manager.ts`)**: Process supervisor, PID tracking, clean shutdown.
* **Proxy & Encryption Engine (`02_BROWSER/services/proxy-service.ts`, `08_SECURITY/encryption.ts`)**: AES-256-GCM proxy credential encryption and socket latency checking.
* **Cookie & History Managers (`02_BROWSER/services/cookie-service.ts`, `history-service.ts`)**: JSON/Netscape import/export, domain-level filtering.
* **RPA Workflow Engine (`09_AUTOMATION/automation-engine.ts`)**: Playwright Core visual automation runner.
* **Multi-Window Synchronizer (`09_AUTOMATION/sync-hub.ts`)**: Native CDP master-slave mirroring.
* **Desktop UI (`01_UI/`)**: Complete preservation of existing theme, navigation, colors, layouts, and components.

---

## 3. Commercial User Account System

### User Status Model:
* `ACTIVE`: Normal user access granted.
* `SUSPENDED`: User login blocked; profile launches restricted.
* `BANNED`: Permanent access termination.

### Server-Side Entitlement Evaluation Flow:
```text
User Logs In / Starts Action
             ↓
Backend Validates JWT Token / Credentials
             ↓
Check Account Status (ACTIVE / SUSPENDED / BANNED)
             ↓
Fetch Commercial Plan Limits (FREE / PRO / BUSINESS / ENTERPRISE)
             ↓
Evaluate Active Device Limits (e.g., PC 1, PC 2 vs maxDevices)
             ↓
Return Authoritative Entitlements
             ↓
Client Application Enforces Entitlements
```

---

## 4. Plan & Limit System

| Plan Tier | Max Profiles | Max Devices | Concurrent Running | Proxy Access | API Access | RPA Automation |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **FREE** | 5 | 1 | 2 | Yes | No | No |
| **PRO** | 100 | 2 | 10 | Yes | Yes | Yes |
| **BUSINESS** | 500 | 5 | 30 | Yes | Yes | Yes |
| **ENTERPRISE** | 2500 | 20 | 100 | Yes | Yes | Yes |

---

## 5. License Key & Minting System

* **Format**: `MAHI-XXXX-XXXX-XXXX` (16 bytes random hex, cryptographically generated).
* **Storage**: SHA-256 hash stored in database; masked format (`MAHI-****-****-XXXX`) displayed in UI.
* **Durations**: `1_DAY`, `7_DAYS`, `30_DAYS`, `90_DAYS`, `1_YEAR`, `LIFETIME`, `CUSTOM`.

---

## 6. Device Identity & Activation Management

* **Hardware Identification**: Secure hash generated from OS host, CPU architecture, and primary MAC address (`MAHI-DEV-...`).
* **Enforcement**: Server validates the active device count against the plan's `maxDevices` limit before registering a new device.
* **Revocation**: Users and administrators can revoke authorized devices at any time.

---

## 7. Protected Admin Control Panel

* **Web URL**: `http://127.0.0.1:32123/admin` (and `/super-admin` for executive suite).
* **15 Control Modules**:
  1. Platform Dashboard & Telemetry
  2. Commercial User Management (Search, Filter, Suspend, Ban, Unsuspend)
  3. Plan & Entitlement Limits Configuration
  4. License Key Minting & Expiry Extension
  5. Subscription Lifecycle Tracking
  6. Device Fleet & Authorization Control
  7. Payment & Billing Integration Readiness
  8. Role-Based Access Control (RBAC: SUPER_ADMIN, ADMIN, SUPPORT, BILLING)
  9. Tamper-Proof Audit Trail Feed
  10. Software Update & Version Distribution
  11. System Diagnostics & Health Monitoring

---

## 8. REST API Endpoints Reference

### Public & User Endpoints:
* `POST /api/v1/auth/register` - Create user account
* `POST /api/v1/auth/login` - User authentication & JWT session
* `GET /api/v1/auth/me` - Authenticated user details & entitlements
* `GET /api/v1/plans` - List active commercial plans
* `GET /api/v1/entitlements/check` - Check server-side entitlements & device authorization
* `POST /api/v1/entitlements/activate-key` - Activate license key & upgrade plan
* `GET /api/v1/devices/my-devices` - List user's registered devices
* `POST /api/v1/devices/revoke` - Revoke device access
* `GET /api/v1/updates/check` - Check software version compatibility

### Administrative Endpoints (`X-Admin-Secret` or Admin JWT required):
* `GET /api/v1/admin/dashboard` - Real platform metrics
* `GET /api/v1/admin/users` - List, search, filter users
* `PUT /api/v1/admin/users/:id/status` - Suspend, unsuspend, or ban user
* `PUT /api/v1/admin/users/:id/plan` - Change user plan tier
* `GET /api/v1/admin/plans` - List all plans
* `POST /api/v1/admin/plans` - Create plan
* `PUT /api/v1/admin/plans/:id` - Update plan limits
* `GET /api/v1/admin/licenses` - List issued licenses
* `POST /api/v1/admin/licenses` - Mint new license key
* `POST /api/v1/admin/licenses/revoke` - Revoke license
* `POST /api/v1/admin/licenses/extend` - Extend license expiry
* `GET /api/v1/admin/devices` - View all active devices
* `DELETE /api/v1/admin/devices/:id` - Revoke device access
* `GET /api/v1/admin/audit-logs` - Retrieve audit logs
* `GET /api/v1/admin/versions` - List software versions
* `POST /api/v1/admin/versions` - Publish new software release
