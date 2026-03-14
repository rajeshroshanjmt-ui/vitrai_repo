# Workspace Filtering Implementation - Code Updates

This guide shows the exact code changes needed for workspace isolation enforcement after the migration.

## Prerequisites

1. ✅ Migration executed: `migrations/001_add_workspace_isolation.sql`
2. ✅ Schema updated: `workspace_id` columns added to flows and tenant_resources
3. ✅ Alembic installed: Added to requirements.txt
4. ✅ Helper function ready: `_get_active_workspace()` in flows.py

---

## Pattern for All Endpoints

Every endpoint that lists/accesses flows or resources should follow this pattern:

```python
# Get user's active workspace
active_workspace = _get_active_workspace(db, user["tenant_id"], user["user_id"])

# Filter query to include workspace_id check
flows = db.query(Flow).filter(
    Flow.tenant_id == user["tenant_id"],
    Flow.workspace_id == active_workspace  # NEW LINE
).all()
```

---

## Updated Flows Endpoints

### 1. `GET /flows/list` - Updated
**File:** `backend/flows.py:824`

```python
@router.get("/list")
def list_flows(
    limit: int = 50,
    db: Session = Depends(get_db),
    user: Annotated[dict, Depends(require_permission("chatflows:view", "agentflows:view"))] = None,
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

    items: list[dict[str, Any]] = []
    for flow in flows:
        # ... rest of function unchanged
```

### 2. `POST /flows/create` - Updated
**File:** `backend/flows.py:449`

```python
@router.post("/create")
def create_flow(
    body: FlowCreateRequest,
    db: Session = Depends(get_db),
    user: Annotated[dict, Depends(require_permission("chatflows:create", "agentflows:create"))] = None,
) -> dict[str, Any]:
    tenant_id = user["tenant_id"]
    active_workspace = _get_active_workspace(db, tenant_id, user["user_id"])  # NEW
    _ensure_tenant(db, tenant_id)

    flow = Flow(
        id=str(uuid4()),
        tenant_id=tenant_id,
        workspace_id=active_workspace,  # NEW
        name=body.name
    )
    db.add(flow)

    version = FlowVersion(
        id=str(uuid4()),
        flow_id=flow.id,
        version=1,
        json_definition=body.json_definition,
        is_published=False,
    )
    db.add(version)
    db.commit()
    return _success_payload({"flow_id": flow.id, "draft_version_id": version.id, "version": 1})
```

### 3. `GET /flows/{flow_id}` - Updated
**File:** `backend/flows.py:940`

```python
@router.get("/{flow_id}")
def get_flow(
    flow_id: str,
    db: Session = Depends(get_db),
    user: Annotated[dict, Depends(require_permission("chatflows:view", "agentflows:view"))] = None,
) -> dict[str, Any]:
    active_workspace = _get_active_workspace(db, user["tenant_id"], user["user_id"])  # NEW

    flow = db.query(Flow).filter(
        Flow.id == flow_id,
        Flow.tenant_id == user["tenant_id"],
        Flow.workspace_id == active_workspace  # NEW
    ).one_or_none()

    if flow is None:
        raise HTTPException(status_code=404, detail="Flow not found")

    # ... rest of function unchanged
```

### 4. `DELETE /flows/{flow_id}` - Updated
**File:** `backend/flows.py:969`

```python
@router.delete("/{flow_id}")
def delete_flow(
    flow_id: str,
    db: Session = Depends(get_db),
    user: Annotated[dict, Depends(require_permission("chatflows:delete", "agentflows:delete"))] = None,
) -> dict[str, Any]:
    active_workspace = _get_active_workspace(db, user["tenant_id"], user["user_id"])  # NEW

    flow = db.query(Flow).filter(
        Flow.id == flow_id,
        Flow.tenant_id == user["tenant_id"],
        Flow.workspace_id == active_workspace  # NEW
    ).one_or_none()

    if flow is None:
        raise HTTPException(status_code=404, detail="Flow not found")

    # ... rest of function unchanged
```

### 5. `PUT /flows/{flow_id}/draft` - Updated
**File:** `backend/flows.py:473`

```python
@router.put("/{flow_id}/draft")
def save_draft(
    flow_id: str,
    body: FlowDraftRequest,
    db: Session = Depends(get_db),
    user: Annotated[dict, Depends(require_permission("chatflows:edit", "agentflows:edit"))] = None,
) -> dict[str, Any]:
    active_workspace = _get_active_workspace(db, user["tenant_id"], user["user_id"])  # NEW

    flow = db.query(Flow).filter(
        Flow.id == flow_id,
        Flow.tenant_id == user["tenant_id"],
        Flow.workspace_id == active_workspace  # NEW
    ).one_or_none()

    if flow is None:
        raise HTTPException(status_code=404, detail="Flow not found")

    # ... rest of function unchanged
```

### 6. `POST /flows/{flow_id}/publish` - Updated
**File:** `backend/flows.py:500`

