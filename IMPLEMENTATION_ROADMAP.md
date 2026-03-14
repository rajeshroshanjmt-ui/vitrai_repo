# Implementation Roadmap - Remaining Gaps

## Status: 18/30 gaps fixed (60%)

## Recently Added (Latest Commit)

### Fine-Grained Permission Function (auth.py)
- Added `require_permission(*permission_strings)` dependency
- Checks Role/RolePermission tables for custom roles
- Falls back to simple role checks for system roles (admin/editor/viewer)
- Ready for route integration

**Next Step:** Apply `require_permission()` to routes that need fine-grained control

---

## High Priority Roadmap (3 Items)

### 1. Permissions Enforcement Integration (IN PROGRESS)

**Status:** Foundation complete, integration needed

**What's Done:**
- ✓ `require_permission()` function implemented in auth.py
- ✓ Permission/Role/RolePermission models exist
- ✓ 60+ permissions predefined
- ✓ Permission management API endpoints working

**What's Needed:**
- [ ] Apply `require_permission()` to routes that need fine-grained control
- [ ] Update user API endpoints to check user permissions
- [ ] Update flow endpoints to respect custom role permissions
- [ ] Update resource endpoints to respect custom role permissions
- [ ] Add admin guards to prevent deletion of system roles

**Files to Update:**
- `backend/users.py` - User list, update, delete
- `backend/flows.py` - Create, edit, delete flows
- `backend/resources.py` - Resource CRUD operations
- `backend/workspace.py` - Workspace management
- `backend/permissions.py` - Role deletion guard

**Estimated Effort:** Medium (2-3 hours)

**Example Implementation:**
```python
# Before (simple role check)
@router.post("/flows/create")
def create_flow(
    body: FlowCreateRequest,
    user: Annotated[dict, Depends(require_roles("admin", "editor"))],
    db: Session = Depends(get_db)
):

# After (fine-grained permission check)
@router.post("/flows/create")
def create_flow(
    body: FlowCreateRequest,
    user: Annotated[dict, Depends(require_permission("chatflows:create"))],
    db: Session = Depends(get_db)
):
```

---

### 2. Workspace Isolation Enforcement

**Status:** Not started; complex architectural change

**Current State:**
- Workspace-user links are stored in UserPreference table
- Workspace filtering NOT enforced on resource access
- Any tenant user can access all flows/resources

**What Needs to Happen:**
1. Add workspace filtering to all flow/resource queries
2. Require workspace membership for access
3. Filter resources by active workspace (from UserPreference)
4. Validate workspace access on all CRUD operations

**Files to Modify:**
- `backend/flows.py` - All flow endpoints
- `backend/resources.py` - All resource endpoints
- `backend/workspace.py` - Resource access functions

**Implementation Pattern:**
```python
# Get user's active workspace
active_workspace_pref = db.query(UserPreference).filter(
    UserPreference.user_id == user["user_id"],
    UserPreference.tenant_id == tenant_id,
    UserPreference.pref_key == "active_workspace"
).one_or_none()

active_workspace_id = active_workspace_pref.pref_value.get("workspace_id") if active_workspace_pref else None

if not active_workspace_id:
    raise HTTPException(status_code=400, detail="No active workspace selected")

# Filter resources by workspace
flows = db.query(Flow).filter(
    Flow.tenant_id == tenant_id,
    Flow.workspace_id == active_workspace_id  # Add this column or filter differently
).all()
```

**Decision Needed:**
- Should flows have a workspace_id column, or should workspace membership be through TenantResource?
- Current: Flows only have flow_id, tenant_id, no workspace_id

**Estimated Effort:** High (4-6 hours)

---

### 3. OAuth Callback Handler (SSO Login Flow)

**Status:** Not started; requires OAuth library integration

**Current State:**
- SSO configurations can be stored (Azure AD, Google, Auth0, GitHub)
- OIDC discovery endpoint can be tested
- No callback handler to complete OAuth flow

**What Needs to Happen:**
1. Implement `POST /auth/callback` endpoint
2. Add OIDC/OAuth library (python-jose already used, add authlib or similar)
3. Exchange authorization code for tokens
4. Create user if doesn't exist (with pending status)
5. Issue Vetrai JWT token
6. Redirect to frontend with token

**Required Libraries:**
- `authlib` or `oauthlib` for OAuth flow handling
- `python-jose` for JWT (already installed)

**Files to Create/Modify:**
- `backend/auth.py` - Add callback handler
- `backend/oauth_providers.py` - New file for provider implementations

**Implementation Outline:**
```python
@router.post("/callback")
def oauth_callback(
    code: str,
    state: str,
    db: Session = Depends(get_db)
):
    # 1. Validate state (CSRF protection)
    # 2. Get SSO config for tenant
    # 3. Exchange code for token
    # 4. Get user info from provider
    # 5. Create/update user in database
    # 6. Issue Vetrai JWT token
    # 7. Return login response
```

