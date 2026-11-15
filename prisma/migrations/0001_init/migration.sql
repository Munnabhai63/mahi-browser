-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "auth_users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "normalized_email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "salt" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "email_verified" INTEGER NOT NULL DEFAULT 0,
    "email_verified_at" TEXT,
    "plan_id" TEXT NOT NULL DEFAULT 'plan_free',
    "profile_quota" INTEGER NOT NULL DEFAULT 10,
    "trial_started_at" TEXT,
    "trial_expires_at" TEXT,
    "trial_used" INTEGER NOT NULL DEFAULT 0,
    "signup_intent" TEXT,
    "google_sub" TEXT,
    "avatar_url" TEXT,
    "auth_provider" TEXT DEFAULT 'LOCAL',
    "created_at" TEXT NOT NULL,
    "updated_at" TEXT NOT NULL,
    "last_login_at" TEXT,

    CONSTRAINT "auth_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "refresh_token_hash" TEXT NOT NULL,
    "device_id" TEXT NOT NULL,
    "device_name" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "ip_address" TEXT,
    "is_revoked" INTEGER NOT NULL DEFAULT 0,
    "created_at" TEXT NOT NULL,
    "last_used_at" TEXT NOT NULL,
    "expires_at" TEXT NOT NULL,

    CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_verification_tokens" (
    "id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "expires_at" TEXT NOT NULL,
    "created_at" TEXT NOT NULL,
    "used_at" TEXT,

    CONSTRAINT "auth_verification_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_security_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "action" TEXT NOT NULL,
    "ip_address" TEXT,
    "details" TEXT,
    "result" TEXT NOT NULL,
    "created_at" TEXT NOT NULL,

    CONSTRAINT "auth_security_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "oauth_states" (
    "state" TEXT NOT NULL,
    "nonce" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'google',
    "intent" TEXT NOT NULL DEFAULT 'trial',
    "plan_id" TEXT,
    "billing_cycle" TEXT,
    "return_url" TEXT,
    "expires_at" TEXT NOT NULL,
    "created_at" TEXT NOT NULL,

    CONSTRAINT "oauth_states_pkey" PRIMARY KEY ("state")
);

