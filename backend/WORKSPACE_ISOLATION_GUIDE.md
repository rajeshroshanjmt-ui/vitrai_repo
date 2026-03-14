# Workspace Isolation Implementation Guide

## Current Architecture

### What Works
- ✅ Workspace creation and management
- ✅ User-workspace associations (via UserPreference)
- ✅ Workspace switching (active_workspace preference)
- ✅ Permission checks at endpoint level

### What's Missing
- ❌ Flows not scoped to workspaces (tenant-wide)
- ❌ Resources not scoped to workspaces (tenant-wide)
- ❌ No enforcement of workspace boundaries in queries
- ❌ No workspace_id column in flows or resources tables

---

## Problem Statement

Currently:
```
User (tenant=ABC, role=editor) in Workspace X
- Can see ALL flows in tenant ABC
- Can create/edit/delete ANY flow
- Can see ALL resources
- Workspace membership is not enforced
```

Desired State:
```
User (tenant=ABC, role=editor) in Workspace X
- Can ONLY see flows in Workspace X
- Can ONLY operate on flows in Workspace X
- Cannot access flows from Workspace Y
- Cannot create flows outside Workspace X
```

---

## Solution Options

### Option 1: Add workspace_id Column (Recommended)
**Pros:**
- Efficient queries with direct filtering
- Simple one-column WHERE clause
- Best performance

**Cons:**
- Requires database migration
- Must backfill existing flows (NULL → default workspace)

**Steps:**
```sql
-- Add column to flows table
ALTER TABLE flows ADD COLUMN workspace_id UUID REFERENCES tenant_resources(id);

-- Backfill existing flows to default workspace
UPDATE flows SET workspace_id = (
  SELECT id FROM tenant_resources
  WHERE tenant_id = flows.tenant_id
  AND resource_type = 'workspace'
  LIMIT 1
);

-- Make column NOT NULL
ALTER TABLE flows ALTER COLUMN workspace_id SET NOT NULL;
```

### Option 2: Use Junction Table
**Pros:**
- Allows flows to be in multiple workspaces
- No schema modification to flows table
- More flexible

**Cons:**
- More complex queries
- Additional table to manage
- Slower queries (join required)

### Option 3: Accept Current Design (Temporary)
**Pros:**
- No schema changes needed
- Can implement later

**Cons:**
- No true workspace isolation
- Security risk for multi-tenant scenarios
- Must rely on frontend validation only

---

## Recommended Implementation Path

### Phase 1: Add Helper Functions (Already Done ✅)
```python
def _get_active_workspace(db: Session, tenant_id: str, user_id: str) -> str:
    """Get user's active workspace ID."""
    pref = db.query(UserPreference).filter(
        UserPreference.tenant_id == tenant_id,
        UserPreference.user_id == user_id,
        UserPreference.pref_key == "active_workspace"
    ).one_or_none()

    if not pref:
        raise HTTPException(status_code=400, detail="No workspace selected")

    return pref.pref_value.get("workspace_id")
```

### Phase 2: Add workspace_id Column
Create Alembic migration:
```bash
alembic revision --autogenerate -m "Add workspace_id to flows and resources"
```

### Phase 3: Update Queries
Replace:
```python
# Old: Tenant-wide query
flows = db.query(Flow).filter(Flow.tenant_id == tenant_id).all()

# New: Workspace-scoped query
active_workspace = _get_active_workspace(db, tenant_id, user_id)
flows = db.query(Flow).filter(
    Flow.tenant_id == tenant_id,
    Flow.workspace_id == active_workspace
).all()
```

### Phase 4: Update Create Operations
```python
# When creating flows, associate with active workspace
active_workspace = _get_active_workspace(db, tenant_id, user_id)
flow = Flow(
    id=...,
    tenant_id=tenant_id,
    workspace_id=active_workspace,  # NEW
    name=...
)
```

---

## Affected Endpoints

