CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS flows (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS flow_versions (
    id UUID PRIMARY KEY,
    flow_id UUID NOT NULL REFERENCES flows(id) ON DELETE CASCADE,
    version INT NOT NULL,
    json_definition JSONB NOT NULL,
    is_published BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (flow_id, version)
);

CREATE TABLE IF NOT EXISTS execution_logs (
    id UUID PRIMARY KEY,
    flow_version_id UUID NOT NULL REFERENCES flow_versions(id) ON DELETE CASCADE,
    tokens_used INT DEFAULT 0,
    execution_time_ms INT DEFAULT 0,
    status TEXT NOT NULL,
    response_text TEXT,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ingestion_jobs (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    flow_id UUID NOT NULL REFERENCES flows(id) ON DELETE CASCADE,
    status TEXT NOT NULL,
    documents_count INT DEFAULT 0,
    chunks_count INT DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    actor_user_id UUID,
    actor_email TEXT,
    actor_role TEXT,
    action TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id TEXT,
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_flows_tenant_id ON flows(tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_tenant_email_ci ON users(tenant_id, lower(email));
CREATE INDEX IF NOT EXISTS idx_execution_logs_created_at ON execution_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_ingestion_jobs_flow_id_created_at ON ingestion_jobs(flow_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_id_created_at ON audit_logs(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_resource_type_created_at ON audit_logs(tenant_id, resource_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_resource_type_action_created_at ON audit_logs(tenant_id, resource_type, action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_resource_type_resource_id_created_at ON audit_logs(tenant_id, resource_type, resource_id, created_at DESC);
