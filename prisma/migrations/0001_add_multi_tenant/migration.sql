-- Create multi-tenant tables first
CREATE TABLE IF NOT EXISTS "tenants" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "planType" TEXT NOT NULL DEFAULT 'BASIC',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "tenants_slug_key" ON "tenants"("slug");
CREATE INDEX IF NOT EXISTS "tenants_slug_idx" ON "tenants"("slug");
CREATE INDEX IF NOT EXISTS "tenants_isActive_idx" ON "tenants"("isActive");

-- Create users table
CREATE TABLE IF NOT EXISTS "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'CLIENT',
    "tenantId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "users_email_key" ON "users"("email");
CREATE INDEX IF NOT EXISTS "users_email_idx" ON "users"("email");
CREATE INDEX IF NOT EXISTS "users_tenantId_idx" ON "users"("tenantId");
CREATE INDEX IF NOT EXISTS "users_role_idx" ON "users"("role");

-- Create NextAuth tables
CREATE TABLE IF NOT EXISTS "accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "accounts_provider_providerAccountId_key" ON "accounts"("provider", "providerAccountId");
CREATE INDEX IF NOT EXISTS "accounts_userId_idx" ON "accounts"("userId");

CREATE TABLE IF NOT EXISTS "sessions" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "sessions_sessionToken_key" ON "sessions"("sessionToken");
CREATE INDEX IF NOT EXISTS "sessions_userId_idx" ON "sessions"("userId");

CREATE TABLE IF NOT EXISTS "verification_tokens" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_tokens_pkey" PRIMARY KEY ("identifier", "token")
);

-- Create default tenant for existing data
INSERT INTO "tenants" ("id", "name", "slug", "planType", "isActive", "createdAt", "updatedAt")
VALUES ('00000000-0000-0000-0000-000000000000', 'Default Tenant', 'default-tenant', 'BASIC', true, NOW(), NOW())
ON CONFLICT ("id") DO NOTHING;

-- Add tenantId columns to existing tables (nullable first) - only if tables exist
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'assistants') THEN
        ALTER TABLE "assistants" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;
        ALTER TABLE "assistants" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
    END IF;
END $$;

DO $$ 
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'phone_numbers') THEN
        ALTER TABLE "phone_numbers" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;
        ALTER TABLE "phone_numbers" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
    END IF;
END $$;

DO $$ 
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'campaigns') THEN
        ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;
        ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "id" TEXT;
        ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "name" TEXT;
        ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "description" TEXT;
        ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN DEFAULT true;
        ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
        ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
        ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "scheduleDays" INTEGER[];
        ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "scheduleFrequency" TEXT;
        ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "timeZone" TEXT DEFAULT 'UTC';
        ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "startTime" TEXT;
        ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "endTime" TEXT;
    END IF;
END $$;

-- Update existing rows to use default tenant (only if tables exist)
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'assistants') THEN
        UPDATE "assistants" SET "tenantId" = '00000000-0000-0000-0000-000000000000', "updatedAt" = COALESCE("updated_at", NOW()) WHERE "tenantId" IS NULL;
    END IF;
END $$;

DO $$ 
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'phone_numbers') THEN
        UPDATE "phone_numbers" SET "tenantId" = '00000000-0000-0000-0000-000000000000', "updatedAt" = COALESCE("updated_at", NOW()) WHERE "tenantId" IS NULL;
    END IF;
END $$;

DO $$ 
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'campaigns') THEN
        UPDATE "campaigns" SET "tenantId" = '00000000-0000-0000-0000-000000000000', "id" = COALESCE("id", gen_random_uuid()::text), "createdAt" = COALESCE("created_at", NOW()), "updatedAt" = NOW(), "isActive" = true WHERE "tenantId" IS NULL;
    END IF;
END $$;

-- For calls table, we need to handle the schema difference
-- The old schema has id as SERIAL, new schema has id as UUID TEXT
-- We'll create a new calls table structure, but keep old data accessible
-- Actually, let's add the new columns to existing calls table (only if table exists)
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'calls') THEN
        ALTER TABLE "calls" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;
        ALTER TABLE "calls" ADD COLUMN IF NOT EXISTS "callId" TEXT;
        ALTER TABLE "calls" ADD COLUMN IF NOT EXISTS "status" TEXT DEFAULT 'SCHEDULED';
        ALTER TABLE "calls" ADD COLUMN IF NOT EXISTS "scheduledTime" TIMESTAMP(3);
        ALTER TABLE "calls" ADD COLUMN IF NOT EXISTS "scheduledTimeLocal" TEXT;
        ALTER TABLE "calls" ADD COLUMN IF NOT EXISTS "endedReason" TEXT;
        ALTER TABLE "calls" ADD COLUMN IF NOT EXISTS "callOutcome" TEXT;
        ALTER TABLE "calls" ADD COLUMN IF NOT EXISTS "successEvaluation" TEXT;
        ALTER TABLE "calls" ADD COLUMN IF NOT EXISTS "summary" TEXT;
        ALTER TABLE "calls" ADD COLUMN IF NOT EXISTS "recordingUrl" TEXT;
        ALTER TABLE "calls" ADD COLUMN IF NOT EXISTS "actualCallTime" TEXT;
        ALTER TABLE "calls" ADD COLUMN IF NOT EXISTS "message" TEXT;
        ALTER TABLE "calls" ADD COLUMN IF NOT EXISTS "timestamp" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;
        ALTER TABLE "calls" ADD COLUMN IF NOT EXISTS "outcomeReceived" BOOLEAN DEFAULT false;
        ALTER TABLE "calls" ADD COLUMN IF NOT EXISTS "isRetry" BOOLEAN DEFAULT false;
        ALTER TABLE "calls" ADD COLUMN IF NOT EXISTS "originalCallId" TEXT;
        ALTER TABLE "calls" ADD COLUMN IF NOT EXISTS "retryCount" INTEGER DEFAULT 0;
        ALTER TABLE "calls" ADD COLUMN IF NOT EXISTS "contactId" TEXT;

        -- Map old columns to new columns for calls
        UPDATE "calls" SET 
            "tenantId" = '00000000-0000-0000-0000-000000000000',
            "callId" = COALESCE("call_id", NULL),
            "status" = COALESCE("status", 'SCHEDULED'),
            "scheduledTime" = "scheduled_time",
            "scheduledTimeLocal" = "scheduled_time_local",
            "endedReason" = "ended_reason",
            "callOutcome" = "call_outcome",
            "successEvaluation" = "success_evaluation",
            "summary" = "summary",
            "recordingUrl" = "recording_url",
            "actualCallTime" = "actual_call_time",
            "message" = "message",
            "timestamp" = COALESCE("timestamp", NOW()),
            "outcomeReceived" = COALESCE("outcome_received", false),
            "isRetry" = COALESCE("is_retry", false),
            "originalCallId" = "original_call_id",
            "retryCount" = COALESCE("retry_count", 0)
        WHERE "tenantId" IS NULL;
    END IF;
END $$;

-- Add foreign key constraints (using DO block to check if constraint exists)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'users_tenantId_fkey'
    ) THEN
        ALTER TABLE "users" ADD CONSTRAINT "users_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'accounts_userId_fkey'
    ) THEN
        ALTER TABLE "accounts" ADD CONSTRAINT "accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'sessions_userId_fkey'
    ) THEN
        ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- Note: We're keeping the old table structure for now to preserve data
-- The new schema expects different column names, so we'll need to handle this in the application layer
-- or create a proper migration script to transform the data


