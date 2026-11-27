-- ============================================================================
-- Migration 0003: Sync Deltas, Runtime Distributed State/Flags & Public RLS
-- Covers live Supabase schema drift relative to prisma/schema.prisma and
-- runtime SQL tables, plus Supabase public schema Row-Level Security policies.
-- ============================================================================

-- 1. cloud_sync_upload_sessions delta/format columns
ALTER TABLE "cloud_sync_upload_sessions"
    ADD COLUMN IF NOT EXISTS "archive_format" TEXT NOT NULL DEFAULT 'full';

ALTER TABLE "cloud_sync_upload_sessions"
    ADD COLUMN IF NOT EXISTS "manifest_hash" TEXT;

-- 2. mobile_device_tokens optional metadata column parity
ALTER TABLE "mobile_device_tokens"
    ADD COLUMN IF NOT EXISTS "device_model" TEXT;

-- 3. cloud_profile_deltas table, indexes & foreign key
CREATE TABLE IF NOT EXISTS "cloud_profile_deltas" (
    "id" TEXT NOT NULL,
    "cloud_profile_id" TEXT NOT NULL,
    "base_version" INTEGER NOT NULL,
    "delta_version" INTEGER NOT NULL,
    "delta_type" TEXT NOT NULL DEFAULT 'cookies_only',
    "manifest_hash" TEXT,
    "object_key" TEXT NOT NULL,
    "file_size" BIGINT NOT NULL,
    "checksum_sha256" TEXT NOT NULL,
    "encrypted_data_key" TEXT NOT NULL,
    "iv" TEXT NOT NULL,
    "auth_tag" TEXT NOT NULL,
    "source_device_id" TEXT NOT NULL,
    "source_device_name" TEXT,
    "created_at" TEXT NOT NULL,

    CONSTRAINT "cloud_profile_deltas_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "cloud_profile_deltas_cloud_profile_id_idx"
    ON "cloud_profile_deltas"("cloud_profile_id");

CREATE INDEX IF NOT EXISTS "cloud_profile_deltas_cloud_profile_id_delta_version_idx"
    ON "cloud_profile_deltas"("cloud_profile_id", "delta_version");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'cloud_profile_deltas_cloud_profile_id_fkey'
    ) THEN
        ALTER TABLE "cloud_profile_deltas"
            ADD CONSTRAINT "cloud_profile_deltas_cloud_profile_id_fkey"
            FOREIGN KEY ("cloud_profile_id") REFERENCES "cloud_profiles"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- 4. Distributed runtime state & kill-switch flags tables
CREATE TABLE IF NOT EXISTS "system_runtime_state" (
    "state_key" TEXT NOT NULL,
    "value_json" TEXT,
    "count" INTEGER NOT NULL DEFAULT 0,
    "expires_at_ms" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "system_runtime_state_pkey" PRIMARY KEY ("state_key")
);

DO $$
BEGIN
    CREATE INDEX IF NOT EXISTS "system_runtime_state_expires_at_ms_idx"
        ON "system_runtime_state"("expires_at_ms");
EXCEPTION WHEN insufficient_privilege THEN
    NULL;
END $$;

CREATE TABLE IF NOT EXISTS "system_runtime_flags" (
    "flag_key" TEXT NOT NULL,
    "value_json" TEXT NOT NULL,
    "updated_by" TEXT,
    "updated_at" TEXT NOT NULL,

    CONSTRAINT "system_runtime_flags_pkey" PRIMARY KEY ("flag_key")
);

-- 5. Enable Row-Level Security across all public tables (`rls_disabled_in_public`)
--    - Blocks PostgREST `anon` and `authenticated` access completely by default-deny
--    - Preserves least-privilege `mahi_gateway` backend read/write operations
DO $$
DECLARE
    tbl RECORD;
    has_gateway_role BOOLEAN;
    has_anon_role BOOLEAN;
    has_auth_role BOOLEAN;
BEGIN
    SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'mahi_gateway') INTO has_gateway_role;
    SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') INTO has_anon_role;
    SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') INTO has_auth_role;

    FOR tbl IN
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = 'public'
    LOOP
        BEGIN
            IF has_gateway_role THEN
                EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public".%I TO mahi_gateway', tbl.tablename);
            END IF;

            IF has_anon_role THEN
                EXECUTE format('REVOKE ALL ON TABLE "public".%I FROM anon', tbl.tablename);
            END IF;

            IF has_auth_role THEN
                EXECUTE format('REVOKE ALL ON TABLE "public".%I FROM authenticated', tbl.tablename);
            END IF;

            EXECUTE format('ALTER TABLE "public".%I ENABLE ROW LEVEL SECURITY', tbl.tablename);

            IF has_gateway_role AND NOT EXISTS (
                SELECT 1
                FROM pg_policies
                WHERE schemaname = 'public'
                  AND tablename = tbl.tablename
                  AND policyname = 'mahi_gateway_service_access'
            ) THEN
                EXECUTE format(
                    'CREATE POLICY "mahi_gateway_service_access" ON "public".%I AS PERMISSIVE FOR ALL TO mahi_gateway USING ((SELECT current_user::text) = ''mahi_gateway'') WITH CHECK ((SELECT current_user::text) = ''mahi_gateway'')',
                    tbl.tablename
                );
            END IF;
        EXCEPTION WHEN insufficient_privilege THEN
            NULL;
        END;
    END LOOP;
END $$;