```python
@router.post("/{flow_id}/publish")
def publish_flow(
    flow_id: str,
    body: FlowPublishRequest,
    db: Session = Depends(get_db),
    user: Annotated[dict, Depends(require_permission("chatflows:publish", "agentflows:publish"))] = None,
) -> dict[str, Any]:
    active_workspace = _get_active_workspace(db, user["tenant_id"], user["user_id"])  # NEW

    flow = db.query(Flow).filter(
        Flow.id == flow_id,
        Flow.tenant_id == user["tenant_id"],
        Flow.workspace_id == active_workspace  # NEW
    ).one_or_none()

    if flow is None:
        raise HTTPException(status_code=404, detail="Flow not found")

    # ... rest of function unchanged
```

### 7. `POST /flows/{flow_id}/execute` - Updated
**File:** `backend/flows.py:537`

```python
@router.post("/{flow_id}/execute")
def execute_flow(
    flow_id: str,
    body: ExecuteRequest,
    db: Session = Depends(get_db),
    user: Annotated[dict, Depends(require_permission("chatflows:execute", "agentflows:execute"))] = None,
) -> dict[str, Any]:
    active_workspace = _get_active_workspace(db, user["tenant_id"], user["user_id"])  # NEW

    flow = db.query(Flow).filter(
        Flow.id == flow_id,
        Flow.tenant_id == user["tenant_id"],
        Flow.workspace_id == active_workspace  # NEW
    ).one_or_none()

    if flow is None:
        raise HTTPException(status_code=404, detail="Flow not found")

    # ... rest of function unchanged
```

### 8. `GET /flows/{flow_id}/versions` - Updated
**File:** `backend/flows.py:909`

```python
@router.get("/{flow_id}/versions")
def get_flow_versions(
    flow_id: str,
    db: Session = Depends(get_db),
    user: Annotated[dict, Depends(require_permission("chatflows:view", "agentflows:view"))] = None,
) -> dict[str, Any]:
    active_workspace = _get_active_workspace(db, user["tenant_id"], user["user_id"])  # NEW

    flow = db.query(Flow).filter(
        Flow.id == flow_id,
        Flow.tenant_id == user["tenant_id"],
        Flow.workspace_id == active_workspace  # NEW
    ).one_or_none()

    if flow is None:
        raise HTTPException(status_code=404, detail="Flow not found")

    # ... rest of function unchanged
```

---

## Updated Resources Endpoints

### 1. `GET /resources/{resource_type}` - Updated
**File:** `backend/resources.py:96`

```python
@router.get("/{resource_type}")
def list_resources(
    resource_type: str,
    limit: int = 50,
    offset: int = 0,
    q: str | None = None,
    db: Session = Depends(get_db),
    user: Annotated[dict, Depends(require_permission("resources:view"))] = None,
) -> dict[str, Any]:
    from auth import _get_active_workspace  # Import helper

    active_workspace = _get_active_workspace(db, user["tenant_id"], user["user_id"])  # NEW
    normalized_type = _ensure_resource_type(resource_type)

    if user.get("role") not in _required_reader_roles(normalized_type):
        raise HTTPException(status_code=403, detail="Insufficient role")

    safe_limit = max(1, min(limit, 200))
    safe_offset = max(0, offset)

    query = db.query(TenantResource).filter(
        TenantResource.tenant_id == user["tenant_id"],
        TenantResource.resource_type == normalized_type,
        TenantResource.workspace_id == active_workspace  # NEW
    )

    if q:
        query = query.filter(TenantResource.name.ilike(f"%{q.strip()}%"))

    total_count = query.count()
    rows = query.order_by(TenantResource.updated_at.desc()).offset(safe_offset).limit(safe_limit).all()
    return {
        "items": [_serialize_resource(row) for row in rows],
        "total_count": total_count,
        "limit": safe_limit,
        "offset": safe_offset,
    }
```

### 2. `GET /resources/{resource_type}/{resource_id}` - Updated
**File:** `backend/resources.py:131`

```python
@router.get("/{resource_type}/{resource_id}")
def get_resource(
    resource_type: str,
    resource_id: str,
    db: Session = Depends(get_db),
    user: Annotated[dict, Depends(require_permission("resources:view"))] = None,
) -> dict[str, Any]:
    from auth import _get_active_workspace  # Import helper

    active_workspace = _get_active_workspace(db, user["tenant_id"], user["user_id"])  # NEW
    normalized_type = _ensure_resource_type(resource_type)

    if user.get("role") not in _required_reader_roles(normalized_type):
        raise HTTPException(status_code=403, detail="Insufficient role")

    resource = (
        db.query(TenantResource)
        .filter(
            TenantResource.id == resource_id,
            TenantResource.tenant_id == user["tenant_id"],
            TenantResource.resource_type == normalized_type,
            TenantResource.workspace_id == active_workspace  # NEW
        )
        .one_or_none()
    )
    if resource is None:
        raise HTTPException(status_code=404, detail="Resource not found")

    return _serialize_resource(resource)
```

### 3. `POST /resources/{resource_type}` - Updated
**File:** `backend/resources.py:158`

