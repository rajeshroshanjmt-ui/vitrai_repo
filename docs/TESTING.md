# Vetrai Integration & Verification Testing

Complete guide for testing Phase 1-3 implementations across the Vetrai platform.

## Quick Start

### Backend Integration Tests

```bash
# 1. Install dependencies (if needed)
pip install requests

# 2. Run integration tests
export TEST_BASE_URL=http://localhost:8000/api
export TEST_TENANT_ID=00000000-0000-0000-0000-000000000001
python backend/tests/integration_test.py

# 3. Check audit completeness
pwsh scripts/audit_completeness_check.ps1 -BaseUrl http://localhost:8000/api
```

### Frontend Integration Tests

```bash
# 1. Install Cypress (if not already installed)
cd frontend/ui
npm install cypress --save-dev

# 2. Run tests
TEST_BASE_URL=http://localhost:3000 npx cypress run --spec "tests/integration.test.js"

# 3. Open interactive test runner
TEST_BASE_URL=http://localhost:3000 npx cypress open
```

---

## Manual Verification Checklist

### Phase 1: Critical Features

- [ ] **Users Management**
  - [ ] Navigate to `/users`
  - [ ] Click "Invite User" button
  - [ ] Enter email and select role
  - [ ] Verify user appears in table
  - [ ] Edit user role and verify change
  - [ ] Delete user and verify removal

- [ ] **File Management**
  - [ ] Navigate to `/files`
  - [ ] Upload a text or PDF file
  - [ ] Verify file appears in list
  - [ ] Delete file and verify removal

- [ ] **Workspace Management**
  - [ ] Navigate to `/workspace`
  - [ ] Create new workspace
  - [ ] Switch to created workspace
  - [ ] Update workspace name
  - [ ] Delete workspace

- [ ] **Document Processing**
  - [ ] Create chatflow with document store node
  - [ ] Upload document
  - [ ] Click "Process" → verify chunks appear
  - [ ] Click "Upsert" → verify vector DB write
  - [ ] Run a query → verify semantic results

- [ ] **Evaluations with Real LLM**
  - [ ] Create dataset with 3+ rows
  - [ ] Run evaluation
  - [ ] Verify `actualOutput` contains real LLM response (not placeholder)
  - [ ] Verify `passPcnt` is calculated correctly (not hardcoded 100%)

- [ ] **RBAC Permissions**
  - [ ] Login as `viewer` role
  - [ ] Verify "Invite User" button is disabled/hidden
  - [ ] Verify certain endpoints return 403
  - [ ] Login as `admin` role
  - [ ] Verify full access

### Phase 2: Medium Features

- [ ] **Marketplace Templates**
  - [ ] Navigate to `/marketplace`
  - [ ] Click "Use Template" on a prebuilt template
  - [ ] Verify new flow is created in canvas
  - [ ] Verify nodes match template structure

- [ ] **Assistant Instruction Generation**
  - [ ] Create custom assistant
  - [ ] Enter a prompt in instruction field
  - [ ] Click "Generate with AI"
  - [ ] Verify instruction is generated (not echoed)

- [ ] **SSO Configuration**
  - [ ] Navigate to `/sso-config`
  - [ ] Add OAuth2 provider config
  - [ ] Click "Test Configuration"
  - [ ] Verify OIDC discovery validation

- [ ] **Login Activity Audit**
  - [ ] Navigate to `/login-activity`
  - [ ] Perform a login action
  - [ ] Verify login event appears in table
  - [ ] Filter by date range
  - [ ] Verify audit details are logged

### Phase 3: Testing & Build

- [ ] **Data-testid Attributes**
  - [ ] Open DevTools → Elements
  - [ ] Verify these attributes exist:
    - [ ] `[data-testid="chatflows-add-new"]`
    - [ ] `[data-testid="agentflows-add-new"]`
    - [ ] `[data-testid="evaluations-add-new"]`
    - [ ] `[data-testid="docstore-add-new"]`
    - [ ] `[data-testid="assistants-grid"]`
    - [ ] `[data-testid="api-code-dialog"]`

