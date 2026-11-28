import type { SqliteWrapper } from '../connection.js';
import { migrateLegacyCommercialUsersToAuthUsers } from '../../05_AUTH/user-model-unifier.js';
import { createLogger } from '../../07_BACKEND/utils/logger.js';
import { addColumnIfNotExists, runMigration } from './schema-helpers.js';

const log = createLogger('db-schema');

export function applyMigrationsV14ToV25(db: SqliteWrapper): void {
  // Migration v14: Phase 6 Remote Cloud API, API Keys, Webhooks & Idempotency
  runMigration(db, 14, 'remote api keys and webhooks', () => {
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
  });

  // Migration v15: Phase 8 Production Automation & RPA Platform
  runMigration(db, 15, 'automation platform and columns', () => {
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
    addColumnIfNotExists(db, 'automation_workflows', 'version', 'INTEGER NOT NULL DEFAULT 1');
    addColumnIfNotExists(db, 'automation_workflows', 'workspace_id', 'TEXT');
    addColumnIfNotExists(db, 'automation_workflows', 'variables_json', "TEXT NOT NULL DEFAULT '[]'");
    addColumnIfNotExists(db, 'automation_workflows', 'settings_json', "TEXT NOT NULL DEFAULT '{}'");
    addColumnIfNotExists(db, 'automation_workflows', 'tags_json', "TEXT NOT NULL DEFAULT '[]'");

    addColumnIfNotExists(db, 'automation_steps', 'retry_count', 'INTEGER NOT NULL DEFAULT 0');
    addColumnIfNotExists(db, 'automation_steps', 'retry_delay_ms', 'INTEGER NOT NULL DEFAULT 1000');
    addColumnIfNotExists(db, 'automation_steps', 'condition_json', 'TEXT');
    addColumnIfNotExists(db, 'automation_steps', 'loop_config_json', 'TEXT');
    addColumnIfNotExists(db, 'automation_steps', 'output_variable_name', 'TEXT');
    addColumnIfNotExists(db, 'automation_steps', 'is_secret', 'INTEGER NOT NULL DEFAULT 0');
  });

  // Migration v16: Phase 10 Real Cloud Browser Infrastructure & Remote Interactive Sessions
  runMigration(db, 16, 'cloud browser infrastructure', () => {
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
    insertRegion.run('in-west', 'India West (Mumbai)', 'wss://in-west.cloud.mahibrowser.com/stream', 1, now);
    insertRegion.run('us-east', 'US East (N. Virginia)', 'wss://us-east.cloud.mahibrowser.com/stream', 0, now);
    insertRegion.run('eu-central', 'Europe Central (Frankfurt)', 'wss://eu-central.cloud.mahibrowser.com/stream', 0, now);
    insertRegion.run('sg-central', 'Asia Pacific (Singapore)', 'wss://sg-central.cloud.mahibrowser.com/stream', 0, now);
    insertRegion.run('ap-southeast', 'Asia Pacific (Singapore)', 'wss://ap-southeast.cloud.mahibrowser.com/stream', 0, now);
  });

  // Migration v17: Phase 11 Android Mobile Companion & Push Notifications
  runMigration(db, 17, 'mobile device tokens and notifications', () => {
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
  });

  // Migration v18: Commercial Payment Platform, Billing Invoices & Webhook Idempotency
  runMigration(db, 18, 'commercial payments and billing invoices', () => {
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
  });

  // Ensure additive columns exist regardless of migration cache
  addColumnIfNotExists(db, 'proxies', 'city', 'TEXT');
  addColumnIfNotExists(db, 'proxies', 'region', 'TEXT');
  addColumnIfNotExists(db, 'proxies', 'provider_id', 'TEXT');
  addColumnIfNotExists(db, 'proxies', 'network_type', 'TEXT');
  addColumnIfNotExists(db, 'proxies', 'session_type', 'TEXT');

  addColumnIfNotExists(db, 'automation_workflows', 'version', 'INTEGER NOT NULL DEFAULT 1');
  addColumnIfNotExists(db, 'automation_workflows', 'workspace_id', 'TEXT');
  addColumnIfNotExists(db, 'automation_workflows', 'variables_json', "TEXT NOT NULL DEFAULT '[]'");
  addColumnIfNotExists(db, 'automation_workflows', 'settings_json', "TEXT NOT NULL DEFAULT '{}'");
  addColumnIfNotExists(db, 'automation_workflows', 'tags_json', "TEXT NOT NULL DEFAULT '[]'");

  addColumnIfNotExists(db, 'automation_steps', 'retry_count', 'INTEGER NOT NULL DEFAULT 0');
  addColumnIfNotExists(db, 'automation_steps', 'retry_delay_ms', 'INTEGER NOT NULL DEFAULT 1000');
  addColumnIfNotExists(db, 'automation_steps', 'condition_json', 'TEXT');
  addColumnIfNotExists(db, 'automation_steps', 'loop_config_json', 'TEXT');
  addColumnIfNotExists(db, 'automation_steps', 'output_variable_name', 'TEXT');
  addColumnIfNotExists(db, 'automation_steps', 'is_secret', 'INTEGER NOT NULL DEFAULT 0');

  // Clean legacy auto-warmed status lines from user notes
  try {
    const rows = db.prepare("SELECT id, notes FROM profiles WHERE notes LIKE '%[Auto-Warmed%'").all() as { id: string; notes: string }[];
    for (const r of rows) {
      const cleanNotes = (r.notes || '').replace(/\[Auto-Warmed on[^\]]*\][^\n]*/g, '').trim();
      db.prepare('UPDATE profiles SET notes = ? WHERE id = ?').run(cleanNotes, r.id);
    }
  } catch (cleanErr) {
    log.debug('Legacy auto-warmed profile notes cleanup skipped', {
      err: cleanErr instanceof Error ? cleanErr.message : String(cleanErr),
    });
  }

  // Migration v19: Production Business Model — Pricing Versioning, Provider Mapping, Usage Ledger
  runMigration(db, 19, 'pricing versioning and audit log', () => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS pricing_audit_log (
        id TEXT PRIMARY KEY,
        admin_id TEXT NOT NULL,
        action TEXT NOT NULL,
        old_data TEXT,
        new_data TEXT,
        subscriber_policy TEXT,
        pricing_version INTEGER,
        provider_sync_result TEXT,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_pricing_audit_version ON pricing_audit_log(pricing_version);
    `);

    addColumnIfNotExists(db, 'commercial_subscriptions', 'pricing_version', 'INTEGER');
    addColumnIfNotExists(db, 'commercial_subscriptions', 'cancel_at_period_end', 'INTEGER NOT NULL DEFAULT 0');

    addColumnIfNotExists(db, 'commercial_billing_invoices', 'pricing_version', 'INTEGER');
    addColumnIfNotExists(db, 'commercial_billing_invoices', 'plan_id', 'TEXT');
    addColumnIfNotExists(db, 'commercial_billing_invoices', 'plan_name', 'TEXT');
    addColumnIfNotExists(db, 'commercial_billing_invoices', 'discount_paise', 'INTEGER NOT NULL DEFAULT 0');
    addColumnIfNotExists(db, 'commercial_billing_invoices', 'tax_paise', 'INTEGER NOT NULL DEFAULT 0');
  });

  // Migration v20: Website CTA -> Auth -> Trial / Demo / Funnel Infrastructure
  runMigration(db, 20, 'demo requests funnel events and trial columns', () => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS demo_requests (
        id TEXT PRIMARY KEY,
        full_name TEXT NOT NULL,
        email TEXT NOT NULL,
        company_name TEXT,
        team_size TEXT,
        use_case TEXT,
        contact_method TEXT DEFAULT 'Email',
        preferred_datetime TEXT,
        message TEXT,
        status TEXT NOT NULL DEFAULT 'NEW',
        admin_notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_demo_status ON demo_requests(status);
      CREATE INDEX IF NOT EXISTS idx_demo_email ON demo_requests(email);

      CREATE TABLE IF NOT EXISTS funnel_events (
        id TEXT PRIMARY KEY,
        event_name TEXT NOT NULL,
        user_id TEXT,
        anonymous_id TEXT,
        plan_id TEXT,
        billing_cycle TEXT,
        source_url TEXT,
        ip_address TEXT,
        metadata_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_funnel_event_name ON funnel_events(event_name);
      CREATE INDEX IF NOT EXISTS idx_funnel_created ON funnel_events(created_at);
    `);

    addColumnIfNotExists(db, 'commercial_users', 'trial_started_at', 'TEXT');
    addColumnIfNotExists(db, 'commercial_users', 'trial_expires_at', 'TEXT');
    addColumnIfNotExists(db, 'commercial_users', 'trial_used', 'INTEGER NOT NULL DEFAULT 0');
    addColumnIfNotExists(db, 'commercial_users', 'signup_intent', 'TEXT');
    addColumnIfNotExists(db, 'commercial_users', 'pending_plan_id', 'TEXT');
    addColumnIfNotExists(db, 'commercial_users', 'pending_billing_cycle', 'TEXT');

    addColumnIfNotExists(db, 'auth_users', 'trial_started_at', 'TEXT');
    addColumnIfNotExists(db, 'auth_users', 'trial_expires_at', 'TEXT');
    addColumnIfNotExists(db, 'auth_users', 'trial_used', 'INTEGER NOT NULL DEFAULT 0');
    addColumnIfNotExists(db, 'auth_users', 'signup_intent', 'TEXT');
  });

  // Migration v21: Phase 19 Production Google OAuth SSO Architecture
  runMigration(db, 21, 'google oauth sso and avatar columns', () => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS oauth_states (
        state TEXT PRIMARY KEY,
        nonce TEXT NOT NULL,
        provider TEXT NOT NULL DEFAULT 'google',
        intent TEXT NOT NULL DEFAULT 'trial',
        plan_id TEXT,
        billing_cycle TEXT,
        return_url TEXT,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        accepted_terms INTEGER DEFAULT NULL,
        terms_version TEXT DEFAULT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_oauth_states_expires ON oauth_states(expires_at);
    `);

    addColumnIfNotExists(db, 'commercial_users', 'google_sub', 'TEXT');
    addColumnIfNotExists(db, 'commercial_users', 'avatar_url', 'TEXT');
    addColumnIfNotExists(db, 'commercial_users', 'auth_provider', "TEXT DEFAULT 'LOCAL'");

    addColumnIfNotExists(db, 'auth_users', 'google_sub', 'TEXT');
    addColumnIfNotExists(db, 'auth_users', 'avatar_url', 'TEXT');
    addColumnIfNotExists(db, 'auth_users', 'auth_provider', "TEXT DEFAULT 'LOCAL'");
  });

  // Migration v22: Phase 20 Support Tickets & Payment Escalation Architecture
  runMigration(db, 22, 'support tickets and escalation', () => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS support_tickets (
        id TEXT PRIMARY KEY,
        ticket_number TEXT NOT NULL UNIQUE,
        category TEXT NOT NULL,
        user_email TEXT,
        user_name TEXT,
        message TEXT NOT NULL,
        reply TEXT,
        source TEXT DEFAULT 'landing_ai_chat',
        status TEXT DEFAULT 'OPEN',
        is_escalated INTEGER NOT NULL DEFAULT 0,
        escalation_reason TEXT,
        email_sent INTEGER NOT NULL DEFAULT 0,
        admin_notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_support_tickets_category ON support_tickets(category);
      CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);
      CREATE INDEX IF NOT EXISTS idx_support_tickets_created ON support_tickets(created_at);
    `);
  });

  // Migration v23: Phase 23 Admin Operations, Quota Boosters & Enterprise Overrides
  runMigration(db, 23, 'quota boosters and enterprise overrides', () => {
    addColumnIfNotExists(db, 'commercial_users', 'bonus_profiles', 'INTEGER NOT NULL DEFAULT 0');
    addColumnIfNotExists(db, 'commercial_users', 'bonus_proxy_bytes', 'INTEGER NOT NULL DEFAULT 0');
    addColumnIfNotExists(db, 'commercial_users', 'feature_overrides', "TEXT NOT NULL DEFAULT '{}'");
  });

  // Ensure authoritative auth_users owns all commercial/trial/quota columns
  addColumnIfNotExists(db, 'auth_users', 'bonus_profiles', 'INTEGER NOT NULL DEFAULT 0');
  addColumnIfNotExists(db, 'auth_users', 'bonus_proxy_bytes', 'INTEGER NOT NULL DEFAULT 0');
  addColumnIfNotExists(db, 'auth_users', 'feature_overrides', "TEXT NOT NULL DEFAULT '{}'");
  addColumnIfNotExists(db, 'auth_users', 'pending_plan_id', 'TEXT');
  addColumnIfNotExists(db, 'auth_users', 'pending_billing_cycle', 'TEXT');

  // Consolidate any pre-existing legacy commercial_users rows into authoritative auth_users on init
  migrateLegacyCommercialUsersToAuthUsers(db);

  // Migration v24: Commercial Devices Status, Audit Logs Table & Indexes
  runMigration(db, 24, 'commercial devices status and audit logs', () => {
    addColumnIfNotExists(db, 'commercial_devices', 'status', "TEXT NOT NULL DEFAULT 'ACTIVE'");
    addColumnIfNotExists(db, 'commercial_devices', 'license_id', 'TEXT');
    addColumnIfNotExists(db, 'commercial_devices', 'os_info', 'TEXT');
    addColumnIfNotExists(db, 'commercial_devices', 'client_version', 'TEXT');
    addColumnIfNotExists(db, 'commercial_devices', 'activated_at', 'TEXT');

    db.exec(`
      CREATE TABLE IF NOT EXISTS commercial_audit_logs (
        id TEXT PRIMARY KEY,
        actor_id TEXT NOT NULL,
        actor_name TEXT NOT NULL,
        actor_role TEXT NOT NULL,
        action TEXT NOT NULL,
        target_type TEXT NOT NULL,
        target_id TEXT,
        details TEXT,
        ip_address TEXT,
        result TEXT NOT NULL DEFAULT 'SUCCESS',
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_comm_audit_actor ON commercial_audit_logs(actor_id);
      CREATE INDEX IF NOT EXISTS idx_comm_audit_action ON commercial_audit_logs(action);
      CREATE INDEX IF NOT EXISTS idx_comm_audit_created ON commercial_audit_logs(created_at);
    `);
  });

  // Migration v25: Additive compatibility columns for commercial, workspace, and cloud tables
  runMigration(db, 25, 'additive compatibility columns v25', () => {
    addColumnIfNotExists(db, 'commercial_plans', 'updated_at', 'TEXT');

    addColumnIfNotExists(db, 'commercial_subscriptions', 'auto_renew', 'INTEGER NOT NULL DEFAULT 1');
    addColumnIfNotExists(db, 'commercial_subscriptions', 'updated_at', 'TEXT');

    addColumnIfNotExists(db, 'commercial_devices', 'created_at', 'TEXT');
    addColumnIfNotExists(db, 'commercial_devices', 'platform', 'TEXT');
    addColumnIfNotExists(db, 'commercial_devices', 'status', "TEXT NOT NULL DEFAULT 'ACTIVE'");
    addColumnIfNotExists(db, 'commercial_devices', 'license_id', 'TEXT');
    addColumnIfNotExists(db, 'commercial_devices', 'os_info', 'TEXT');
    addColumnIfNotExists(db, 'commercial_devices', 'client_version', 'TEXT');
    addColumnIfNotExists(db, 'commercial_devices', 'activated_at', 'TEXT');

    addColumnIfNotExists(db, 'workspace_members', 'avatar_color', "TEXT DEFAULT '#6366f1'");
    addColumnIfNotExists(db, 'workspace_members', 'invited_at', 'TEXT');
    addColumnIfNotExists(db, 'workspace_members', 'joined_at', 'TEXT');
    addColumnIfNotExists(db, 'workspace_members', 'last_active_at', 'TEXT');

    addColumnIfNotExists(db, 'cloud_browser_regions', 'gateway_url', 'TEXT');
    addColumnIfNotExists(db, 'cloud_browser_regions', 'is_active', 'INTEGER NOT NULL DEFAULT 1');
    addColumnIfNotExists(db, 'cloud_browser_regions', 'updated_at', 'TEXT');

    addColumnIfNotExists(db, 'cloud_browser_workers', 'capacity_slots', 'INTEGER DEFAULT 10');
    addColumnIfNotExists(db, 'cloud_browser_workers', 'used_slots', 'INTEGER DEFAULT 0');
    addColumnIfNotExists(db, 'cloud_browser_workers', 'ram_usage_pct', 'REAL DEFAULT 0.0');
  });

  // Guarantee critical additive columns exist regardless of previous migration execution state
  addColumnIfNotExists(db, 'commercial_plans', 'updated_at', 'TEXT');
  addColumnIfNotExists(db, 'commercial_subscriptions', 'auto_renew', 'INTEGER NOT NULL DEFAULT 1');
  addColumnIfNotExists(db, 'commercial_subscriptions', 'updated_at', 'TEXT');
  addColumnIfNotExists(db, 'commercial_devices', 'created_at', 'TEXT');
  addColumnIfNotExists(db, 'commercial_devices', 'platform', 'TEXT');
  addColumnIfNotExists(db, 'commercial_devices', 'status', "TEXT NOT NULL DEFAULT 'ACTIVE'");
  addColumnIfNotExists(db, 'commercial_devices', 'license_id', 'TEXT');
  addColumnIfNotExists(db, 'commercial_devices', 'os_info', 'TEXT');
  addColumnIfNotExists(db, 'commercial_devices', 'client_version', 'TEXT');
  addColumnIfNotExists(db, 'commercial_devices', 'activated_at', 'TEXT');
  addColumnIfNotExists(db, 'workspace_members', 'avatar_color', "TEXT DEFAULT '#6366f1'");
  addColumnIfNotExists(db, 'workspace_members', 'invited_at', 'TEXT');
  addColumnIfNotExists(db, 'workspace_members', 'joined_at', 'TEXT');
  addColumnIfNotExists(db, 'workspace_members', 'last_active_at', 'TEXT');
  addColumnIfNotExists(db, 'cloud_browser_regions', 'gateway_url', 'TEXT');
  addColumnIfNotExists(db, 'cloud_browser_regions', 'endpoint_url', "TEXT NOT NULL DEFAULT ''");
  addColumnIfNotExists(db, 'cloud_browser_regions', 'is_active', 'INTEGER NOT NULL DEFAULT 1');
  addColumnIfNotExists(db, 'cloud_browser_regions', 'is_default', 'INTEGER NOT NULL DEFAULT 0');
  addColumnIfNotExists(db, 'cloud_browser_regions', 'status', "TEXT NOT NULL DEFAULT 'ACTIVE'");
  addColumnIfNotExists(db, 'cloud_browser_regions', 'updated_at', 'TEXT');
  addColumnIfNotExists(db, 'cloud_browser_workers', 'hostname', "TEXT NOT NULL DEFAULT 'localhost'");
  addColumnIfNotExists(db, 'cloud_browser_workers', 'ip_address', "TEXT NOT NULL DEFAULT '127.0.0.1'");
  addColumnIfNotExists(db, 'cloud_browser_workers', 'capacity_slots', 'INTEGER DEFAULT 10');
  addColumnIfNotExists(db, 'cloud_browser_workers', 'used_slots', 'INTEGER DEFAULT 0');
  addColumnIfNotExists(db, 'cloud_browser_workers', 'ram_usage_pct', 'REAL DEFAULT 0.0');
  addColumnIfNotExists(db, 'cloud_browser_workers', 'memory_usage_mb', 'REAL DEFAULT 0.0');
  addColumnIfNotExists(db, 'cloud_browser_workers', 'cpu_usage_pct', 'REAL DEFAULT 0.0');
  addColumnIfNotExists(db, 'cloud_browser_workers', 'active_sessions', 'INTEGER DEFAULT 0');
  addColumnIfNotExists(db, 'cloud_browser_workers', 'max_sessions', 'INTEGER DEFAULT 10');
  addColumnIfNotExists(db, 'cloud_browser_workers', 'last_heartbeat', 'TEXT');

  db.exec(`
    CREATE TABLE IF NOT EXISTS cloud_browser_usage (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      workspace_id TEXT,
      session_id TEXT NOT NULL,
      duration_seconds INTEGER NOT NULL,
      resource_class TEXT NOT NULL DEFAULT 'STANDARD',
      region_id TEXT NOT NULL DEFAULT 'in-west',
      created_at TEXT NOT NULL
    );
  `);

  addColumnIfNotExists(db, 'cloud_browser_usage', 'resource_class', "TEXT NOT NULL DEFAULT 'STANDARD'");
  addColumnIfNotExists(db, 'cloud_browser_usage', 'region_id', "TEXT NOT NULL DEFAULT 'in-west'");
  addColumnIfNotExists(db, 'cloud_browser_usage', 'created_at', 'TEXT');

  db.exec(`
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
  `);

  // Terms Acceptance Audit Trail
  addColumnIfNotExists(db, 'commercial_users', 'accepted_terms', 'INTEGER DEFAULT NULL');
  addColumnIfNotExists(db, 'commercial_users', 'terms_version', 'TEXT DEFAULT NULL');
  addColumnIfNotExists(db, 'auth_users', 'accepted_terms', 'INTEGER DEFAULT NULL');
  addColumnIfNotExists(db, 'auth_users', 'terms_version', 'TEXT DEFAULT NULL');
  addColumnIfNotExists(db, 'oauth_states', 'accepted_terms', 'INTEGER DEFAULT NULL');
  addColumnIfNotExists(db, 'oauth_states', 'terms_version', 'TEXT DEFAULT NULL');

  // Cookie-only delta sync snapshots & manifest metadata (additive idempotent schema)
  db.exec(`
    CREATE TABLE IF NOT EXISTS cloud_profile_deltas (
      id TEXT PRIMARY KEY,
      cloud_profile_id TEXT NOT NULL,
      base_version INTEGER NOT NULL,
      delta_version INTEGER NOT NULL,
      delta_type TEXT NOT NULL DEFAULT 'cookies_only',
      manifest_hash TEXT,
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
    CREATE INDEX IF NOT EXISTS idx_cloud_deltas_profile ON cloud_profile_deltas(cloud_profile_id);
    CREATE INDEX IF NOT EXISTS idx_cloud_deltas_profile_ver ON cloud_profile_deltas(cloud_profile_id, delta_version);
  `);
  addColumnIfNotExists(db, 'cloud_sync_upload_sessions', 'archive_format', "TEXT NOT NULL DEFAULT 'full'");
  addColumnIfNotExists(db, 'cloud_sync_upload_sessions', 'manifest_hash', 'TEXT DEFAULT NULL');
}
