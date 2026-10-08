import { getDatabase, initSqlEngine } from './connection.js';

export const INITIAL_SCHEMA = `
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
`;

export async function initializeDatabase(): Promise<void> {
  await initSqlEngine();
  const db = getDatabase();
  db.exec(INITIAL_SCHEMA);
  
  const checkMigration = db.prepare('SELECT version FROM schema_migrations WHERE version = 1').get();
  if (!checkMigration) {
    db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (1, ?)').run(new Date().toISOString());
  }

  // Migration v2: Add country_name and public_ip columns to proxies
  const checkMigration2 = db.prepare('SELECT version FROM schema_migrations WHERE version = 2').get();
  if (!checkMigration2) {
    try { db.exec(`ALTER TABLE proxies ADD COLUMN country_name TEXT`); } catch {}
    try { db.exec(`ALTER TABLE proxies ADD COLUMN public_ip TEXT`); } catch {}
    db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (2, ?)').run(new Date().toISOString());
  }

  // Migration v3: Create profile_statistics table for persistent historical session data.
  const checkMigration3 = db.prepare('SELECT version FROM schema_migrations WHERE version = 3').get();
  if (!checkMigration3) {
    try {
      db.exec(`
        CREATE TABLE IF NOT EXISTS profile_statistics (
          profile_id TEXT PRIMARY KEY,
          total_sessions INTEGER NOT NULL DEFAULT 0,
          total_uptime_seconds INTEGER NOT NULL DEFAULT 0,
          last_session_started_at TEXT,
          last_session_stopped_at TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `);
    } catch {}
    db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (3, ?)').run(new Date().toISOString());
  }

  // Migration v4: Licensing tables
  const checkMigration4 = db.prepare('SELECT version FROM schema_migrations WHERE version = 4').get();
  if (!checkMigration4) {
    try {
      db.exec(`
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
      `);
    } catch {}
    db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (4, ?)').run(new Date().toISOString());
  }

  // Migration v5: Profile Trash Bin & Soft Deletion
  const checkMigration5 = db.prepare('SELECT version FROM schema_migrations WHERE version = 5').get();
  if (!checkMigration5) {
    try {
      db.exec(`ALTER TABLE profiles ADD COLUMN deleted_at TEXT DEFAULT NULL`);
    } catch {}
    db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (5, ?)').run(new Date().toISOString());
  }

  // Migration v6: Team Workspaces, Members, and Profile Workspace Mappings
  const checkMigration6 = db.prepare('SELECT version FROM schema_migrations WHERE version = 6').get();
  if (!checkMigration6) {
    try {
      db.exec(`
        CREATE TABLE IF NOT EXISTS workspaces (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT DEFAULT '',
          color TEXT DEFAULT '#14b8a6',
          is_default INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS workspace_members (
          id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL,
          name TEXT NOT NULL,
          email TEXT NOT NULL,
          role TEXT NOT NULL DEFAULT 'EDITOR',
          status TEXT NOT NULL DEFAULT 'ACTIVE',
          assigned_profiles_json TEXT NOT NULL DEFAULT '[]',
          created_at TEXT NOT NULL,
          FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS profile_workspaces (
          profile_id TEXT NOT NULL,
          workspace_id TEXT NOT NULL,
          assigned_member_id TEXT,
          is_locked_by TEXT,
          PRIMARY KEY (profile_id, workspace_id)
        );
      `);
    } catch {}
    db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (6, ?)').run(new Date().toISOString());
  }

  // Migration v7: Enterprise V2 Tables (Folders, Locks, Sync, Feature Flags, Fleet, API Keys)
  const checkMigration7 = db.prepare('SELECT version FROM schema_migrations WHERE version = 7').get();
  if (!checkMigration7) {
    try {
      db.exec(`
        CREATE TABLE IF NOT EXISTS profile_folders (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          parent_id TEXT DEFAULT NULL,
          color TEXT DEFAULT '#14b8a6',
          icon TEXT DEFAULT 'Folder',
          workspace_id TEXT DEFAULT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS profile_locks (
          profile_id TEXT PRIMARY KEY,
          locked_by_user_id TEXT NOT NULL,
          locked_by_user_name TEXT NOT NULL,
          locked_by_device_id TEXT NOT NULL,
          locked_at TEXT NOT NULL,
          expires_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS profile_sync_state (
          profile_id TEXT PRIMARY KEY,
          status TEXT NOT NULL DEFAULT 'LOCAL_ONLY',
          last_synced_at TEXT,
          local_version INTEGER NOT NULL DEFAULT 1,
          remote_version INTEGER NOT NULL DEFAULT 1,
          checksum TEXT,
          error TEXT
        );

        CREATE TABLE IF NOT EXISTS feature_flags (
          key TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT DEFAULT '',
          enabled_global INTEGER NOT NULL DEFAULT 1,
          min_plan_tier TEXT NOT NULL DEFAULT 'free',
          rollout_percentage INTEGER NOT NULL DEFAULT 100,
          allowed_user_ids_json TEXT NOT NULL DEFAULT '[]',
          allowed_org_ids_json TEXT NOT NULL DEFAULT '[]',
          kill_switch_active INTEGER NOT NULL DEFAULT 0,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS fleet_devices (
          id TEXT PRIMARY KEY,
          device_id TEXT NOT NULL UNIQUE,
          user_id TEXT NOT NULL,
          device_name TEXT NOT NULL,
          os TEXT NOT NULL,
          client_version TEXT NOT NULL,
          ip_address TEXT,
          status TEXT NOT NULL DEFAULT 'ONLINE',
          last_seen_at TEXT NOT NULL,
          registered_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS api_keys_v2 (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          name TEXT NOT NULL,
          key_prefix TEXT NOT NULL,
          key_hash TEXT NOT NULL UNIQUE,
          scopes_json TEXT NOT NULL DEFAULT '["profiles:read","profiles:write"]',
          rate_limit_per_min INTEGER NOT NULL DEFAULT 60,
          requests_count_month INTEGER NOT NULL DEFAULT 0,
          last_used_at TEXT,
          expires_at TEXT,
          created_at TEXT NOT NULL,
          revoked_at TEXT
        );
      `);
    } catch {}
    db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (7, ?)').run(new Date().toISOString());
  }

  // Migration v8: Commercial User + Admin + Plan + Subscription + Device Architecture
  const checkMigration8 = db.prepare('SELECT version FROM schema_migrations WHERE version = 8').get();
  if (!checkMigration8) {
    try {
      db.exec(`
        CREATE TABLE IF NOT EXISTS commercial_users (
          id TEXT PRIMARY KEY,
          email TEXT NOT NULL UNIQUE,
          password_hash TEXT NOT NULL,
          salt TEXT NOT NULL,
          name TEXT NOT NULL,
          role TEXT NOT NULL DEFAULT 'USER',
          status TEXT NOT NULL DEFAULT 'ACTIVE',
          plan_id TEXT NOT NULL DEFAULT 'plan_free',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          last_login_at TEXT
        );

        CREATE TABLE IF NOT EXISTS commercial_plans (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          tier TEXT NOT NULL,
          price_monthly REAL NOT NULL DEFAULT 0,
          price_annual REAL NOT NULL DEFAULT 0,
          limits_json TEXT NOT NULL,
          is_active INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS commercial_subscriptions (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          plan_id TEXT NOT NULL,
          license_id TEXT,
          status TEXT NOT NULL DEFAULT 'ACTIVE',
          billing_cycle TEXT NOT NULL DEFAULT 'MONTHLY',
          starts_at TEXT NOT NULL,
          expires_at TEXT,
          payment_provider TEXT,
          external_sub_id TEXT,
          created_at TEXT NOT NULL,
          FOREIGN KEY (user_id) REFERENCES commercial_users(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS commercial_devices (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          license_id TEXT,
          device_id TEXT NOT NULL,
          device_name TEXT NOT NULL,
          os_info TEXT NOT NULL,
          client_version TEXT NOT NULL,
          ip_address TEXT,
          activated_at TEXT NOT NULL,
          last_seen_at TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'ACTIVE'
        );

        CREATE TABLE IF NOT EXISTS commercial_audit_logs (
          id TEXT PRIMARY KEY,
          actor_id TEXT NOT NULL,
          actor_name TEXT NOT NULL,
          actor_role TEXT NOT NULL,
          action TEXT NOT NULL,
          target_type TEXT NOT NULL,
          target_id TEXT,
          details TEXT NOT NULL,
          ip_address TEXT,
          result TEXT NOT NULL DEFAULT 'SUCCESS',
          created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS software_versions (
          id TEXT PRIMARY KEY,
          version TEXT NOT NULL UNIQUE,
          release_notes TEXT NOT NULL DEFAULT '',
          min_supported_version TEXT NOT NULL DEFAULT '1.0.0',
          download_url_setup TEXT,
          download_url_portable TEXT,
          is_mandatory INTEGER NOT NULL DEFAULT 0,
          released_at TEXT NOT NULL
        );
      `);
    } catch {}
    db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (8, ?)').run(new Date().toISOString());
  }

  // Migration v9: Add owner_id for profile isolation per commercial user
  const checkMigration9 = db.prepare('SELECT version FROM schema_migrations WHERE version = 9').get();
  if (!checkMigration9) {
    try {
      // Add owner_id column — default SYSTEM_OWNER means "belongs to the machine owner / pre-auth profiles"
      db.exec(`ALTER TABLE profiles ADD COLUMN owner_id TEXT NOT NULL DEFAULT 'SYSTEM_OWNER'`);
    } catch {}
    db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (9, ?)').run(new Date().toISOString());
  }

  // Migration v10: Phase 1 Central Account & Authentication Architecture
  const checkMigration10 = db.prepare('SELECT version FROM schema_migrations WHERE version = 10').get();
  if (!checkMigration10) {
    try {
      db.exec(`
        CREATE TABLE IF NOT EXISTS auth_users (
          id TEXT PRIMARY KEY,
          email TEXT NOT NULL UNIQUE,
          normalized_email TEXT NOT NULL UNIQUE,
          password_hash TEXT NOT NULL,
          salt TEXT NOT NULL,
          name TEXT NOT NULL,
          role TEXT NOT NULL DEFAULT 'USER',
          status TEXT NOT NULL DEFAULT 'ACTIVE',
          email_verified INTEGER NOT NULL DEFAULT 0,
          email_verified_at TEXT,
          plan_id TEXT NOT NULL DEFAULT 'plan_free',
          profile_quota INTEGER NOT NULL DEFAULT 10,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          last_login_at TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_auth_users_normalized_email ON auth_users(normalized_email);

        CREATE TABLE IF NOT EXISTS auth_sessions (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          refresh_token_hash TEXT NOT NULL UNIQUE,
          device_id TEXT NOT NULL,
          device_name TEXT NOT NULL,
          platform TEXT NOT NULL,
          ip_address TEXT,
          is_revoked INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL,
          last_used_at TEXT NOT NULL,
          expires_at TEXT NOT NULL,
          FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_id ON auth_sessions(user_id);
        CREATE INDEX IF NOT EXISTS idx_auth_sessions_token_hash ON auth_sessions(refresh_token_hash);

        CREATE TABLE IF NOT EXISTS auth_verification_tokens (
          id TEXT PRIMARY KEY,
          token_hash TEXT NOT NULL UNIQUE,
          user_id TEXT NOT NULL,
          email TEXT NOT NULL,
          type TEXT NOT NULL,
          expires_at TEXT NOT NULL,
          created_at TEXT NOT NULL,
          used_at TEXT,
          FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_auth_tokens_hash ON auth_verification_tokens(token_hash);

        CREATE TABLE IF NOT EXISTS auth_security_logs (
          id TEXT PRIMARY KEY,
          user_id TEXT,
          action TEXT NOT NULL,
          ip_address TEXT,
          details TEXT,
          result TEXT NOT NULL,
          created_at TEXT NOT NULL
        );
      `);
    } catch {}
    db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (10, ?)').run(new Date().toISOString());
  }

  // Migration v11: Phase 2 Zero-Knowledge Cloud Profile Storage & Multi-Device Sync
  const checkMigration11 = db.prepare('SELECT version FROM schema_migrations WHERE version = 11').get();
  if (!checkMigration11) {
    try {
      db.exec(`
        CREATE TABLE IF NOT EXISTS cloud_profiles (
          id TEXT PRIMARY KEY,
          owner_id TEXT NOT NULL,
          local_profile_id TEXT NOT NULL,
          name TEXT NOT NULL,
          current_version INTEGER NOT NULL DEFAULT 1,
          status TEXT NOT NULL DEFAULT 'ACTIVE',
          storage_bytes INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (owner_id) REFERENCES auth_users(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_cloud_profiles_owner ON cloud_profiles(owner_id);
        CREATE INDEX IF NOT EXISTS idx_cloud_profiles_local ON cloud_profiles(owner_id, local_profile_id);

        CREATE TABLE IF NOT EXISTS cloud_profile_versions (
          id TEXT PRIMARY KEY,
          cloud_profile_id TEXT NOT NULL,
          version INTEGER NOT NULL,
          object_key TEXT NOT NULL,
          file_size INTEGER NOT NULL,
          checksum_sha256 TEXT NOT NULL,
          encrypted_data_key TEXT NOT NULL,
          iv TEXT NOT NULL,
          auth_tag TEXT NOT NULL,
          source_device_id TEXT NOT NULL,
          source_device_name TEXT,
          created_at TEXT NOT NULL,
          FOREIGN KEY (cloud_profile_id) REFERENCES cloud_profiles(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_cloud_versions_profile ON cloud_profile_versions(cloud_profile_id);
        CREATE INDEX IF NOT EXISTS idx_cloud_versions_profile_ver ON cloud_profile_versions(cloud_profile_id, version);

        CREATE TABLE IF NOT EXISTS cloud_profile_locks (
          cloud_profile_id TEXT PRIMARY KEY,
          device_id TEXT NOT NULL,
          device_name TEXT NOT NULL,
          user_id TEXT NOT NULL,
          locked_at TEXT NOT NULL,
          expires_at TEXT NOT NULL,
          FOREIGN KEY (cloud_profile_id) REFERENCES cloud_profiles(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_cloud_locks_expires ON cloud_profile_locks(expires_at);

        CREATE TABLE IF NOT EXISTS cloud_sync_upload_sessions (
          id TEXT PRIMARY KEY,
          cloud_profile_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          target_version INTEGER NOT NULL,
          base_version INTEGER NOT NULL,
          object_key TEXT NOT NULL,
          expected_size INTEGER NOT NULL,
          expected_checksum TEXT NOT NULL,
          encrypted_data_key TEXT NOT NULL,
          iv TEXT NOT NULL,
          auth_tag TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'PENDING',
          expires_at TEXT NOT NULL,
          created_at TEXT NOT NULL,
          FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_upload_sessions_status ON cloud_sync_upload_sessions(status);

        CREATE TABLE IF NOT EXISTS cloud_sync_audit_logs (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          cloud_profile_id TEXT,
          action TEXT NOT NULL,
          device_id TEXT,
          details TEXT,
          created_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_cloud_logs_user ON cloud_sync_audit_logs(user_id);
        CREATE INDEX IF NOT EXISTS idx_cloud_logs_action ON cloud_sync_audit_logs(action);
      `);
    } catch {}
    db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (11, ?)').run(new Date().toISOString());
  }

  // Migration v12: Phase 3 Multi-User Team Workspaces, Secure Profile Sharing & RBAC
  const checkMigration12 = db.prepare('SELECT version FROM schema_migrations WHERE version = 12').get();
  if (!checkMigration12) {
    try {
      db.exec(`
        CREATE TABLE IF NOT EXISTS team_workspaces (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT DEFAULT '',
          owner_user_id TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'ACTIVE',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (owner_user_id) REFERENCES auth_users(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_team_ws_owner ON team_workspaces(owner_user_id);
        CREATE INDEX IF NOT EXISTS idx_team_ws_status ON team_workspaces(status);

        CREATE TABLE IF NOT EXISTS team_workspace_members (
          id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          role TEXT NOT NULL DEFAULT 'MEMBER',
          status TEXT NOT NULL DEFAULT 'ACTIVE',
          invited_by TEXT,
          joined_at TEXT NOT NULL,
          created_at TEXT NOT NULL,
          FOREIGN KEY (workspace_id) REFERENCES team_workspaces(id) ON DELETE CASCADE,
          FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE,
          UNIQUE (workspace_id, user_id)
        );

        CREATE INDEX IF NOT EXISTS idx_team_ws_members_user ON team_workspace_members(user_id);
        CREATE INDEX IF NOT EXISTS idx_team_ws_members_ws ON team_workspace_members(workspace_id);
        CREATE INDEX IF NOT EXISTS idx_team_ws_members_status ON team_workspace_members(workspace_id, status);

        CREATE TABLE IF NOT EXISTS team_workspace_invitations (
          id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL,
          email TEXT NOT NULL,
          role TEXT NOT NULL DEFAULT 'MEMBER',
          token_hash TEXT NOT NULL UNIQUE,
          invited_by TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'PENDING',
          expires_at TEXT NOT NULL,
          created_at TEXT NOT NULL,
          FOREIGN KEY (workspace_id) REFERENCES team_workspaces(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_team_ws_invites_hash ON team_workspace_invitations(token_hash);
        CREATE INDEX IF NOT EXISTS idx_team_ws_invites_ws ON team_workspace_invitations(workspace_id);
        CREATE INDEX IF NOT EXISTS idx_team_ws_invites_email ON team_workspace_invitations(email);
        CREATE INDEX IF NOT EXISTS idx_team_ws_invites_status ON team_workspace_invitations(status);

        CREATE TABLE IF NOT EXISTS team_profile_shares (
          id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL,
          cloud_profile_id TEXT NOT NULL,
          shared_by TEXT NOT NULL,
          permission_level TEXT NOT NULL DEFAULT 'RUN',
          encrypted_key_envelope TEXT NOT NULL,
          created_at TEXT NOT NULL,
          revoked_at TEXT DEFAULT NULL,
          FOREIGN KEY (workspace_id) REFERENCES team_workspaces(id) ON DELETE CASCADE,
          FOREIGN KEY (cloud_profile_id) REFERENCES cloud_profiles(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_team_shares_ws ON team_profile_shares(workspace_id);
        CREATE INDEX IF NOT EXISTS idx_team_shares_profile ON team_profile_shares(cloud_profile_id);

        CREATE TABLE IF NOT EXISTS team_workspace_keys (
          id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          encrypted_workspace_key TEXT NOT NULL,
          created_at TEXT NOT NULL,
          FOREIGN KEY (workspace_id) REFERENCES team_workspaces(id) ON DELETE CASCADE,
          FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE,
          UNIQUE (workspace_id, user_id)
        );

        CREATE INDEX IF NOT EXISTS idx_team_ws_keys_user ON team_workspace_keys(workspace_id, user_id);

        CREATE TABLE IF NOT EXISTS team_workspace_audit_logs (
          id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          action TEXT NOT NULL,
          target_id TEXT,
          details TEXT,
          created_at TEXT NOT NULL,
          FOREIGN KEY (workspace_id) REFERENCES team_workspaces(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_team_ws_audit_ws ON team_workspace_audit_logs(workspace_id);
        CREATE INDEX IF NOT EXISTS idx_team_ws_audit_user ON team_workspace_audit_logs(user_id);
        CREATE INDEX IF NOT EXISTS idx_team_ws_audit_action ON team_workspace_audit_logs(action);
      `);
    } catch {}
    db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (12, ?)').run(new Date().toISOString());
  }

  // Migration v13: Phase 5 Commercial Proxy Provider Integration & Catalog
  const checkMigration13 = db.prepare('SELECT version FROM schema_migrations WHERE version = 13').get();
  if (!checkMigration13) {
    try {
      db.exec(`
        CREATE TABLE IF NOT EXISTS proxy_providers (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT,
          website TEXT,
          is_enabled INTEGER NOT NULL DEFAULT 1,
          priority INTEGER NOT NULL DEFAULT 100,
          capabilities_json TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS proxy_provider_sessions (
          id TEXT PRIMARY KEY,
          provider_id TEXT NOT NULL,
          proxy_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          workspace_id TEXT,
          profile_id TEXT,
          network_type TEXT NOT NULL,
          country TEXT NOT NULL,
          region TEXT,
          city TEXT,
          session_type TEXT NOT NULL,
          upstream_session_id TEXT NOT NULL,
          ttl_minutes INTEGER,
          expires_at TEXT,
          rotatable INTEGER NOT NULL DEFAULT 1,
          rotation_count INTEGER NOT NULL DEFAULT 0,
          status TEXT NOT NULL DEFAULT 'ACTIVE',
          bytes_used INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (proxy_id) REFERENCES proxies(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_proxy_sessions_user ON proxy_provider_sessions(user_id);
        CREATE INDEX IF NOT EXISTS idx_proxy_sessions_ws ON proxy_provider_sessions(workspace_id);
        CREATE INDEX IF NOT EXISTS idx_proxy_sessions_proxy ON proxy_provider_sessions(proxy_id);
        CREATE INDEX IF NOT EXISTS idx_proxy_sessions_provider ON proxy_provider_sessions(provider_id);
        CREATE INDEX IF NOT EXISTS idx_proxy_sessions_status ON proxy_provider_sessions(status);

        CREATE TABLE IF NOT EXISTS proxy_usage_records (
          id TEXT PRIMARY KEY,
          session_id TEXT,
          provider_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          bytes_used INTEGER NOT NULL DEFAULT 0,
          recorded_at TEXT NOT NULL,
          FOREIGN KEY (session_id) REFERENCES proxy_provider_sessions(id) ON DELETE SET NULL
        );

        CREATE INDEX IF NOT EXISTS idx_proxy_usage_user ON proxy_usage_records(user_id);
        CREATE INDEX IF NOT EXISTS idx_proxy_usage_session ON proxy_usage_records(session_id);

        CREATE TABLE IF NOT EXISTS proxy_provider_health (
          provider_id TEXT PRIMARY KEY,
          status TEXT NOT NULL DEFAULT 'UNCONFIGURED',
          latency_ms INTEGER,
          last_checked_at TEXT NOT NULL,
          error_message TEXT
        );
      `);

      // Additive columns to existing proxies table
      try { db.exec('ALTER TABLE proxies ADD COLUMN provider_id TEXT;'); } catch {}
      try { db.exec('ALTER TABLE proxies ADD COLUMN network_type TEXT;'); } catch {}
      try { db.exec('ALTER TABLE proxies ADD COLUMN session_type TEXT;'); } catch {}
      try { db.exec('ALTER TABLE proxies ADD COLUMN city TEXT;'); } catch {}
      try { db.exec('ALTER TABLE proxies ADD COLUMN region TEXT;'); } catch {}

      db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (13, ?)').run(new Date().toISOString());
    } catch {}
  }

  // Ensure additive columns exist regardless of migration cache
  try { db.exec('ALTER TABLE proxies ADD COLUMN city TEXT;'); } catch {}
  try { db.exec('ALTER TABLE proxies ADD COLUMN region TEXT;'); } catch {}
  try { db.exec('ALTER TABLE proxies ADD COLUMN provider_id TEXT;'); } catch {}
  try { db.exec('ALTER TABLE proxies ADD COLUMN network_type TEXT;'); } catch {}
  try { db.exec('ALTER TABLE proxies ADD COLUMN session_type TEXT;'); } catch {}

  // Clean legacy auto-warmed status lines from user notes
  try {
    const rows = db.prepare("SELECT id, notes FROM profiles WHERE notes LIKE '%[Auto-Warmed%'").all() as { id: string; notes: string }[];
    for (const r of rows) {
      const cleanNotes = (r.notes || '').replace(/\[Auto-Warmed on[^\]]*\][^\n]*/g, '').trim();
      db.prepare('UPDATE profiles SET notes = ? WHERE id = ?').run(cleanNotes, r.id);
    }
  } catch {}
}




