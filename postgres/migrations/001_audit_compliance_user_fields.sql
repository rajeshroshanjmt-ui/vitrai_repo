-- Migration 001: Audit compliance, user fields, flow type discriminator
-- Apply against a running Postgres instance:
--   psql -U <user> -d <dbname> -f 001_audit_compliance_user_fields.sql
--
-- This migration is IDEMPOTENT — safe to run multiple times.

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. users — new columns
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS full_name   TEXT,
    ADD COLUMN IF NOT EXISTS is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS updated_at  TIMESTAMPTZ DEFAULT NOW();

-- Back-fill updated_at from created_at for existing rows
UPDATE users SET updated_at = created_at WHERE updated_at IS NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. flows — type discriminator + updated_at
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE flows
    ADD COLUMN IF NOT EXISTS flow_type  TEXT NOT NULL DEFAULT 'chatflow',
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

UPDATE flows SET updated_at = created_at WHERE updated_at IS NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. audit_logs — change FK from CASCADE → SET NULL so audit records survive
--    tenant deletion (SOC2 / GDPR data-retention requirement)
-- ─────────────────────────────────────────────────────────────────────────────

-- Drop the existing CASCADE constraint (name may vary — find it dynamically)
DO $$
DECLARE
    _constraint TEXT;
BEGIN
    SELECT conname INTO _constraint
    FROM pg_constraint
    WHERE conrelid = 'audit_logs'::regclass
      AND contype = 'f'
      AND confrelid = 'tenants'::regclass;

    IF _constraint IS NOT NULL THEN
        EXECUTE format('ALTER TABLE audit_logs DROP CONSTRAINT %I', _constraint);
    END IF;
END;
$$;

-- Allow tenant_id to be NULL (records survive after tenant deletion)
ALTER TABLE audit_logs ALTER COLUMN tenant_id DROP NOT NULL;

-- Re-add FK with SET NULL
ALTER TABLE audit_logs
    ADD CONSTRAINT fk_audit_logs_tenant_id
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE SET NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Indexes for new columns
-- ─────────────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_users_tenant_is_active
    ON users(tenant_id, is_active);

CREATE INDEX IF NOT EXISTS idx_flows_tenant_flow_type
    ON flows(tenant_id, flow_type);

COMMIT;
