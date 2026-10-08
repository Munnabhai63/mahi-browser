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

  // Migration v14: Phase 6 Remote Cloud API, API Keys, Webhooks & Idempotency
  const checkMigration14 = db.prepare('SELECT version FROM schema_migrations WHERE version = 14').get();
  if (!checkMigration14) {
    try {
      db.exec(`
        CREATE TABLE IF NOT EXISTS remote_api_keys (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          workspace_id TEXT,
          name TEXT NOT NULL,
          key_prefix TEXT NOT NULL,
          key_hash TEXT NOT NULL UNIQUE,
          scopes_json TEXT NOT NULL DEFAULT '["profiles:read"]',
          status TEXT NOT NULL DEFAULT 'ACTIVE',
          rate_limit_per_min INTEGER NOT NULL DEFAULT 120,
          requests_count_month INTEGER NOT NULL DEFAULT 0,
          last_used_at TEXT,
          expires_at TEXT,
          created_at TEXT NOT NULL,
          revoked_at TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_remote_keys_user ON remote_api_keys(user_id);
        CREATE INDEX IF NOT EXISTS idx_remote_keys_ws ON remote_api_keys(workspace_id);
        CREATE INDEX IF NOT EXISTS idx_remote_keys_hash ON remote_api_keys(key_hash);
        CREATE INDEX IF NOT EXISTS idx_remote_keys_status ON remote_api_keys(status);

        CREATE TABLE IF NOT EXISTS remote_api_key_audits (
          id TEXT PRIMARY KEY,
          key_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          action TEXT NOT NULL,
          ip_address TEXT,
          details TEXT,
          created_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_remote_key_audits_user ON remote_api_key_audits(user_id);
        CREATE INDEX IF NOT EXISTS idx_remote_key_audits_key ON remote_api_key_audits(key_id);

        CREATE TABLE IF NOT EXISTS webhook_endpoints (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          workspace_id TEXT,
          url TEXT NOT NULL,
          description TEXT,
          secret_hash TEXT NOT NULL,
          secret_encrypted TEXT NOT NULL,
          events_json TEXT NOT NULL DEFAULT '["*"]',
          status TEXT NOT NULL DEFAULT 'ACTIVE',
          failure_count INTEGER NOT NULL DEFAULT 0,
          last_delivery_at TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_webhooks_user ON webhook_endpoints(user_id);
        CREATE INDEX IF NOT EXISTS idx_webhooks_ws ON webhook_endpoints(workspace_id);
        CREATE INDEX IF NOT EXISTS idx_webhooks_status ON webhook_endpoints(status);

        CREATE TABLE IF NOT EXISTS webhook_deliveries (
          id TEXT PRIMARY KEY,
          endpoint_id TEXT NOT NULL,
          event_id TEXT NOT NULL,
          event_type TEXT NOT NULL,
          payload_json TEXT NOT NULL,
          destination_url TEXT NOT NULL,
          status_code INTEGER,
          response_body TEXT,
          duration_ms INTEGER,
          attempt_count INTEGER NOT NULL DEFAULT 1,
          success INTEGER NOT NULL DEFAULT 0,
          error_message TEXT,
          delivered_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_wh_deliveries_endpoint ON webhook_deliveries(endpoint_id);
        CREATE INDEX IF NOT EXISTS idx_wh_deliveries_event ON webhook_deliveries(event_id);
        CREATE INDEX IF NOT EXISTS idx_wh_deliveries_success ON webhook_deliveries(success);

        CREATE TABLE IF NOT EXISTS api_idempotency_records (
          idempotency_key TEXT NOT NULL,
          user_id TEXT NOT NULL,
          endpoint TEXT NOT NULL,
          status_code INTEGER NOT NULL,
          response_json TEXT NOT NULL,
          created_at TEXT NOT NULL,
          expires_at TEXT NOT NULL,
          PRIMARY KEY (idempotency_key, user_id)
        );

        CREATE INDEX IF NOT EXISTS idx_idempotency_lookup ON api_idempotency_records(idempotency_key, user_id);
      `);

      db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (14, ?)').run(new Date().toISOString());
    } catch {}
  }

  // Migration v15: Phase 8 Production Automation & RPA Platform
  const checkMigration15 = db.prepare('SELECT version FROM schema_migrations WHERE version = 15').get();
  if (!checkMigration15) {
    try {
      db.exec(`
        CREATE TABLE IF NOT EXISTS automation_versions (
          id TEXT PRIMARY KEY,
          workflow_id TEXT NOT NULL,
          version INTEGER NOT NULL,
          definition_json TEXT NOT NULL,
          created_at TEXT NOT NULL,
          created_by TEXT,
          FOREIGN KEY (workflow_id) REFERENCES automation_workflows(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_auto_versions_wf ON automation_versions(workflow_id);

        CREATE TABLE IF NOT EXISTS automation_runs (
          id TEXT PRIMARY KEY,
          workflow_id TEXT NOT NULL,
          workflow_version INTEGER NOT NULL DEFAULT 1,
          profile_id TEXT NOT NULL,
          workspace_id TEXT,
          status TEXT NOT NULL DEFAULT 'QUEUED',
          started_at TEXT NOT NULL,
          completed_at TEXT,
          duration_ms INTEGER,
          failed_step_id TEXT,
          retry_count INTEGER NOT NULL DEFAULT 0,
          summary TEXT,
          variables_snapshot_json TEXT,
          step_logs_json TEXT NOT NULL DEFAULT '[]',
          created_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_auto_runs_wf ON automation_runs(workflow_id);
        CREATE INDEX IF NOT EXISTS idx_auto_runs_prof ON automation_runs(profile_id);
        CREATE INDEX IF NOT EXISTS idx_auto_runs_ws ON automation_runs(workspace_id);
        CREATE INDEX IF NOT EXISTS idx_auto_runs_status ON automation_runs(status);

        CREATE TABLE IF NOT EXISTS automation_schedules (
          id TEXT PRIMARY KEY,
          workflow_id TEXT NOT NULL,
          profile_id TEXT,
          profile_ids_json TEXT,
          workspace_id TEXT,
          schedule_type TEXT NOT NULL,
          cron_expression TEXT,
          timezone TEXT NOT NULL DEFAULT 'UTC',
          next_run_at TEXT,
          last_run_at TEXT,
          status TEXT NOT NULL DEFAULT 'ACTIVE',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (workflow_id) REFERENCES automation_workflows(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_auto_sched_wf ON automation_schedules(workflow_id);
        CREATE INDEX IF NOT EXISTS idx_auto_sched_status ON automation_schedules(status);

        CREATE TABLE IF NOT EXISTS automation_templates (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          category TEXT NOT NULL,
          description TEXT,
          icon TEXT,
          is_builtin INTEGER NOT NULL DEFAULT 0,
          workspace_id TEXT,
          workflow_json TEXT NOT NULL,
          created_at TEXT NOT NULL
        );
      `);

      // Additive columns to existing automation tables
      try { db.exec('ALTER TABLE automation_workflows ADD COLUMN version INTEGER NOT NULL DEFAULT 1;'); } catch {}
      try { db.exec('ALTER TABLE automation_workflows ADD COLUMN workspace_id TEXT;'); } catch {}
      try { db.exec("ALTER TABLE automation_workflows ADD COLUMN variables_json TEXT NOT NULL DEFAULT '[]';"); } catch {}
      try { db.exec("ALTER TABLE automation_workflows ADD COLUMN settings_json TEXT NOT NULL DEFAULT '{}';"); } catch {}
      try { db.exec("ALTER TABLE automation_workflows ADD COLUMN tags_json TEXT NOT NULL DEFAULT '[]';"); } catch {}

      try { db.exec('ALTER TABLE automation_steps ADD COLUMN retry_count INTEGER NOT NULL DEFAULT 0;'); } catch {}
      try { db.exec('ALTER TABLE automation_steps ADD COLUMN retry_delay_ms INTEGER NOT NULL DEFAULT 1000;'); } catch {}
      try { db.exec('ALTER TABLE automation_steps ADD COLUMN condition_json TEXT;'); } catch {}
      try { db.exec('ALTER TABLE automation_steps ADD COLUMN loop_config_json TEXT;'); } catch {}
      try { db.exec('ALTER TABLE automation_steps ADD COLUMN output_variable_name TEXT;'); } catch {}
      try { db.exec('ALTER TABLE automation_steps ADD COLUMN is_secret INTEGER NOT NULL DEFAULT 0;'); } catch {}

      db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (15, ?)').run(new Date().toISOString());
    } catch {}
  }

  // Migration v16: Phase 10 Real Cloud Browser Infrastructure & Remote Interactive Sessions
  const checkMigration16 = db.prepare('SELECT version FROM schema_migrations WHERE version = 16').get();
  if (!checkMigration16) {
    try {
      db.exec(`
        CREATE TABLE IF NOT EXISTS cloud_browser_regions (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          endpoint_url TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'ACTIVE',
          is_default INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS cloud_browser_workers (
          id TEXT PRIMARY KEY,
          region_id TEXT NOT NULL,
          hostname TEXT NOT NULL,
          ip_address TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'ONLINE',
          capacity INTEGER NOT NULL DEFAULT 10,
          active_sessions INTEGER NOT NULL DEFAULT 0,
          cpu_usage_pct REAL DEFAULT 0.0,
          memory_usage_mb REAL DEFAULT 0.0,
          last_heartbeat_at TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (region_id) REFERENCES cloud_browser_regions(id) ON DELETE RESTRICT
        );

        CREATE INDEX IF NOT EXISTS idx_cb_workers_region ON cloud_browser_workers(region_id);
        CREATE INDEX IF NOT EXISTS idx_cb_workers_status ON cloud_browser_workers(status);

        CREATE TABLE IF NOT EXISTS cloud_browser_sessions (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          workspace_id TEXT,
          profile_id TEXT NOT NULL,
          worker_id TEXT,
          region_id TEXT NOT NULL DEFAULT 'in-west',
          status TEXT NOT NULL DEFAULT 'REQUESTED',
          resource_class TEXT NOT NULL DEFAULT 'STANDARD',
          profile_version INTEGER NOT NULL DEFAULT 1,
          lock_id TEXT,
          session_token_hash TEXT,
          stream_gateway_url TEXT,
          cdp_port INTEGER,
          duration_seconds INTEGER NOT NULL DEFAULT 0,
          max_duration_seconds INTEGER NOT NULL DEFAULT 3600,
          idle_timeout_seconds INTEGER NOT NULL DEFAULT 600,
          last_activity_at TEXT NOT NULL,
          started_at TEXT,
          ended_at TEXT,
          termination_reason TEXT,
          error_message TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_cb_sessions_user ON cloud_browser_sessions(user_id);
        CREATE INDEX IF NOT EXISTS idx_cb_sessions_prof ON cloud_browser_sessions(profile_id);
        CREATE INDEX IF NOT EXISTS idx_cb_sessions_status ON cloud_browser_sessions(status);
        CREATE INDEX IF NOT EXISTS idx_cb_sessions_worker ON cloud_browser_sessions(worker_id);

        CREATE TABLE IF NOT EXISTS cloud_browser_events (
          id TEXT PRIMARY KEY,
          session_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          event_type TEXT NOT NULL,
          details_json TEXT,
          created_at TEXT NOT NULL,
          FOREIGN KEY (session_id) REFERENCES cloud_browser_sessions(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_cb_events_session ON cloud_browser_events(session_id);
        CREATE INDEX IF NOT EXISTS idx_cb_events_type ON cloud_browser_events(event_type);

        CREATE TABLE IF NOT EXISTS cloud_browser_usage (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          workspace_id TEXT,
          session_id TEXT NOT NULL,
          duration_seconds INTEGER NOT NULL,
          resource_class TEXT NOT NULL,
          region_id TEXT NOT NULL,
          created_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_cb_usage_user ON cloud_browser_usage(user_id);
        CREATE INDEX IF NOT EXISTS idx_cb_usage_ws ON cloud_browser_usage(workspace_id);
      `);

      // Seed default cloud browser regions
      const now = new Date().toISOString();
      const insertRegion = db.prepare(`
        INSERT OR IGNORE INTO cloud_browser_regions (id, name, endpoint_url, status, is_default, created_at)
        VALUES (?, ?, ?, 'ACTIVE', ?, ?)
      `);
      insertRegion.run('in-west', 'India (Mumbai) - Local Node', 'https://in-west.cloud.mahibrowser.com', 1, now);
      insertRegion.run('sg-central', 'Singapore (Central)', 'https://sg-central.cloud.mahibrowser.com', 0, now);
      insertRegion.run('us-east', 'US East (N. Virginia)', 'https://us-east.cloud.mahibrowser.com', 0, now);
      insertRegion.run('eu-central', 'EU Central (Frankfurt)', 'https://eu-central.cloud.mahibrowser.com', 0, now);

      db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (16, ?)').run(now);
    } catch {}
  }

  // Migration v17: Phase 11 Android Mobile Companion & Push Notifications
  const checkMigration17 = db.prepare('SELECT version FROM schema_migrations WHERE version = 17').get();
  if (!checkMigration17) {
    try {
      db.exec(`
        CREATE TABLE IF NOT EXISTS mobile_device_tokens (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          device_id TEXT NOT NULL,
          push_token TEXT NOT NULL,
          platform TEXT NOT NULL DEFAULT 'android',
          device_model TEXT,
          os_version TEXT,
          app_version TEXT,
          status TEXT NOT NULL DEFAULT 'ACTIVE',
          last_seen_at TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_mobile_tokens_user ON mobile_device_tokens(user_id);
        CREATE INDEX IF NOT EXISTS idx_mobile_tokens_dev ON mobile_device_tokens(device_id);

        CREATE TABLE IF NOT EXISTS mobile_notification_preferences (
          user_id TEXT PRIMARY KEY,
          security_alerts INTEGER NOT NULL DEFAULT 1,
          cloud_sessions INTEGER NOT NULL DEFAULT 1,
          automation_alerts INTEGER NOT NULL DEFAULT 1,
          workspace_alerts INTEGER NOT NULL DEFAULT 1,
          proxy_alerts INTEGER NOT NULL DEFAULT 1,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS mobile_notifications (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          category TEXT NOT NULL,
          title TEXT NOT NULL,
          body TEXT NOT NULL,
          data_json TEXT,
          read INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_mobile_notif_user ON mobile_notifications(user_id);
        CREATE INDEX IF NOT EXISTS idx_mobile_notif_cat ON mobile_notifications(category);
      `);

      db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (17, ?)').run(new Date().toISOString());
    } catch {}
  }

  // Migration v18: Commercial Payment Platform, Billing Invoices & Webhook Idempotency
  const checkMigration18 = db.prepare('SELECT version FROM schema_migrations WHERE version = 18').get();
  if (!checkMigration18) {
    try {
      db.exec(`
        CREATE TABLE IF NOT EXISTS commercial_payments (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          subscription_id TEXT,
          provider TEXT NOT NULL DEFAULT 'stripe',
          external_order_id TEXT,
          external_payment_id TEXT UNIQUE,
          amount_cents INTEGER NOT NULL,
          currency TEXT NOT NULL DEFAULT 'USD',
          status TEXT NOT NULL DEFAULT 'PENDING',
          plan_id TEXT NOT NULL,
          billing_cycle TEXT NOT NULL DEFAULT 'MONTHLY',
          receipt_url TEXT,
          metadata_json TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_comm_payments_user ON commercial_payments(user_id);
        CREATE INDEX IF NOT EXISTS idx_comm_payments_ext ON commercial_payments(external_payment_id);
        CREATE INDEX IF NOT EXISTS idx_comm_payments_status ON commercial_payments(status);

        CREATE TABLE IF NOT EXISTS commercial_billing_invoices (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          payment_id TEXT,
          invoice_number TEXT NOT NULL UNIQUE,
          amount_cents INTEGER NOT NULL,
          currency TEXT NOT NULL DEFAULT 'USD',
          status TEXT NOT NULL DEFAULT 'PAID',
          period_start TEXT NOT NULL,
          period_end TEXT NOT NULL,
          pdf_url TEXT,
          created_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_comm_invoices_user ON commercial_billing_invoices(user_id);

        CREATE TABLE IF NOT EXISTS commercial_webhook_events (
          id TEXT PRIMARY KEY,
          provider TEXT NOT NULL,
          event_type TEXT NOT NULL,
          payload_json TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'PROCESSED',
          created_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_comm_webhooks_prov ON commercial_webhook_events(provider, event_type);
      `);

      db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (18, ?)').run(new Date().toISOString());
    } catch {}
  }

  // Ensure additive columns exist regardless of migration cache
  try { db.exec('ALTER TABLE proxies ADD COLUMN city TEXT;'); } catch {}
  try { db.exec('ALTER TABLE proxies ADD COLUMN region TEXT;'); } catch {}
  try { db.exec('ALTER TABLE proxies ADD COLUMN provider_id TEXT;'); } catch {}
  try { db.exec('ALTER TABLE proxies ADD COLUMN network_type TEXT;'); } catch {}
  try { db.exec('ALTER TABLE proxies ADD COLUMN session_type TEXT;'); } catch {}

  try { db.exec('ALTER TABLE automation_workflows ADD COLUMN version INTEGER NOT NULL DEFAULT 1;'); } catch {}
  try { db.exec('ALTER TABLE automation_workflows ADD COLUMN workspace_id TEXT;'); } catch {}
  try { db.exec("ALTER TABLE automation_workflows ADD COLUMN variables_json TEXT NOT NULL DEFAULT '[]';"); } catch {}
  try { db.exec("ALTER TABLE automation_workflows ADD COLUMN settings_json TEXT NOT NULL DEFAULT '{}';"); } catch {}
  try { db.exec("ALTER TABLE automation_workflows ADD COLUMN tags_json TEXT NOT NULL DEFAULT '[]';"); } catch {}

  try { db.exec('ALTER TABLE automation_steps ADD COLUMN retry_count INTEGER NOT NULL DEFAULT 0;'); } catch {}
  try { db.exec('ALTER TABLE automation_steps ADD COLUMN retry_delay_ms INTEGER NOT NULL DEFAULT 1000;'); } catch {}
  try { db.exec('ALTER TABLE automation_steps ADD COLUMN condition_json TEXT;'); } catch {}
  try { db.exec('ALTER TABLE automation_steps ADD COLUMN loop_config_json TEXT;'); } catch {}
  try { db.exec('ALTER TABLE automation_steps ADD COLUMN output_variable_name TEXT;'); } catch {}
  try { db.exec('ALTER TABLE automation_steps ADD COLUMN is_secret INTEGER NOT NULL DEFAULT 0;'); } catch {}

  // Clean legacy auto-warmed status lines from user notes
  try {
    const rows = db.prepare("SELECT id, notes FROM profiles WHERE notes LIKE '%[Auto-Warmed%'").all() as { id: string; notes: string }[];
    for (const r of rows) {
      const cleanNotes = (r.notes || '').replace(/\[Auto-Warmed on[^\]]*\][^\n]*/g, '').trim();
      db.prepare('UPDATE profiles SET notes = ? WHERE id = ?').run(cleanNotes, r.id);
    }
  } catch {}
}




