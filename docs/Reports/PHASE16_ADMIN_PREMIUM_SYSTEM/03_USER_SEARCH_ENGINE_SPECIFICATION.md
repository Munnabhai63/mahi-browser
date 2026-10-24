# MAHI BROWSER — PHASE 16 REPORT 03
## USER SEARCH ENGINE SPECIFICATION

**MODULE:** User Account Management & Query Optimization  
**SERVICE:** `/opt/mahi-admin-panel/src/account-service.js`  
**ENDPOINT:** `GET /api/users?q=&plan=&page=&limit=`  
**DATABASE:** SQLite 3 via `better-sqlite3`  

---

### 1. SPECIFICATION & REQUIREMENTS

The User Search Engine was built to provide fast search across the entire user base:
- **Instant Partial Matching:** Users should be discoverable by partial email string (e.g., `john`, `gmail.com`).
- **Exact Identifier Lookup:** Fast lookup by system user ID (`usr_...`).
- **Hardware Binding Search:** Ability to search by hardware device identifier (`hwid`) to identify machines associated with customer accounts.
- **Plan Status Filtering:** Filtering by commercial tier (`pro`, `starter`, `team`, `trial`, `free`, `expired`).
- **Pagination & Server Memory Protection:** Default page size of 25 records with `page` and `limit` query parameters, preventing uncontrolled memory spikes.

---

### 2. SQL IMPLEMENTATION DETAILS

The search engine is implemented in `listUsers()` within `account-service.js`.

#### 2.1 Parameterized Query Architecture
```sql
-- Dynamic WHERE clause generation
WHERE (
  u.email LIKE ? OR 
  u.id LIKE ? OR 
  EXISTS (SELECT 1 FROM devices d WHERE d.user_id = u.id AND d.hwid LIKE ?)
)
```

#### 2.2 Commercial Plan Filter Logic
- **`free`**: Users without active subscription records whose `expires_at > datetime('now')`.
- **`expired`**: Users who previously had subscriptions, but currently have no active subscription extending beyond current time.
- **Specific Tier (`pro`, `starter`, `team`)**: Users having an active subscription record with matching tier and `expires_at > datetime('now')`.

#### 2.3 Comprehensive User Object Enrichment
Each returned record is enriched with:
```javascript
{
  id: u.id,
  email: u.email,
  plan: isActive ? u.active_plan : 'free',
  expires_at: u.expires_at || null,
  is_lifetime: Boolean(isLifetime),
  days_remaining: isActive && !isLifetime ? Math.max(0, Math.ceil((new Date(u.expires_at).getTime() - Date.now()) / 86400000)) : (isLifetime ? 99999 : 0),
  device_hwid: u.bound_hwid || 'None',
  bound_at: u.bound_at || null,
  storage_used_mb: usage.used_mb || 0,
  storage_total_mb: usage.total_mb || 1024,
  created_at: u.created_at
}
```

---

### 3. FRONTEND DEBOUNCE & PAGINATION CONTROLLERS

- **Debounce Mechanism:** Search inputs in `public/app.js` trigger `handleUserSearchInput()` with a 280ms debounce timer (`clearTimeout(userSearchDebounceTimer)`), minimizing unnecessary server requests during rapid typing.
- **Clear Button:** An inline clear button (`✕`) dynamically appears when a query is present and resets search state back to Page 1 upon click.
- **Pagination Controls:** The UI displays `Showing X of Y registered users` and `Page A of B`, disabling Previous/Next buttons at boundary pages.
