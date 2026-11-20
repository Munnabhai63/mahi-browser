ALTER TABLE "auth_users" ADD COLUMN IF NOT EXISTS "accepted_terms" INTEGER DEFAULT 0;
ALTER TABLE "auth_users" ADD COLUMN IF NOT EXISTS "terms_version" TEXT;