### Flows (18 endpoints need workspace filtering)
```
POST   /flows/create
PUT    /flows/{flow_id}/draft
POST   /flows/{flow_id}/publish
POST   /flows/{flow_id}/execute
POST   /flows/{flow_id}/documents
GET    /flows/{flow_id}/ingestions
GET    /flows/{flow_id}
DELETE /flows/{flow_id}
GET    /flows/list
GET    /flows/usage
GET    /flows/{flow_id}/versions
GET    /flows/tools/state
PUT    /flows/tools/state
GET    /flows/logs
DELETE /flows/logs/{log_id}
GET    /flows/audit
POST   /flows/dlq/{dlq_type}/replay
```

### Resources (5 endpoints need workspace filtering)
```
GET    /resources/{resource_type}
GET    /resources/{resource_type}/{resource_id}
POST   /resources/{resource_type}
PUT    /resources/{resource_type}/{resource_id}
DELETE /resources/{resource_type}/{resource_id}
```

---

## Implementation Checklist

### Before Starting
- [ ] Backup production database
- [ ] Create database migration
- [ ] Test migration locally
- [ ] Prepare rollback plan

### Schema Changes
- [ ] Add workspace_id to flows table
- [ ] Add workspace_id to resources table
- [ ] Create composite unique constraint: (tenant_id, workspace_id, name)
- [ ] Backfill default workspace for existing data
- [ ] Add NOT NULL constraint

### Backend Updates (High Priority)
- [ ] Update _get_active_workspace() in flows.py
- [ ] Update list_flows() to filter by workspace
- [ ] Update create_flow() to assign workspace
- [ ] Update delete_flow() to check workspace membership
- [ ] Update all flow endpoints similarly

- [ ] Update list_resources() to filter by workspace
- [ ] Update create_resource() to assign workspace
- [ ] Update delete_resource() to check workspace membership
- [ ] Update all resource endpoints similarly

### Testing
- [ ] Test single workspace access
- [ ] Test multi-workspace isolation
- [ ] Test cross-workspace denial
- [ ] Test default workspace assignment
- [ ] Test workspace switching affects visible flows
- [ ] Load test with workspace filtering

### Frontend Updates
- [ ] Update flow listing to respect active workspace
- [ ] Update resource listing to respect active workspace
- [ ] Add workspace indicator in UI
- [ ] Test UI reflects workspace changes

---

## Code Examples

### In flows.py - Updated list_flows()
```python
@router.get("/list")
def list_flows(
    limit: int = 50,
    db: Session = Depends(get_db),
    user: Annotated[dict, Depends(require_permission(...))] = None,
) -> dict[str, Any]:
    active_workspace = _get_active_workspace(db, user["tenant_id"], user["user_id"])

    safe_limit = max(1, min(limit, 200))
    flows = (
        db.query(Flow)
        .filter(
            Flow.tenant_id == user["tenant_id"],
            Flow.workspace_id == active_workspace  # NEW
        )
        .order_by(Flow.created_at.desc())
        .limit(safe_limit)
        .all()
    )
    # ... rest of function
```

### In flows.py - Updated create_flow()
```python
@router.post("/create")
def create_flow(
    body: FlowCreateRequest,
    db: Session = Depends(get_db),
    user: Annotated[dict, Depends(require_permission(...))] = None,
) -> dict[str, Any]:
    tenant_id = user["tenant_id"]
    active_workspace = _get_active_workspace(db, tenant_id, user["user_id"])
    _ensure_tenant(db, tenant_id)

    flow = Flow(
        id=str(uuid4()),
        tenant_id=tenant_id,
        workspace_id=active_workspace,  # NEW
        name=body.name
    )
    # ... rest of function
```

### In resources.py - Updated list_resources()
```python
@router.get("/{resource_type}")
def list_resources(
    resource_type: str,
    limit: int = 50,
    offset: int = 0,
    q: str | None = None,
    db: Session = Depends(get_db),
    user: Annotated[dict, Depends(require_permission(...))] = None,
) -> dict[str, Any]:
    active_workspace = _get_active_workspace(db, user["tenant_id"], user["user_id"])
    normalized_type = _ensure_resource_type(resource_type)

    query = db.query(TenantResource).filter(
        TenantResource.tenant_id == user["tenant_id"],
        TenantResource.resource_type == normalized_type,
        TenantResource.workspace_id == active_workspace  # NEW
    )
    # ... rest of function
```

