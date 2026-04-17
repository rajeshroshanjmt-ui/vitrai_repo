-- Migration: Add workspace_id columns for workspace isolation enforcement
-- Description: Enables filtering flows and resources by workspace membership
-- Created: 2026-03-14

-- Step 1: Add workspace_id column to flows table (nullable initially)
ALTER TABLE flows
ADD COLUMN workspace_id UUID REFERENCES tenant_resources(id) ON DELETE CASCADE;

-- Step 2: Add workspace_id column to tenant_resources table (nullable initially)
ALTER TABLE tenant_resources
ADD COLUMN workspace_id UUID REFERENCES tenant_resources(id) ON DELETE CASCADE;

-- Step 3: Create function to get default workspace for tenant
-- This finds the first 'workspace' type resource for a tenant
CREATE OR REPLACE FUNCTION get_default_workspace(tenant_id UUID)
RETURNS UUID AS $$
  SELECT id FROM tenant_resources
  WHERE tenant_id = $1
    AND resource_type = 'workspace'
  LIMIT 1
$$ LANGUAGE SQL;

-- Step 4: Backfill flows with default workspace
-- Each flow gets assigned to the first workspace created for its tenant
UPDATE flows
SET workspace_id = get_default_workspace(flows.tenant_id)
WHERE workspace_id IS NULL
  AND EXISTS (
    SELECT 1 FROM tenant_resources
    WHERE tenant_id = flows.tenant_id
      AND resource_type = 'workspace'
  );

-- Step 5: Handle flows with no workspace (create default workspace if needed)
-- For tenants with no workspaces, we need to create one
WITH tenants_needing_workspace AS (
  SELECT DISTINCT f.tenant_id
  FROM flows f
  WHERE f.workspace_id IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM tenant_resources tr
      WHERE tr.tenant_id = f.tenant_id
        AND tr.resource_type = 'workspace'
    )
),
new_workspaces AS (
  INSERT INTO tenant_resources
    (id, tenant_id, resource_type, name, payload, created_at, updated_at)
  SELECT
    gen_random_uuid(),
    tenant_id,
    'workspace',
    CONCAT('Default Workspace - ', tenant_id),
    '{"description": "Auto-created default workspace", "isOrgDefault": true}'::jsonb,
    NOW(),
    NOW()
  FROM tenants_needing_workspace
  RETURNING tenant_id, id
)
UPDATE flows
SET workspace_id = nw.id
FROM new_workspaces nw
WHERE flows.tenant_id = nw.tenant_id
  AND flows.workspace_id IS NULL;

-- Step 6: Backfill resources with default workspace (similar to flows)
UPDATE tenant_resources
SET workspace_id = get_default_workspace(tenant_resources.tenant_id)
WHERE workspace_id IS NULL
  AND resource_type != 'workspace'
  AND EXISTS (
    SELECT 1 FROM tenant_resources tr2
    WHERE tr2.tenant_id = tenant_resources.tenant_id
      AND tr2.resource_type = 'workspace'
  );

-- Step 7: Handle resources with no workspace
WITH tenants_needing_workspace_for_resources AS (
  SELECT DISTINCT tr.tenant_id
  FROM tenant_resources tr
  WHERE tr.workspace_id IS NULL
    AND tr.resource_type != 'workspace'
    AND NOT EXISTS (
      SELECT 1 FROM tenant_resources tr2
      WHERE tr2.tenant_id = tr.tenant_id
        AND tr2.resource_type = 'workspace'
    )
),
new_workspaces_for_resources AS (
  INSERT INTO tenant_resources
    (id, tenant_id, resource_type, name, payload, created_at, updated_at)
  SELECT
    gen_random_uuid(),
    tenant_id,
    'workspace',
    CONCAT('Default Workspace - ', tenant_id),
    '{"description": "Auto-created default workspace", "isOrgDefault": true}'::jsonb,
    NOW(),
    NOW()
  FROM tenants_needing_workspace_for_resources
  RETURNING tenant_id, id
)
UPDATE tenant_resources
SET workspace_id = nwr.id
FROM new_workspaces_for_resources nwr
WHERE tenant_resources.tenant_id = nwr.tenant_id
  AND tenant_resources.workspace_id IS NULL
  AND tenant_resources.resource_type != 'workspace';

-- Step 8: Make workspace_id NOT NULL on flows
ALTER TABLE flows
ALTER COLUMN workspace_id SET NOT NULL;

-- Step 9: Make workspace_id NOT NULL on tenant_resources (except workspace type)
-- For resources that are workspaces themselves, workspace_id can be NULL (they don't belong to a workspace)
ALTER TABLE tenant_resources
ADD CONSTRAINT tenant_resources_workspace_id_check
CHECK (workspace_id IS NOT NULL OR resource_type = 'workspace');

-- Step 10: Create indexes for efficient filtering
CREATE INDEX idx_flows_tenant_workspace
ON flows(tenant_id, workspace_id);

CREATE INDEX idx_tenant_resources_tenant_workspace
ON tenant_resources(tenant_id, workspace_id)
WHERE resource_type != 'workspace';

-- Step 11: Create index for checking workspace membership
CREATE INDEX idx_tenant_resources_workspace_type
ON tenant_resources(tenant_id, resource_type)
WHERE resource_type = 'workspace';

-- Step 12: Drop the helper function (no longer needed)
DROP FUNCTION get_default_workspace(UUID);

-- End of migration