- [ ] **Vite Chunk Splitting**
  - [ ] Run `npm run build` in `frontend/ui`
  - [ ] Check bundle analysis
  - [ ] Verify chunks are split:
    - [ ] `mui-core.{hash}.js`
    - [ ] `react-flow.{hash}.js`
    - [ ] `tabler-icons.{hash}.js`

- [ ] **Audit Log Completeness**
  - [ ] Run PowerShell script: `audit_completeness_check.ps1`
  - [ ] Verify output includes flow lifecycle actions
  - [ ] Trigger actions and verify audit logs:
    - [ ] Publish flow → `flow.published`
    - [ ] Execute flow → `flow.executed`
    - [ ] Ingest documents → `ingestion.started`
    - [ ] Create evaluation → `evaluation.created`
    - [ ] Invite user → `user.invited`

---

## Database Verification

Query the database to verify implementations:

```sql
-- Check users table has new columns
SELECT id, email, role, last_login FROM users LIMIT 5;

-- Verify audit logs for all actions
SELECT DISTINCT action FROM audit_logs ORDER BY action;

-- Check workspace resources
SELECT id, name, resource_type FROM tenant_resources
WHERE resource_type = 'workspace' LIMIT 5;

-- Verify file uploads
SELECT id, name, resource_type FROM tenant_resources
WHERE resource_type = 'uploaded_file' LIMIT 5;

-- Check SSO configs
SELECT id, payload FROM tenant_resources
WHERE resource_type = 'sso_config' LIMIT 5;
```

---

## Performance Benchmarks

### Bundle Size (Before/After Chunk Splitting)

```bash
# Before optimization
npm run build -- --stats

# After optimization (should see smaller main.js)
npm run build -- --stats
```

### API Response Times

```bash
# Test endpoint response times
curl -w "Time: %{time_total}s\n" http://localhost:8000/api/users -H "Authorization: Bearer TOKEN"
curl -w "Time: %{time_total}s\n" http://localhost:8000/api/files -H "Authorization: Bearer TOKEN"
curl -w "Time: %{time_total}s\n" http://localhost:8000/api/workspaces -H "Authorization: Bearer TOKEN"
```

---

## Troubleshooting

### Backend Issues

**Error: "No such table: users"**
- Run migrations: `alembic upgrade head`

**Error: "Could not connect to Qdrant"**
- Verify Qdrant is running: `docker ps | grep qdrant`
- Check Qdrant health: `curl http://localhost:6333/health`

**Error: "Ollama not responding"**
- Verify Ollama is running: `docker ps | grep ollama`
- Check Ollama endpoint: `curl http://ollama:11434/api/tags`

### Frontend Issues

**Feature flag not enabled**
- Check localStorage: `localStorage.getItem('features')`
- Verify auth.js `DEFAULT_FEATURES` object

**data-testid attributes not found**
- Clear browser cache: Ctrl+Shift+Delete
- Rebuild: `npm run build`

**API calls failing with 401**
- Token may have expired
- Clear localStorage and re-login
- Check `Authorization` header format: `Bearer {token}`

---

## CI/CD Integration

Add to your GitHub Actions or GitLab CI:

```yaml
# Example: GitHub Actions
- name: Backend Integration Tests
  run: |
    python backend/tests/integration_test.py

- name: Audit Completeness Check
  run: |
    pwsh scripts/audit_completeness_check.ps1

- name: Frontend Integration Tests
  run: |
    cd frontend/ui && npx cypress run
```

---

## Test Result Interpretation

### Backend Integration Tests
- **Passed**: All CRUD operations working
- **Failed**: Check logs for specific endpoint failures
- **Cleanup**: Test resources automatically deleted

### Audit Completeness Check
- **All actions found**: Complete coverage ✓
- **Some actions missing**: May not be triggered in test scope ⚠
- **Status values**: approved/running/completed

### Frontend Tests
- **All testids present**: UI updates applied ✓
- **Feature flags enabled**: Screens visible ✓
- **Chunks loaded**: Vite splitting working ✓

---

## Next Steps

After verification:

1. **Deploy to staging** with full test suite
2. **Load testing** on critical endpoints
3. **User acceptance testing** with stakeholders
4. **Documentation** updates for new features
5. **Monitoring** setup for audit logs and errors

For questions or issues, check the implementation plan at: `<plan_file_path>`