-- CreateTable
CREATE TABLE "web_handoff_sessions" (
    "code" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "user_json" TEXT NOT NULL,
    "created_at" BIGINT NOT NULL,
    "expires_at" BIGINT NOT NULL,
    "used" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "web_handoff_sessions_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "commercial_users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "salt" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "plan_id" TEXT NOT NULL DEFAULT 'plan_free',
    "bonus_profiles" INTEGER NOT NULL DEFAULT 0,
    "bonus_proxy_bytes" BIGINT NOT NULL DEFAULT 0,
    "feature_overrides" TEXT NOT NULL DEFAULT '{}',
    "trial_started_at" TEXT,
    "trial_expires_at" TEXT,
    "trial_used" INTEGER NOT NULL DEFAULT 0,
    "signup_intent" TEXT,
    "pending_plan_id" TEXT,
    "pending_billing_cycle" TEXT,
    "google_sub" TEXT,
    "avatar_url" TEXT,
    "auth_provider" TEXT DEFAULT 'LOCAL',
    "created_at" TEXT NOT NULL,
    "updated_at" TEXT NOT NULL,
    "last_login_at" TEXT,

    CONSTRAINT "commercial_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commercial_plans" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "price_monthly" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "price_annual" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "limits_json" TEXT NOT NULL,
    "is_active" INTEGER NOT NULL DEFAULT 1,
    "created_at" TEXT NOT NULL,
    "updated_at" TEXT,

    CONSTRAINT "commercial_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commercial_subscriptions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "plan_id" TEXT NOT NULL,
    "license_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "billing_cycle" TEXT NOT NULL DEFAULT 'MONTHLY',
    "starts_at" TEXT NOT NULL,
    "expires_at" TEXT,
    "payment_provider" TEXT,
    "external_sub_id" TEXT,
    "auto_renew" INTEGER NOT NULL DEFAULT 1,
    "pricing_version" INTEGER,
    "cancel_at_period_end" INTEGER NOT NULL DEFAULT 0,
    "created_at" TEXT NOT NULL,
    "updated_at" TEXT,

    CONSTRAINT "commercial_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commercial_devices" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "license_id" TEXT,
    "device_id" TEXT NOT NULL,
    "device_name" TEXT NOT NULL,
    "platform" TEXT,
    "os_info" TEXT NOT NULL,
    "client_version" TEXT NOT NULL,
    "ip_address" TEXT,
    "activated_at" TEXT NOT NULL,
    "last_seen_at" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "created_at" TEXT,

    CONSTRAINT "commercial_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commercial_audit_logs" (
    "id" TEXT NOT NULL,
    "actor_id" TEXT NOT NULL,
    "actor_name" TEXT NOT NULL,
    "actor_role" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id" TEXT,
    "details" TEXT,
    "ip_address" TEXT,
    "result" TEXT NOT NULL DEFAULT 'SUCCESS',
    "created_at" TEXT NOT NULL,

    CONSTRAINT "commercial_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "software_versions" (
    "id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "release_notes" TEXT NOT NULL DEFAULT '',
    "min_supported_version" TEXT NOT NULL DEFAULT '1.0.0',
    "download_url_setup" TEXT,
    "download_url_portable" TEXT,
    "is_mandatory" INTEGER NOT NULL DEFAULT 0,
    "released_at" TEXT NOT NULL,

    CONSTRAINT "software_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "licenses" (
    "id" TEXT NOT NULL,
    "license_key_hash" TEXT NOT NULL,
    "key_masked" TEXT NOT NULL,
    "customer_name" TEXT NOT NULL,
    "account_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NOT_ACTIVATED',
    "duration_type" TEXT NOT NULL,
    "max_devices" INTEGER NOT NULL DEFAULT 1,
    "starts_at" TEXT NOT NULL,
    "expires_at" TEXT,
    "created_at" TEXT NOT NULL,
    "created_by" TEXT NOT NULL DEFAULT 'OWNER',
    "revoked_at" TEXT,
    "last_validation_at" TEXT,
    "notes" TEXT,

    CONSTRAINT "licenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "license_devices" (
    "id" TEXT NOT NULL,
    "license_id" TEXT NOT NULL,
    "device_id" TEXT NOT NULL,
    "device_name" TEXT NOT NULL,
    "ip_address" TEXT,
    "activated_at" TEXT NOT NULL,
    "last_seen_at" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "license_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commercial_payments" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "subscription_id" TEXT,
    "provider" TEXT NOT NULL DEFAULT 'stripe',
    "external_order_id" TEXT,
    "external_payment_id" TEXT,
    "amount_cents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "plan_id" TEXT NOT NULL,
    "billing_cycle" TEXT NOT NULL DEFAULT 'MONTHLY',
    "receipt_url" TEXT,
    "metadata_json" TEXT,
    "created_at" TEXT NOT NULL,
    "updated_at" TEXT NOT NULL,

    CONSTRAINT "commercial_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commercial_billing_invoices" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "payment_id" TEXT,
    "invoice_number" TEXT NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" TEXT NOT NULL DEFAULT 'PAID',
    "period_start" TEXT NOT NULL,
    "period_end" TEXT NOT NULL,
    "pdf_url" TEXT,
    "pricing_version" INTEGER,
    "plan_id" TEXT,
    "plan_name" TEXT,
    "discount_paise" INTEGER NOT NULL DEFAULT 0,
    "tax_paise" INTEGER NOT NULL DEFAULT 0,
    "created_at" TEXT NOT NULL,

    CONSTRAINT "commercial_billing_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commercial_webhook_events" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "payload_json" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PROCESSED',
    "created_at" TEXT NOT NULL,

    CONSTRAINT "commercial_webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pricing_audit_log" (
    "id" TEXT NOT NULL,
    "admin_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "old_data" TEXT,
    "new_data" TEXT,
    "subscriber_policy" TEXT,
    "pricing_version" INTEGER,
    "provider_sync_result" TEXT,
    "created_at" TEXT NOT NULL,

    CONSTRAINT "pricing_audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cloud_profiles" (
    "id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "local_profile_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "current_version" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "storage_bytes" BIGINT NOT NULL DEFAULT 0,
    "created_at" TEXT NOT NULL,
    "updated_at" TEXT NOT NULL,

    CONSTRAINT "cloud_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cloud_profile_versions" (
    "id" TEXT NOT NULL,
    "cloud_profile_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "object_key" TEXT NOT NULL,
    "file_size" BIGINT NOT NULL,
    "checksum_sha256" TEXT NOT NULL,
    "encrypted_data_key" TEXT NOT NULL,
    "iv" TEXT NOT NULL,
    "auth_tag" TEXT NOT NULL,
    "source_device_id" TEXT NOT NULL,
    "source_device_name" TEXT,
    "created_at" TEXT NOT NULL,

    CONSTRAINT "cloud_profile_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cloud_profile_locks" (
    "cloud_profile_id" TEXT NOT NULL,
    "device_id" TEXT NOT NULL,
    "device_name" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "locked_at" TEXT NOT NULL,
    "expires_at" TEXT NOT NULL,

    CONSTRAINT "cloud_profile_locks_pkey" PRIMARY KEY ("cloud_profile_id")
);

-- CreateTable
CREATE TABLE "cloud_sync_upload_sessions" (
    "id" TEXT NOT NULL,
    "cloud_profile_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "target_version" INTEGER NOT NULL,
    "base_version" INTEGER NOT NULL,
    "object_key" TEXT NOT NULL,
    "expected_size" BIGINT NOT NULL,
    "expected_checksum" TEXT NOT NULL,
    "encrypted_data_key" TEXT NOT NULL,
    "iv" TEXT NOT NULL,
    "auth_tag" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "expires_at" TEXT NOT NULL,
    "created_at" TEXT NOT NULL,

    CONSTRAINT "cloud_sync_upload_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cloud_sync_audit_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "cloud_profile_id" TEXT,
    "action" TEXT NOT NULL,
    "device_id" TEXT,
    "details" TEXT,
    "created_at" TEXT NOT NULL,

    CONSTRAINT "cloud_sync_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_workspaces" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT DEFAULT '',
    "owner_user_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "created_at" TEXT NOT NULL,
    "updated_at" TEXT NOT NULL,

    CONSTRAINT "team_workspaces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_workspace_members" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'MEMBER',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "invited_by" TEXT,
    "joined_at" TEXT NOT NULL,
    "created_at" TEXT NOT NULL,

    CONSTRAINT "team_workspace_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_workspace_invitations" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'MEMBER',
    "token_hash" TEXT NOT NULL,
    "invited_by" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "expires_at" TEXT NOT NULL,
    "created_at" TEXT NOT NULL,

    CONSTRAINT "team_workspace_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_profile_shares" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "cloud_profile_id" TEXT NOT NULL,
    "shared_by" TEXT NOT NULL,
    "permission_level" TEXT NOT NULL DEFAULT 'RUN',
    "encrypted_key_envelope" TEXT NOT NULL,
    "created_at" TEXT NOT NULL,
    "revoked_at" TEXT,

    CONSTRAINT "team_profile_shares_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_workspace_keys" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "encrypted_workspace_key" TEXT NOT NULL,
    "created_at" TEXT NOT NULL,

    CONSTRAINT "team_workspace_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_workspace_audit_logs" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "target_id" TEXT,
    "details" TEXT,
    "created_at" TEXT NOT NULL,

    CONSTRAINT "team_workspace_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "remote_api_keys" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "workspace_id" TEXT,
    "name" TEXT NOT NULL,
    "key_prefix" TEXT NOT NULL,
    "key_hash" TEXT NOT NULL,
    "scopes_json" TEXT NOT NULL DEFAULT '["profiles:read"]',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "rate_limit_per_min" INTEGER NOT NULL DEFAULT 120,
    "requests_count_month" INTEGER NOT NULL DEFAULT 0,
    "last_used_at" TEXT,
    "expires_at" TEXT,
    "created_at" TEXT NOT NULL,
    "revoked_at" TEXT,

    CONSTRAINT "remote_api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "remote_api_key_audits" (
    "id" TEXT NOT NULL,
    "key_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "ip_address" TEXT,
    "details" TEXT,
    "created_at" TEXT NOT NULL,

    CONSTRAINT "remote_api_key_audits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_endpoints" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "workspace_id" TEXT,
    "url" TEXT NOT NULL,
    "description" TEXT,
    "secret_hash" TEXT NOT NULL,
    "secret_encrypted" TEXT NOT NULL,
    "events_json" TEXT NOT NULL DEFAULT '["*"]',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "failure_count" INTEGER NOT NULL DEFAULT 0,
    "last_delivery_at" TEXT,
    "created_at" TEXT NOT NULL,
    "updated_at" TEXT NOT NULL,

    CONSTRAINT "webhook_endpoints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_deliveries" (
    "id" TEXT NOT NULL,
    "endpoint_id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "payload_json" TEXT NOT NULL,
    "destination_url" TEXT NOT NULL,
    "status_code" INTEGER,
    "response_body" TEXT,
    "duration_ms" INTEGER,
    "attempt_count" INTEGER NOT NULL DEFAULT 1,
    "success" INTEGER NOT NULL DEFAULT 0,
    "error_message" TEXT,
    "delivered_at" TEXT NOT NULL,

    CONSTRAINT "webhook_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_idempotency_records" (
    "idempotency_key" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "status_code" INTEGER NOT NULL,
    "response_json" TEXT NOT NULL,
    "created_at" TEXT NOT NULL,
    "expires_at" TEXT NOT NULL,

    CONSTRAINT "api_idempotency_records_pkey" PRIMARY KEY ("idempotency_key","user_id")
);

-- CreateTable
CREATE TABLE "proxy_providers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "website" TEXT,
    "is_enabled" INTEGER NOT NULL DEFAULT 1,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "capabilities_json" TEXT NOT NULL,
    "created_at" TEXT NOT NULL,
    "updated_at" TEXT NOT NULL,

    CONSTRAINT "proxy_providers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proxy_provider_sessions" (
    "id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "proxy_id" TEXT,
    "user_id" TEXT NOT NULL,
    "workspace_id" TEXT,
    "profile_id" TEXT,
    "network_type" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "region" TEXT,
    "city" TEXT,
    "session_type" TEXT NOT NULL,
    "upstream_session_id" TEXT NOT NULL,
    "ttl_minutes" INTEGER,
    "expires_at" TEXT,
    "rotatable" INTEGER NOT NULL DEFAULT 1,
    "rotation_count" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "bytes_used" BIGINT NOT NULL DEFAULT 0,
    "created_at" TEXT NOT NULL,
    "updated_at" TEXT NOT NULL,

    CONSTRAINT "proxy_provider_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proxy_usage_records" (
    "id" TEXT NOT NULL,
    "session_id" TEXT,
    "provider_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "bytes_used" BIGINT NOT NULL DEFAULT 0,
    "recorded_at" TEXT NOT NULL,

    CONSTRAINT "proxy_usage_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proxy_provider_health" (
    "provider_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'UNCONFIGURED',
    "latency_ms" INTEGER,
    "last_checked_at" TEXT NOT NULL,
    "error_message" TEXT,

    CONSTRAINT "proxy_provider_health_pkey" PRIMARY KEY ("provider_id")
);

-- CreateTable
CREATE TABLE "cloud_browser_regions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "endpoint_url" TEXT NOT NULL DEFAULT '',
    "gateway_url" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "is_default" INTEGER NOT NULL DEFAULT 0,
    "is_active" INTEGER NOT NULL DEFAULT 1,
    "created_at" TEXT NOT NULL,
    "updated_at" TEXT,

    CONSTRAINT "cloud_browser_regions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cloud_browser_workers" (
    "id" TEXT NOT NULL,
    "region_id" TEXT NOT NULL,
    "hostname" TEXT NOT NULL DEFAULT 'localhost',
    "ip_address" TEXT NOT NULL DEFAULT '127.0.0.1',
    "status" TEXT NOT NULL DEFAULT 'ONLINE',
    "capacity" INTEGER NOT NULL DEFAULT 10,
    "capacity_slots" INTEGER DEFAULT 10,
    "active_sessions" INTEGER NOT NULL DEFAULT 0,
    "used_slots" INTEGER DEFAULT 0,
    "cpu_usage_pct" DOUBLE PRECISION DEFAULT 0.0,
    "memory_usage_mb" DOUBLE PRECISION DEFAULT 0.0,
    "ram_usage_pct" DOUBLE PRECISION DEFAULT 0.0,
    "last_heartbeat_at" TEXT NOT NULL,
    "created_at" TEXT NOT NULL,
    "updated_at" TEXT NOT NULL,

    CONSTRAINT "cloud_browser_workers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cloud_browser_sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "workspace_id" TEXT,
    "profile_id" TEXT NOT NULL,
    "worker_id" TEXT,
    "region_id" TEXT NOT NULL DEFAULT 'in-west',
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "resource_class" TEXT NOT NULL DEFAULT 'STANDARD',
    "profile_version" INTEGER NOT NULL DEFAULT 1,
    "lock_id" TEXT,
    "session_token_hash" TEXT,
    "stream_gateway_url" TEXT,
    "cdp_port" INTEGER,
    "duration_seconds" INTEGER NOT NULL DEFAULT 0,
    "max_duration_seconds" INTEGER NOT NULL DEFAULT 3600,
    "idle_timeout_seconds" INTEGER NOT NULL DEFAULT 600,
    "last_activity_at" TEXT NOT NULL,
    "started_at" TEXT,
    "ended_at" TEXT,
    "termination_reason" TEXT,
    "error_message" TEXT,
    "created_at" TEXT NOT NULL,
    "updated_at" TEXT NOT NULL,

    CONSTRAINT "cloud_browser_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cloud_browser_events" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "details_json" TEXT,
    "created_at" TEXT NOT NULL,

    CONSTRAINT "cloud_browser_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cloud_browser_usage" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "workspace_id" TEXT,
    "session_id" TEXT NOT NULL,
    "duration_seconds" INTEGER NOT NULL,
    "resource_class" TEXT NOT NULL DEFAULT 'STANDARD',
    "region_id" TEXT NOT NULL DEFAULT 'in-west',
    "created_at" TEXT,

    CONSTRAINT "cloud_browser_usage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_tickets" (
    "id" TEXT NOT NULL,
    "ticket_number" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "user_email" TEXT,
    "user_name" TEXT,
    "message" TEXT NOT NULL,
    "reply" TEXT,
    "source" TEXT DEFAULT 'landing_ai_chat',
    "status" TEXT DEFAULT 'OPEN',
    "is_escalated" INTEGER NOT NULL DEFAULT 0,
    "escalation_reason" TEXT,
    "email_sent" INTEGER NOT NULL DEFAULT 0,
    "admin_notes" TEXT,
    "created_at" TEXT NOT NULL,
    "updated_at" TEXT NOT NULL,

    CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "demo_requests" (
    "id" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "company_name" TEXT,
    "team_size" TEXT,
    "use_case" TEXT,
    "contact_method" TEXT DEFAULT 'Email',
    "preferred_datetime" TEXT,
    "message" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "admin_notes" TEXT,
    "created_at" TEXT NOT NULL,
    "updated_at" TEXT NOT NULL,

    CONSTRAINT "demo_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "funnel_events" (
    "id" TEXT NOT NULL,
    "event_name" TEXT NOT NULL,
    "user_id" TEXT,
    "anonymous_id" TEXT,
    "plan_id" TEXT,
    "billing_cycle" TEXT,
    "source_url" TEXT,
    "ip_address" TEXT,
    "metadata_json" TEXT NOT NULL DEFAULT '{}',
    "created_at" TEXT NOT NULL,

    CONSTRAINT "funnel_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mobile_device_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "device_id" TEXT NOT NULL,
    "push_token" TEXT NOT NULL,
    "platform" TEXT NOT NULL DEFAULT 'android',
    "device_model" TEXT,
    "os_version" TEXT,
    "app_version" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "last_seen_at" TEXT NOT NULL,
    "created_at" TEXT NOT NULL,
    "updated_at" TEXT NOT NULL,

    CONSTRAINT "mobile_device_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mobile_notification_preferences" (
    "user_id" TEXT NOT NULL,
    "security_alerts" INTEGER NOT NULL DEFAULT 1,
    "cloud_sessions" INTEGER NOT NULL DEFAULT 1,
    "automation_alerts" INTEGER NOT NULL DEFAULT 1,
    "workspace_alerts" INTEGER NOT NULL DEFAULT 1,
    "proxy_alerts" INTEGER NOT NULL DEFAULT 1,
    "updated_at" TEXT NOT NULL,

    CONSTRAINT "mobile_notification_preferences_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "mobile_notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "data_json" TEXT,
    "read" INTEGER NOT NULL DEFAULT 0,
    "created_at" TEXT NOT NULL,

    CONSTRAINT "mobile_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "auth_users_email_key" ON "auth_users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "auth_users_normalized_email_key" ON "auth_users"("normalized_email");

-- CreateIndex
CREATE INDEX "auth_users_normalized_email_idx" ON "auth_users"("normalized_email");

-- CreateIndex
CREATE UNIQUE INDEX "auth_sessions_refresh_token_hash_key" ON "auth_sessions"("refresh_token_hash");

-- CreateIndex
CREATE INDEX "auth_sessions_user_id_idx" ON "auth_sessions"("user_id");

-- CreateIndex
CREATE INDEX "auth_sessions_refresh_token_hash_idx" ON "auth_sessions"("refresh_token_hash");

-- CreateIndex
CREATE UNIQUE INDEX "auth_verification_tokens_token_hash_key" ON "auth_verification_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "auth_verification_tokens_token_hash_idx" ON "auth_verification_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "oauth_states_expires_at_idx" ON "oauth_states"("expires_at");

-- CreateIndex
CREATE INDEX "web_handoff_sessions_expires_at_idx" ON "web_handoff_sessions"("expires_at");

-- CreateIndex
CREATE INDEX "web_handoff_sessions_used_idx" ON "web_handoff_sessions"("used");

-- CreateIndex
CREATE UNIQUE INDEX "commercial_users_email_key" ON "commercial_users"("email");

-- CreateIndex
CREATE INDEX "commercial_audit_logs_actor_id_idx" ON "commercial_audit_logs"("actor_id");

-- CreateIndex
CREATE INDEX "commercial_audit_logs_action_idx" ON "commercial_audit_logs"("action");

-- CreateIndex
CREATE INDEX "commercial_audit_logs_created_at_idx" ON "commercial_audit_logs"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "software_versions_version_key" ON "software_versions"("version");

-- CreateIndex
CREATE UNIQUE INDEX "licenses_license_key_hash_key" ON "licenses"("license_key_hash");

-- CreateIndex
CREATE UNIQUE INDEX "commercial_payments_external_payment_id_key" ON "commercial_payments"("external_payment_id");

-- CreateIndex
CREATE INDEX "commercial_payments_user_id_idx" ON "commercial_payments"("user_id");

-- CreateIndex
CREATE INDEX "commercial_payments_external_payment_id_idx" ON "commercial_payments"("external_payment_id");

-- CreateIndex
CREATE INDEX "commercial_payments_status_idx" ON "commercial_payments"("status");

-- CreateIndex
CREATE UNIQUE INDEX "commercial_billing_invoices_invoice_number_key" ON "commercial_billing_invoices"("invoice_number");

-- CreateIndex
CREATE INDEX "commercial_billing_invoices_user_id_idx" ON "commercial_billing_invoices"("user_id");

-- CreateIndex
CREATE INDEX "commercial_webhook_events_provider_event_type_idx" ON "commercial_webhook_events"("provider", "event_type");

-- CreateIndex
CREATE INDEX "pricing_audit_log_pricing_version_idx" ON "pricing_audit_log"("pricing_version");

-- CreateIndex
CREATE INDEX "cloud_profiles_owner_id_idx" ON "cloud_profiles"("owner_id");

-- CreateIndex
CREATE INDEX "cloud_profiles_owner_id_local_profile_id_idx" ON "cloud_profiles"("owner_id", "local_profile_id");

-- CreateIndex
CREATE INDEX "cloud_profile_versions_cloud_profile_id_idx" ON "cloud_profile_versions"("cloud_profile_id");

-- CreateIndex
CREATE INDEX "cloud_profile_versions_cloud_profile_id_version_idx" ON "cloud_profile_versions"("cloud_profile_id", "version");

-- CreateIndex
CREATE INDEX "cloud_profile_locks_expires_at_idx" ON "cloud_profile_locks"("expires_at");

-- CreateIndex
CREATE INDEX "cloud_sync_upload_sessions_status_idx" ON "cloud_sync_upload_sessions"("status");

-- CreateIndex
CREATE INDEX "cloud_sync_audit_logs_user_id_idx" ON "cloud_sync_audit_logs"("user_id");

-- CreateIndex
CREATE INDEX "cloud_sync_audit_logs_action_idx" ON "cloud_sync_audit_logs"("action");

-- CreateIndex
CREATE INDEX "team_workspaces_owner_user_id_idx" ON "team_workspaces"("owner_user_id");

-- CreateIndex
CREATE INDEX "team_workspaces_status_idx" ON "team_workspaces"("status");

-- CreateIndex
CREATE INDEX "team_workspace_members_user_id_idx" ON "team_workspace_members"("user_id");

-- CreateIndex
CREATE INDEX "team_workspace_members_workspace_id_idx" ON "team_workspace_members"("workspace_id");

-- CreateIndex
CREATE INDEX "team_workspace_members_workspace_id_status_idx" ON "team_workspace_members"("workspace_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "team_workspace_members_workspace_id_user_id_key" ON "team_workspace_members"("workspace_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "team_workspace_invitations_token_hash_key" ON "team_workspace_invitations"("token_hash");

-- CreateIndex
CREATE INDEX "team_workspace_invitations_token_hash_idx" ON "team_workspace_invitations"("token_hash");

-- CreateIndex
CREATE INDEX "team_workspace_invitations_workspace_id_idx" ON "team_workspace_invitations"("workspace_id");

-- CreateIndex
CREATE INDEX "team_workspace_invitations_email_idx" ON "team_workspace_invitations"("email");

-- CreateIndex
CREATE INDEX "team_workspace_invitations_status_idx" ON "team_workspace_invitations"("status");

-- CreateIndex
CREATE INDEX "team_profile_shares_workspace_id_idx" ON "team_profile_shares"("workspace_id");

-- CreateIndex
CREATE INDEX "team_profile_shares_cloud_profile_id_idx" ON "team_profile_shares"("cloud_profile_id");

-- CreateIndex
CREATE INDEX "team_workspace_keys_workspace_id_user_id_idx" ON "team_workspace_keys"("workspace_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "team_workspace_keys_workspace_id_user_id_key" ON "team_workspace_keys"("workspace_id", "user_id");

-- CreateIndex
CREATE INDEX "team_workspace_audit_logs_workspace_id_idx" ON "team_workspace_audit_logs"("workspace_id");

-- CreateIndex
CREATE INDEX "team_workspace_audit_logs_user_id_idx" ON "team_workspace_audit_logs"("user_id");

-- CreateIndex
CREATE INDEX "team_workspace_audit_logs_action_idx" ON "team_workspace_audit_logs"("action");

-- CreateIndex
CREATE UNIQUE INDEX "remote_api_keys_key_hash_key" ON "remote_api_keys"("key_hash");

-- CreateIndex
CREATE INDEX "remote_api_keys_user_id_idx" ON "remote_api_keys"("user_id");

-- CreateIndex
CREATE INDEX "remote_api_keys_workspace_id_idx" ON "remote_api_keys"("workspace_id");

-- CreateIndex
CREATE INDEX "remote_api_keys_key_hash_idx" ON "remote_api_keys"("key_hash");

-- CreateIndex
CREATE INDEX "remote_api_keys_status_idx" ON "remote_api_keys"("status");

-- CreateIndex
CREATE INDEX "remote_api_key_audits_user_id_idx" ON "remote_api_key_audits"("user_id");

-- CreateIndex
CREATE INDEX "remote_api_key_audits_key_id_idx" ON "remote_api_key_audits"("key_id");

-- CreateIndex
CREATE INDEX "webhook_endpoints_user_id_idx" ON "webhook_endpoints"("user_id");

-- CreateIndex
CREATE INDEX "webhook_endpoints_workspace_id_idx" ON "webhook_endpoints"("workspace_id");

-- CreateIndex
CREATE INDEX "webhook_endpoints_status_idx" ON "webhook_endpoints"("status");

-- CreateIndex
CREATE INDEX "webhook_deliveries_endpoint_id_idx" ON "webhook_deliveries"("endpoint_id");

-- CreateIndex
CREATE INDEX "webhook_deliveries_event_id_idx" ON "webhook_deliveries"("event_id");

-- CreateIndex
CREATE INDEX "webhook_deliveries_success_idx" ON "webhook_deliveries"("success");

-- CreateIndex
CREATE INDEX "api_idempotency_records_idempotency_key_user_id_idx" ON "api_idempotency_records"("idempotency_key", "user_id");

-- CreateIndex
CREATE INDEX "proxy_provider_sessions_user_id_idx" ON "proxy_provider_sessions"("user_id");

-- CreateIndex
CREATE INDEX "proxy_provider_sessions_workspace_id_idx" ON "proxy_provider_sessions"("workspace_id");

-- CreateIndex
CREATE INDEX "proxy_provider_sessions_proxy_id_idx" ON "proxy_provider_sessions"("proxy_id");

-- CreateIndex
CREATE INDEX "proxy_provider_sessions_provider_id_idx" ON "proxy_provider_sessions"("provider_id");

-- CreateIndex
CREATE INDEX "proxy_provider_sessions_status_idx" ON "proxy_provider_sessions"("status");

-- CreateIndex
CREATE INDEX "proxy_usage_records_user_id_idx" ON "proxy_usage_records"("user_id");

-- CreateIndex
CREATE INDEX "proxy_usage_records_session_id_idx" ON "proxy_usage_records"("session_id");

-- CreateIndex
CREATE INDEX "cloud_browser_workers_region_id_idx" ON "cloud_browser_workers"("region_id");

-- CreateIndex
CREATE INDEX "cloud_browser_workers_status_idx" ON "cloud_browser_workers"("status");

-- CreateIndex
CREATE INDEX "cloud_browser_sessions_user_id_idx" ON "cloud_browser_sessions"("user_id");

-- CreateIndex
CREATE INDEX "cloud_browser_sessions_profile_id_idx" ON "cloud_browser_sessions"("profile_id");

-- CreateIndex
CREATE INDEX "cloud_browser_sessions_status_idx" ON "cloud_browser_sessions"("status");

-- CreateIndex
CREATE INDEX "cloud_browser_sessions_worker_id_idx" ON "cloud_browser_sessions"("worker_id");

-- CreateIndex
CREATE INDEX "cloud_browser_events_session_id_idx" ON "cloud_browser_events"("session_id");

-- CreateIndex
CREATE INDEX "cloud_browser_events_event_type_idx" ON "cloud_browser_events"("event_type");

-- CreateIndex
CREATE INDEX "cloud_browser_usage_user_id_idx" ON "cloud_browser_usage"("user_id");

-- CreateIndex
CREATE INDEX "cloud_browser_usage_workspace_id_idx" ON "cloud_browser_usage"("workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "support_tickets_ticket_number_key" ON "support_tickets"("ticket_number");

-- CreateIndex
CREATE INDEX "support_tickets_category_idx" ON "support_tickets"("category");

-- CreateIndex
CREATE INDEX "support_tickets_status_idx" ON "support_tickets"("status");

-- CreateIndex
CREATE INDEX "support_tickets_created_at_idx" ON "support_tickets"("created_at");

-- CreateIndex
CREATE INDEX "demo_requests_status_idx" ON "demo_requests"("status");

-- CreateIndex
CREATE INDEX "demo_requests_email_idx" ON "demo_requests"("email");

-- CreateIndex
CREATE INDEX "funnel_events_event_name_idx" ON "funnel_events"("event_name");

-- CreateIndex
CREATE INDEX "funnel_events_created_at_idx" ON "funnel_events"("created_at");

-- CreateIndex
CREATE INDEX "mobile_device_tokens_user_id_idx" ON "mobile_device_tokens"("user_id");

-- CreateIndex
CREATE INDEX "mobile_device_tokens_device_id_idx" ON "mobile_device_tokens"("device_id");

-- CreateIndex
CREATE INDEX "mobile_notifications_user_id_idx" ON "mobile_notifications"("user_id");

-- CreateIndex
CREATE INDEX "mobile_notifications_category_idx" ON "mobile_notifications"("category");

-- AddForeignKey
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_verification_tokens" ADD CONSTRAINT "auth_verification_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commercial_subscriptions" ADD CONSTRAINT "commercial_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "commercial_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "license_devices" ADD CONSTRAINT "license_devices_license_id_fkey" FOREIGN KEY ("license_id") REFERENCES "licenses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cloud_profiles" ADD CONSTRAINT "cloud_profiles_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "auth_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cloud_profile_versions" ADD CONSTRAINT "cloud_profile_versions_cloud_profile_id_fkey" FOREIGN KEY ("cloud_profile_id") REFERENCES "cloud_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cloud_profile_locks" ADD CONSTRAINT "cloud_profile_locks_cloud_profile_id_fkey" FOREIGN KEY ("cloud_profile_id") REFERENCES "cloud_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cloud_sync_upload_sessions" ADD CONSTRAINT "cloud_sync_upload_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_workspaces" ADD CONSTRAINT "team_workspaces_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "auth_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_workspace_members" ADD CONSTRAINT "team_workspace_members_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "team_workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_workspace_members" ADD CONSTRAINT "team_workspace_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_workspace_invitations" ADD CONSTRAINT "team_workspace_invitations_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "team_workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_profile_shares" ADD CONSTRAINT "team_profile_shares_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "team_workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_profile_shares" ADD CONSTRAINT "team_profile_shares_cloud_profile_id_fkey" FOREIGN KEY ("cloud_profile_id") REFERENCES "cloud_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_workspace_keys" ADD CONSTRAINT "team_workspace_keys_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "team_workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_workspace_keys" ADD CONSTRAINT "team_workspace_keys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_workspace_audit_logs" ADD CONSTRAINT "team_workspace_audit_logs_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "team_workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "remote_api_key_audits" ADD CONSTRAINT "remote_api_key_audits_key_id_fkey" FOREIGN KEY ("key_id") REFERENCES "remote_api_keys"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_endpoint_id_fkey" FOREIGN KEY ("endpoint_id") REFERENCES "webhook_endpoints"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proxy_usage_records" ADD CONSTRAINT "proxy_usage_records_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "proxy_provider_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cloud_browser_workers" ADD CONSTRAINT "cloud_browser_workers_region_id_fkey" FOREIGN KEY ("region_id") REFERENCES "cloud_browser_regions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cloud_browser_events" ADD CONSTRAINT "cloud_browser_events_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "cloud_browser_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