**Estimated Effort:** High (4-5 hours)

---

## Medium Priority Roadmap (4 Items)

### 4. Database Migration Framework (Alembic)

**Status:** Not started; infrastructure task

**Why Needed:**
- Current: Tables created via SQLAlchemy `create_all()` at startup
- Problem: Schema changes require manual coordination in production
- Solution: Use Alembic for versioned migrations

**Steps:**
1. Install alembic: `pip install alembic`
2. Initialize: `alembic init alembic`
3. Update alembic.ini with database connection
4. Create initial migration: `alembic revision --autogenerate -m "initial"`
5. Update CI/CD to run migrations: `alembic upgrade head`

**Estimated Effort:** Low (1-2 hours)

---

### 5. Role Name Editing

**Status:** Easy UI fix

**Problem:** Role names immutable after creation

**Solution:**
- File: `frontend/ui/src/views/roles/CreateRoleDialog.jsx`
- Enable name field when mode === 'EDIT'
- Add validation to prevent empty names

**Estimated Effort:** Low (30 minutes)

---

### 6. Feature Flags Configuration

**Status:** Review needed

**Current:** Several features disabled by default
- `feat:files`
- `feat:sso-config`
- `feat:roles`
- `feat:login-activity`

**Decision Needed:**
- Are these truly enterprise-only, or should they be enabled?
- File: `frontend/ui/src/api/auth.js` (DEFAULT_PERMISSIONS)

**Estimated Effort:** Low (depends on decision)

---

### 7. PDF Document Processing

**Status:** Stub implementation

**Current:** Falls back to plain text; pdfminer not integrated

**What's Needed:**
1. Install: `pip install pdfminer.six`
2. Update `backend/platform_compat.py` `process_document_loader()` function
3. Add PDF text extraction before chunking

**Implementation:**
```python
from pdfminer.high_level import extract_text

if source_type == "pdf":
    text = extract_text(source)  # Extract text from PDF
    chunks = chunk_text(text)
```

**Estimated Effort:** Low (1-2 hours)

---

## Low Priority Roadmap (5 Items)

### 8. Replace raw fetch() calls (Tech Debt)
- Files: `views/users/index.jsx`, `views/audit/index.jsx`
- Use existing API clients instead
- **Effort:** Low (1 hour)

### 9. Workspace Selection Logic
- Current: Workspace switching implemented but not enforced
- Refactor to use active workspace for all operations
- **Effort:** Medium (depends on workspace isolation)

### 10. Test Coverage Improvements
- Add pytest tests for: users.py, permissions.py, workspace.py, files.py, resources.py
- **Effort:** Medium (2-3 hours per module)

### 11. Organization Setup Code
- Clean up legacy Flowise patterns in org setup
- **Effort:** Low (1 hour)

### 12. Progress Bar UI
- Connect to real backend progress events (if backend provides them)
- **Effort:** Low (1 hour, or skip if not critical)

---

## Quick Wins (Can Do Immediately)

1. **Role Name Editing** - 30 minutes
2. **PDF Processing** - 1-2 hours
3. **Database Migrations Setup** - 1-2 hours
4. **Replace raw fetch()** - 1 hour

**Total Time:** ~5 hours for all quick wins

---

## Implementation Priority

**If you have 1-2 days:**
1. Permissions enforcement integration (high priority, blocks other work)
2. All quick wins (easy wins)
3. Feature flags decision and implementation

**If you have 3-5 days:**
1. Permissions enforcement integration
2. Quick wins
3. Workspace isolation (requires architectural decisions first)
4. Database migrations

**If you have 1+ week:**
1. All of the above
2. OAuth callback handler (requires careful testing)
3. Full test coverage implementation
4. Code cleanup and tech debt

---

## Testing Strategy

After implementing permissions enforcement:
1. Test custom role creation
2. Test permission assignment to role
3. Test user with custom role accessing resource
4. Test fallback to system roles
5. Test denial of access for insufficient permissions

---

## Environment Variables Needed

Email service (already implemented):
```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM_EMAIL=noreply@vetrai.ai
SMTP_FROM_NAME=Vetrai
VETRAI_BASE_URL=https://your-domain.com
```

For OAuth (future implementation):
```
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
AZURE_CLIENT_ID=...
AZURE_CLIENT_SECRET=...
AZURE_TENANT_URL=...
AUTH0_CLIENT_ID=...
AUTH0_CLIENT_SECRET=...
AUTH0_DOMAIN=...
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
```

---

## Summary

**Completed:** 18/30 gaps (60%)
**Quick Wins:** 4 items (5 hours)
**Medium Effort:** 3 items (8-10 hours)
**High Effort:** 3 items (12-15 hours)

**Total Remaining:** ~25-30 hours to fix all 30 gaps
