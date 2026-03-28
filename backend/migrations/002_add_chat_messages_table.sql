-- Migration: Add chat_messages table for message history
-- Description: Enables storing and retrieving chat message history for chatflows and agentflows
-- Created: 2026-03-29

-- Create chat_messages table
CREATE TABLE chat_messages (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    chatflow_id UUID NOT NULL REFERENCES flows(id) ON DELETE CASCADE,
    session_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    source_documents JSONB,
    agent_reasoning JSONB,
    used_tools JSONB,
    feedback_rating TEXT,
    feedback_content TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX idx_chat_messages_tenant_id
ON chat_messages(tenant_id);

CREATE INDEX idx_chat_messages_chatflow_id
ON chat_messages(chatflow_id);

CREATE INDEX idx_chat_messages_tenant_chatflow
ON chat_messages(tenant_id, chatflow_id);

CREATE INDEX idx_chat_messages_session_id
ON chat_messages(session_id);

CREATE INDEX idx_chat_messages_created_at
ON chat_messages(created_at DESC);

-- Index for efficient filtering by chatflow and created_at (for pagination)
CREATE INDEX idx_chat_messages_chatflow_created
ON chat_messages(chatflow_id, created_at DESC);

-- End of migration
