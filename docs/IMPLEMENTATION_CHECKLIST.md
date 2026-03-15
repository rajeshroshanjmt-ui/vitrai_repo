# Workspace Isolation Implementation Checklist

This checklist guides the next developer through implementing workspace isolation to reach **27/30 gaps fixed (90%)**.

---

## Phase 1: Schema & Database Updates (30-45 minutes)

### Prerequisites
- [ ] PostgreSQL/MySQL database access
- [ ] Backup of current database
- [ ] Test environment ready

### Steps

1. **Add Column Definitions to Models** (10 minutes)
   - [ ] Open `backend/models.py`
   - [ ] Find `class Flow(Base):`
   - [ ] Add line: `workspace_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("tenant_resources.id", ondelete="CASCADE"), nullable=True)`
   - [ ] Find `class TenantResource(Base):`
   - [ ] Add line: `workspace_id: Mapped[str | None] = mapped_column(UUID(as_uuid=False), ForeignKey("tenant_resources.id", ondelete="CASCADE"), nullable=True)`

2. **Create Alembic Setup** (5 minutes)
   ```bash
   cd backend
   alembic init alembic
   ```

3. **Generate Initial Migration** (5 minutes)
   ```bash
   alembic revision --autogenerate -m "Add workspace_id columns"
   ```

4. **Apply Custom Migration** (15 minutes)
   - [ ] Replace generated migration with `migrations/001_add_workspace_isolation.sql`
   - [ ] Or manually run the SQL file against your database:
   ```bash
   psql -U your_user -d your_db -f backend/migrations/001_add_workspace_isolation.sql
   ```

5. **Verify Schema**
   ```sql
   -- Check flows table
   \d flows
   -- Should show: workspace_id | uuid

   -- Check tenant_resources table
   \d tenant_resources
   -- Should show: workspace_id | uuid
   ```

---

## Phase 2: Backend Code Updates (2-3 hours)

### 2.1: Import Helper Function (Already Done ✅)
- [x] `_get_active_workspace()` already in `backend/flows.py:104`

### 2.2: Update Flows Endpoints (90 minutes)

**Files to modify:** `backend/flows.py`

For each endpoint below:
1. Copy exact code from `WORKSPACE_FILTERING_IMPLEMENTATION.md`
2. Apply to the corresponding line number
3. Test the endpoint
4. Commit the change

#### Flows Endpoints (8 total):

| Endpoint | File | Line | Status |
|----------|------|------|--------|
| POST `/flows/create` | flows.py | 449 | ⏳ |
| PUT `/flows/{flow_id}/draft` | flows.py | 473 | ⏳ |
| POST `/flows/{flow_id}/publish` | flows.py | 500 | ⏳ |
| POST `/flows/{flow_id}/execute` | flows.py | 537 | ⏳ |
| GET `/flows/{flow_id}` | flows.py | 940 | ⏳ |
| DELETE `/flows/{flow_id}` | flows.py | 969 | ⏳ |
| GET `/flows/{flow_id}/versions` | flows.py | 909 | ⏳ |
| GET `/flows/list` | flows.py | 824 | ⏳ |

**Checklist for each endpoint:**
```
- [ ] Read implementation guide section
- [ ] Open flows.py file
- [ ] Locate the function (by line number)
- [ ] Add: active_workspace = _get_active_workspace(...)
- [ ] Update query filter to include workspace_id check
- [ ] Save file
- [ ] Test endpoint with curl or Postman
- [ ] Verify error handling for no workspace
- [ ] Commit with message: "feat: Add workspace filtering to {endpoint}"
```

### 2.3: Update Resources Endpoints (90 minutes)

**Files to modify:** `backend/resources.py`

For each endpoint below:
1. Add import: `from auth import _get_active_workspace`
2. Copy exact code from `WORKSPACE_FILTERING_IMPLEMENTATION.md`
3. Apply to the corresponding line number
4. Test the endpoint

#### Resources Endpoints (5 total):

| Endpoint | File | Line | Status |
|----------|------|------|--------|
| GET `/resources/{resource_type}` | resources.py | 96 | ⏳ |
| GET `/resources/{resource_type}/{resource_id}` | resources.py | 131 | ⏳ |
| POST `/resources/{resource_type}` | resources.py | 158 | ⏳ |
| PUT `/resources/{resource_type}/{resource_id}` | resources.py | 186 | ⏳ |
| DELETE `/resources/{resource_type}/{resource_id}` | resources.py | 219 | ⏳ |

### 2.4: Update Other Endpoints (30 minutes)

The following endpoints also need workspace filtering but use the existing `_require_tenant_flow()` function:

**List to update:**
- [ ] `POST /flows/{flow_id}/documents` (line 626) - Add workspace check
- [ ] `GET /flows/{flow_id}/ingestions` (line 677) - Add workspace check
- [ ] Other flow endpoints as needed

---

## Phase 3: Testing (1-2 hours)

### Unit Tests

Create file: `backend/tests/test_workspace_isolation.py`