---

## Testing Strategy

### Unit Tests
```python
def test_list_flows_respects_workspace():
    """Verify flows are filtered by user's active workspace."""
    # Create workspace X and Y
    # Create flows in X and Y
    # Switch user to workspace X
    # List flows should return only flows from X

def test_create_flow_in_active_workspace():
    """Verify new flows are created in active workspace."""
    # Set active workspace to X
    # Create flow
    # Verify flow.workspace_id == X

def test_cross_workspace_access_denied():
    """Verify user cannot access flows from other workspaces."""
    # User in workspace X
    # Try to GET flow from workspace Y
    # Should return 404 or 403
```

### Integration Tests
```python
def test_workspace_switching():
    """Verify switching workspace changes visible flows."""
    # User in workspace X, sees flow A
    # Switch to workspace Y
    # User no longer sees flow A, sees flow B
    # Switch back to X, sees A again
```

---

## Migration Plan

### Step 1: Prepare (Immediate)
- [ ] Code review of implementation approach
- [ ] Create Alembic migration template
- [ ] Add _get_active_workspace() helper function ✅ (Already done)

### Step 2: Database (Before production deployment)
- [ ] Run schema migration in development
- [ ] Backfill workspace associations
- [ ] Test rollback procedure
- [ ] Schedule production migration window

### Step 3: Backend (2-3 hours)
- [ ] Update all flow endpoints
- [ ] Update all resource endpoints
- [ ] Add validation that workspace exists
- [ ] Add tests

### Step 4: Frontend (1-2 hours)
- [ ] Update UI to show active workspace
- [ ] Update flow/resource listings
- [ ] Test UI filtering

### Step 5: Testing (2-3 hours)
- [ ] Manual testing of all scenarios
- [ ] Load testing
- [ ] Regression testing of existing features

### Step 6: Deployment
- [ ] Deploy in phases
- [ ] Monitor audit logs for workspace violations
- [ ] Gather user feedback

---

## Risk Mitigation

### Risks
1. **Migration downtime** - Could take hours for large databases
   - Mitigation: Practice in staging, run during low-traffic window

2. **Data loss** - Incorrect backfill could lose flow assignments
   - Mitigation: Test backfill logic extensively, backup database

3. **Performance degradation** - New WHERE clause could slow queries
   - Mitigation: Add index on (tenant_id, workspace_id)

4. **User confusion** - "Why can't I see my flows?"
   - Mitigation: Clear communication, UI indicators, support docs

### Rollback Plan
```bash
# 1. Identify last good backup
# 2. Restore database to pre-migration state
# 3. Revert code changes
# 4. Roll back deployment
```

---

## Success Criteria

✅ Workspace isolation is complete when:
1. User can only see/access flows in their active workspace
2. User can only see/access resources in their active workspace
3. Cross-workspace access attempts return 404/403
4. New flows/resources are created in the active workspace
5. Switching workspaces immediately changes visible data
6. All 23 affected endpoints enforce workspace boundaries
7. Audit logs show workspace_id for all operations
8. No performance regression in list queries

---

## Timeline Estimate

| Phase | Duration | Notes |
|-------|----------|-------|
| Planning | 30 min | ✅ Done |
| Helper functions | 30 min | ✅ Done |
| Database migration | 1-2 hours | Depends on data size |
| Backend updates | 2-3 hours | 23 endpoints |
| Frontend updates | 1-2 hours | UI indicators |
| Testing | 2-3 hours | Comprehensive |
| Deployment | 30 min | Low-traffic window |
| **Total** | **6-10 hours** | |

---

## Conclusion

Workspace isolation is achievable but requires careful planning and execution. The recommended approach is:

1. **Now**: Use the _get_active_workspace() helper function (foundation)
2. **Next Sprint**: Plan and execute database migration
3. **Following Sprint**: Implement workspace filtering across all endpoints
4. **Final Sprint**: Test thoroughly and deploy to production

This phased approach allows us to:
- Build confidence with smaller changes
- Catch issues early
- Minimize deployment risk
- Gather feedback from testing

