export const INITIAL_SCHEMA = `
CREATE TABLE IF NOT EXISTS app_schema_version (
  version INTEGER PRIMARY KEY,
  appliedAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS folders (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  color TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tags (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  color TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS proxies (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  protocol TEXT NOT NULL,
  host TEXT NOT NULL,
  port INTEGER NOT NULL,
  username TEXT,
  password_encrypted TEXT,
  country_region TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'UNKNOWN',
  latency_ms INTEGER,
  last_tested_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  folder TEXT DEFAULT 'General',
  notes TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'STOPPED',
  storage_path TEXT NOT NULL,
  pinned INTEGER NOT NULL DEFAULT 0,
  last_used_at TEXT,
  last_error TEXT,
  deleted_at TEXT DEFAULT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);


CREATE TABLE IF NOT EXISTS profile_settings (
  profile_id TEXT PRIMARY KEY,
  settings_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS profile_tags (
  profile_id TEXT NOT NULL,
  tag_name TEXT NOT NULL,
  PRIMARY KEY (profile_id, tag_name)
);

CREATE TABLE IF NOT EXISTS profile_proxies (
  profile_id TEXT PRIMARY KEY,
  proxy_id TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS extensions (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL,
  extension_id TEXT NOT NULL,
  name TEXT NOT NULL,
  version TEXT NOT NULL,
  description TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  source_type TEXT NOT NULL,
  source_path TEXT NOT NULL,
  icon_path TEXT,
  installed_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS automation_workflows (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  default_profile_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS automation_steps (
  id TEXT PRIMARY KEY,
  workflow_id TEXT NOT NULL,
  step_order INTEGER NOT NULL,
  type TEXT NOT NULL,
  label TEXT,
  target TEXT,
  value TEXT,
  timeout_ms INTEGER,
  continue_on_error INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS workflow_logs (
  id TEXT PRIMARY KEY,
  workflow_id TEXT NOT NULL,
  profile_id TEXT NOT NULL,
  status TEXT NOT NULL,
  logs_json TEXT NOT NULL,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  duration_ms INTEGER
);

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  timestamp TEXT NOT NULL,
  category TEXT NOT NULL,
  severity TEXT NOT NULL,
  action TEXT NOT NULL,
  details TEXT NOT NULL,
  profile_id TEXT,
  profile_name TEXT,
  metadata_json TEXT
);

CREATE TABLE IF NOT EXISTS profile_statistics (
  profile_id TEXT PRIMARY KEY,
  total_sessions INTEGER NOT NULL DEFAULT 0,
  total_uptime_seconds INTEGER NOT NULL DEFAULT 0,
  last_session_started_at TEXT,
  last_session_stopped_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS licenses (
  id TEXT PRIMARY KEY,
  license_key_hash TEXT NOT NULL UNIQUE,
  key_masked TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  account_id TEXT,
  status TEXT NOT NULL DEFAULT 'NOT_ACTIVATED',
  duration_type TEXT NOT NULL,
  max_devices INTEGER NOT NULL DEFAULT 1,
  starts_at TEXT NOT NULL,
  expires_at TEXT,
  created_at TEXT NOT NULL,
  created_by TEXT NOT NULL DEFAULT 'OWNER',
  revoked_at TEXT,
  last_validation_at TEXT,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS license_devices (
  id TEXT PRIMARY KEY,
  license_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  device_name TEXT NOT NULL,
  ip_address TEXT,
  activated_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  FOREIGN KEY (license_id) REFERENCES licenses(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS local_license_cache (
  id TEXT PRIMARY KEY,
  license_id TEXT NOT NULL,
  license_key_hash TEXT NOT NULL,
  device_id TEXT NOT NULL,
  cached_status TEXT NOT NULL,
  last_verified_at TEXT NOT NULL,
  grace_expires_at TEXT NOT NULL,
  signature TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS web_handoff_sessions (
  code TEXT PRIMARY KEY,
  token TEXT NOT NULL,
  user_json TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  used INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_web_handoff_expires ON web_handoff_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_web_handoff_used ON web_handoff_sessions(used);
`;