```python
import pytest
from tests.conftest import client, db_session

def test_user_can_only_see_flows_in_their_workspace():
    """Verify flows are filtered by user's active workspace."""
    # Setup: Create 2 workspaces, 2 flows
    # User sets active workspace to workspace 1
    # List flows - should only see flow 1
    # Switch to workspace 2
    # List flows - should only see flow 2

def test_creating_flow_assigns_to_active_workspace():
    """Verify new flows are created in user's active workspace."""
    # Setup: Set active workspace to workspace 1
    # Create flow
    # Verify flow.workspace_id == workspace 1

def test_cross_workspace_access_denied():
    """Verify user cannot access flows from other workspaces."""
    # Setup: Create 2 workspaces with different users
    # User A tries to DELETE flow from User B's workspace
    # Should return 404 or 403

def test_resource_filtering_by_workspace():
    """Verify resources are filtered by workspace."""
    # Similar pattern to flows testing

def test_switching_workspaces():
    """Verify switching workspace changes visible data."""
    # User in workspace X, lists flows
    # User switches to workspace Y
    # Lists flows - different list returned
    # Switches back to X - sees original list again
```

### Manual Testing Checklist

- [ ] **Workspace A / User 1:**
  - [ ] Create flow in workspace A
  - [ ] List flows - see only workspace A flows
  - [ ] Create resource in workspace A
  - [ ] List resources - see only workspace A resources

- [ ] **Workspace B / User 2:**
  - [ ] Create flow in workspace B
  - [ ] List flows - see only workspace B flows
  - [ ] Workspace A flows are NOT visible
  - [ ] CREATE in workspace A - verify 404/403

- [ ] **Cross-Workspace Access:**
  - [ ] User A tries to GET workspace B flow
  - [ ] Returns 404
  - [ ] User A tries to DELETE workspace B flow
  - [ ] Returns 404
  - [ ] User A tries to UPDATE workspace B resource
  - [ ] Returns 404

- [ ] **Workspace Switching:**
  - [ ] User switches active workspace
  - [ ] List flows changes immediately
  - [ ] Audit log shows workspace change

---

## Phase 4: Verification & Cleanup (30 minutes)

### Code Verification
- [ ] All 13 endpoints updated
- [ ] No syntax errors (run: `python -m py_compile backend/*.py`)
- [ ] Import statements correct
- [ ] Error messages consistent

### Database Verification
- [ ] All flows have workspace_id assigned
- [ ] All resources (except workspace type) have workspace_id assigned
- [ ] Indexes created and working

### Documentation
- [ ] Update FINAL_PROGRESS_SUMMARY.md with completion
- [ ] Create commit: "feat: Complete workspace isolation enforcement"
- [ ] Verify git log shows all changes

### Performance Check
- [ ] Query with workspace filter runs in <100ms
- [ ] List endpoint returns results within 1 second
- [ ] No N+1 queries introduced

---

## Expected Results After Completion

✅ **27/30 gaps fixed (90%)**

- [x] Fine-grained permissions enforcement
- [x] Feature flags enabled
- [x] Ingestion job endpoint
- [x] Raw fetch() cleanup
- [x] **Workspace isolation enforcement** (NEW)

⏳ **Remaining Gaps (3):**
- [ ] OAuth Callback Handler (4-5 hours)
- [ ] Workspace Selection Logic Enforcement (2-3 hours)
- [ ] Test Coverage (2-3 hours)

---

## Rollback Plan

If issues arise, revert with:

```bash
# Undo code changes
git revert <commit-hash>

# Undo database schema
psql -U your_user -d your_db << 'EOF'
ALTER TABLE flows DROP COLUMN workspace_id;
ALTER TABLE tenant_resources DROP COLUMN workspace_id;
DROP INDEX idx_flows_tenant_workspace;
DROP INDEX idx_tenant_resources_tenant_workspace;
DROP INDEX idx_tenant_resources_workspace_type;
EOF
```

---

## Time Estimates

| Phase | Duration | Status |
|-------|----------|--------|
| Schema Updates | 30-45 min | ⏳ |
| Flows Endpoints | 60-90 min | ⏳ |
| Resources Endpoints | 60-90 min | ⏳ |
| Testing | 60-120 min | ⏳ |
| Verification | 30 min | ⏳ |
| **TOTAL** | **4-6 hours** | ⏳ |

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `WORKSPACE_FILTERING_IMPLEMENTATION.md` | Exact code for each endpoint |
| `WORKSPACE_ISOLATION_GUIDE.md` | Architecture & planning |
| `migrations/001_add_workspace_isolation.sql` | Database migration |
| `backend/flows.py:104` | Helper function location |
| `FINAL_PROGRESS_SUMMARY.md` | Overall progress |

---

## Success Criteria

✅ Implementation is complete when:
1. All 13 endpoints updated with workspace filtering
2. Database schema updated with workspace_id columns
3. All tests pass (unit + manual)
4. No cross-workspace access is possible
5. Workspace switching affects visible data immediately
6. Performance is acceptable
7. Audit logs show workspace_id
8. Code is merged to main branch

---

## Notes for Developer

- **Start with schema** - Cannot update code without database columns
- **Test frequently** - Test after each endpoint, not all at once
- **Use provided code** - WORKSPACE_FILTERING_IMPLEMENTATION.md has exact changes
- **Commit often** - Create commits for each endpoint group
- **Reference line numbers** - They match the provided guides
- **Watch for imports** - Resources module needs to import _get_active_workspace

Good luck! 🚀

