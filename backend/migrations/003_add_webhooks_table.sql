-- Migration: Add webhooks table for webhook management
-- Description: Enables storing and managing webhooks for flow events
-- Created: 2026-03-29

-- Create webhooks table
CREATE TABLE webhooks (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    flow_id UUID REFERENCES flows(id) ON DELETE SET NULL,
    event_types JSONB NOT NULL DEFAULT '[]',
    endpoint_url TEXT NOT NULL,
    secret TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX idx_webhooks_tenant_id
ON webhooks(tenant_id);

CREATE INDEX idx_webhooks_flow_id
ON webhooks(flow_id);

CREATE INDEX idx_webhooks_tenant_flow
ON webhooks(tenant_id, flow_id);

CREATE INDEX idx_webhooks_is_active
ON webhooks(is_active);

CREATE INDEX idx_webhooks_tenant_active
ON webhooks(tenant_id, is_active);

-- End of migration