```python
@router.post("/{resource_type}")
def create_resource(
    resource_type: str,
    body: ResourceCreateRequest,
    db: Session = Depends(get_db),
    user: Annotated[dict, Depends(require_permission("resources:create"))] = None,
) -> dict[str, Any]:
    from auth import _get_active_workspace  # Import helper

    active_workspace = _get_active_workspace(db, user["tenant_id"], user["user_id"])  # NEW
    normalized_type = _ensure_resource_type(resource_type)
    _ensure_tenant(db, user["tenant_id"])

    now_utc = datetime.now(timezone.utc)
    resource = TenantResource(
        id=str(uuid4()),
        tenant_id=user["tenant_id"],
        resource_type=normalized_type,
        name=body.name.strip(),
        payload=body.payload,
        workspace_id=active_workspace,  # NEW
        created_by=user.get("user_id"),
        updated_by=user.get("user_id"),
        created_at=now_utc,
        updated_at=now_utc,
    )
    db.add(resource)
    _append_audit_log(db, user, f"resource_create:{normalized_type}", resource)
    db.commit()
    return _serialize_resource(resource)
```

### 4. `PUT /resources/{resource_type}/{resource_id}` - Updated
**File:** `backend/resources.py:186`

```python
@router.put("/{resource_type}/{resource_id}")
def update_resource(
    resource_type: str,
    resource_id: str,
    body: ResourceUpdateRequest,
    db: Session = Depends(get_db),
    user: Annotated[dict, Depends(require_permission("resources:edit"))] = None,
) -> dict[str, Any]:
    from auth import _get_active_workspace  # Import helper

    active_workspace = _get_active_workspace(db, user["tenant_id"], user["user_id"])  # NEW
    normalized_type = _ensure_resource_type(resource_type)

    resource = (
        db.query(TenantResource)
        .filter(
            TenantResource.id == resource_id,
            TenantResource.tenant_id == user["tenant_id"],
            TenantResource.resource_type == normalized_type,
            TenantResource.workspace_id == active_workspace  # NEW
        )
        .one_or_none()
    )
    if resource is None:
        raise HTTPException(status_code=404, detail="Resource not found")

    if body.name is not None:
        resource.name = body.name.strip()
    if body.payload is not None:
        resource.payload = body.payload

    resource.updated_by = user.get("user_id")
    resource.updated_at = datetime.now(timezone.utc)
    _append_audit_log(db, user, f"resource_update:{normalized_type}", resource)
    db.commit()
    return _serialize_resource(resource)
```

### 5. `DELETE /resources/{resource_type}/{resource_id}` - Updated
**File:** `backend/resources.py:219`

```python
@router.delete("/{resource_type}/{resource_id}")
def delete_resource(
    resource_type: str,
    resource_id: str,
    db: Session = Depends(get_db),
    user: Annotated[dict, Depends(require_permission("resources:delete"))] = None,
) -> dict[str, Any]:
    from auth import _get_active_workspace  # Import helper

    active_workspace = _get_active_workspace(db, user["tenant_id"], user["user_id"])  # NEW
    normalized_type = _ensure_resource_type(resource_type)

    resource = (
        db.query(TenantResource)
        .filter(
            TenantResource.id == resource_id,
            TenantResource.tenant_id == user["tenant_id"],
            TenantResource.resource_type == normalized_type,
            TenantResource.workspace_id == active_workspace  # NEW
        )
        .one_or_none()
    )
    if resource is None:
        raise HTTPException(status_code=404, detail="Resource not found")

    _append_audit_log(db, user, f"resource_delete:{normalized_type}", resource)
    db.delete(resource)
    db.commit()
    return {
        "status": "deleted",
        "resource_id": resource_id,
        "resource_type": normalized_type,
    }
```

---

## Implementation Steps

1. **Review Migration**: Verify `migrations/001_add_workspace_isolation.sql`
2. **Run Migration**: Execute SQL against database
3. **Update Flows Module**: Apply changes to `backend/flows.py` (8 endpoints)
4. **Update Resources Module**: Apply changes to `backend/resources.py` (5 endpoints)
5. **Test Each Endpoint**: Verify workspace filtering works
6. **Update Frontend**: Display active workspace in UI
7. **Comprehensive Testing**: Test cross-workspace access denial

---

## Testing Checklist

- [ ] User in workspace X can list flows in X
- [ ] User in workspace X cannot see flows from Y
- [ ] Creating flow in workspace X assigns it to X
- [ ] Switching workspaces changes visible flows
- [ ] Cross-workspace DELETE returns 404
- [ ] Resources filtered by workspace correctly
- [ ] Audit logs show workspace_id
- [ ] Performance is acceptable with filtering

---

## Rollback Plan

If issues arise:

```sql
-- Remove workspace_id columns
ALTER TABLE flows DROP COLUMN workspace_id;
ALTER TABLE tenant_resources DROP COLUMN workspace_id;

-- Revert code changes
git revert <commit-hash>
```

---

## Notes

- All NEW markers show exactly what changed
- `_get_active_workspace()` is already implemented
- Helper function handles no-workspace-selected edge case
- Consistent error messages across all endpoints
- Backward compatible if workspace_id is NULL (default workspace)

