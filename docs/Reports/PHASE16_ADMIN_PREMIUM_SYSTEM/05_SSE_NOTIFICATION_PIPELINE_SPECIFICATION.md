# MAHI BROWSER — PHASE 16 REPORT 05
## SSE NOTIFICATION PIPELINE SPECIFICATION

**MODULE:** Server-Sent Events (SSE) & Notification Pipeline  
**SERVICE:** `/opt/mahi-admin-panel/src/notification-service.js`  
**STREAM ENDPOINT:** `GET /api/admin/notifications/stream`  
**REST ENDPOINTS:** `GET /api/admin/notifications`, `POST /api/admin/notifications/:id/read`, `POST /api/admin/notifications/read-all`  
**TABLE:** `admin_notifications`  

---

### 1. ARCHITECTURE & PROTOCOL DESIGN

Server-Sent Events (SSE) were selected over WebSockets due to:
1. Native browser reconnect mechanics (`EventSource`).
2. Unidirectional client push requirements (server to admin console).
3. Seamless compatibility with Nginx proxy buffering (`X-Accel-Buffering: no`).
4. Minimal connection overhead and simplified session authentication.

---

### 2. SERVER-SIDE IMPLEMENTATION DETAILS

#### 2.1 Database Persistence Schema
All notifications are written to SQLite to persist across admin restarts or offline intervals:
```sql
CREATE TABLE IF NOT EXISTS admin_notifications (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data_json TEXT,
  is_read INTEGER DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notif_read ON admin_notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notif_created ON admin_notifications(created_at);
```

#### 2.2 Client Connection Management & Keepalive Ping
In `src/notification-service.js`:
- Connections are registered in an in-memory `Set`.
- Standard SSE headers:
  ```http
  Content-Type: text/event-stream
  Cache-Control: no-cache
  Connection: keep-alive
  X-Accel-Buffering: no
  ```
- **Keepalive Heartbeat:** Every 25 seconds, a comment ping (`: ping\n\n`) is written across all sockets to prevent intermediate proxies or firewalls from dropping idle connections.
- **Process Termination Safety:** The heartbeat timer calls `.unref()`, ensuring the background timer does not block Node.js standalone test scripts or process exits.

#### 2.3 Event Protocol
1. **`connected`**: Emitted immediately upon connection, delivering initial `unread_count`.
2. **`unread_count`**: Emitted whenever notifications are read or added.
3. **`notification`**: Emitted on events (`premium_request_created`, `subscription_granted`, `subscription_revoked`, `system_alert`).

---

### 3. CLIENT CONTROLLER & AUDIO FEEDBACK

In `public/app.js`:
- **Visual Badge & Popover:** A notification bell in the top navigation displays a live pill counter (`#notif-badge`). Clicking the bell reveals a popover feed (`#notif-dropdown`) with dynamic time formatting and quick-action navigation.
- **Auditory Chime (Web Audio API):** On incoming events, `playNotificationChime()` synthesizes an audio chime (dual-sine oscillator D5 at 587.33Hz ramping to A5 at 880Hz over 0.28s) without requiring external audio asset downloads.
- **Live Connection Pill:** A header indicator (`#sse-status-pill`) displays `LIVE` (green pulse) when connected and automatically switches to `RECONNECTING` (amber) during network interruptions.
