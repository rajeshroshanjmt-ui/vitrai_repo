# Test Coverage Analysis - Vetrai Application

**Status:** 9/15 backend modules have tests (60%)
**Total Test Code:** 3,790 lines across 9 test files
**Gap:** 6 modules need comprehensive integration tests

---

## Current Test Coverage

### ✅ Modules WITH Tests (60%)

| Module | Test File | Type | Lines |
|--------|-----------|------|-------|
| **auth.py** | test_auth.py + test_auth_http.py | Unit + Integration | 200+ |
| **flows.py** | test_flows.py + test_flows_http.py | Unit + Integration | 700+ |
| **agent_guardrails.py** | test_agent_guardrails.py + _http.py | Unit + Integration | 1,100+ |
| **platform_compat.py** | test_platform_compat_http.py | Integration | 150+ |
| **workspace_isolation** | test_workspace_isolation.py | Integration | 200+ |
| **critical_modules** | test_critical_modules.py | Skeleton (needs work) | 450+ |

**Test Code Total:** 3,790 lines

### ❌ Modules WITHOUT Tests (40%)

| Module | Purpose | Test Gap | Priority |
|--------|---------|----------|----------|
| **users.py** | User CRUD, invitations, password reset | High | 🔴 Critical |
| **permissions.py** | Role/permission management | High | 🔴 Critical |
| **workspace.py** | Workspace CRUD, switching | High | 🔴 Critical |
| **files.py** | File management, uploads | Medium | 🟡 Medium |
| **resources.py** | Resource CRUD (credentials, variables, etc.) | Medium | 🟡 Medium |
| **email_service.py** | Email sending (SMTP, etc.) | Low | 🟢 Low |

---

## What Needs to Be Done

### Gap #1: users.py - User Management ✋ CRITICAL

**Current Status:** No dedicated tests
**What's Missing:**
- User registration validation
- User list/filter endpoints
- User update with permission changes
- User deletion (cascade checks)
- CSV export functionality
- Invitation email sending
- Password reset flow
- User workspace assignments

**Test Cases Needed (12-15):**
```python
test_register_user_valid_email()
test_register_duplicate_email_returns_409()
test_list_users_returns_tenant_users_only()
test_update_user_role()
test_delete_user_cascade_cleanup()
test_invite_user_sends_email()
test_resend_invitation_email()
test_csv_export_includes_all_fields()
test_user_cannot_assign_system_role()
test_set_user_active_workspace()
test_password_reset_token_lifecycle()
test_list_user_workspaces()
```

### Gap #2: permissions.py - Role & Permission Management ✋ CRITICAL

**Current Status:** No dedicated tests
**What's Missing:**
- Role creation/update/delete
- System role immutability
- Permission assignment
- Permission enforcement on operations
- Role hierarchy validation
- Edge cases (last admin, etc.)

**Test Cases Needed (12-15):**
```python
test_create_custom_role()
test_system_roles_are_immutable()
test_cannot_delete_last_admin()
test_assign_permission_to_role()
test_remove_permission_from_role()
test_user_with_role_has_permissions()
test_permission_check_on_endpoint()
test_delete_role_revokes_permissions()
test_role_name_editing_works()
test_permission_list_pagination()
test_role_export_includes_metadata()
test_permission_conflict_handling()
```

### Gap #3: workspace.py - Workspace Management ✋ CRITICAL

**Current Status:** Partial coverage in test_workspace_isolation.py
**What's Missing:**
- Workspace CRUD operations
- User-workspace associations
- Workspace deletion constraints
- Workspace switching
- User list per workspace
- Workspace update operations

**Test Cases Needed (12-15):**
```python
test_create_workspace_returns_id()
test_cannot_duplicate_workspace_name()
test_update_workspace_metadata()
test_delete_workspace_with_users_returns_error()
test_switch_workspace_updates_preference()
test_cannot_switch_to_workspace_without_access()
test_list_users_in_workspace()
test_add_user_to_workspace()
test_remove_user_from_workspace()
test_user_cannot_access_deleted_workspace()
test_workspace_resources_visible_in_context()
test_workspace_isolation_enforced_on_flows()
test_workspace_isolation_enforced_on_resources()
```

### Gap #4: files.py - File Management 🟡 MEDIUM

**Current Status:** No dedicated tests
**What's Missing:**
- File upload handling
- File validation
- File deletion
- Workspace-scoped access
- File type support
- File metadata retrieval

**Test Cases Needed (10-12):**
```python
test_file_upload_succeeds()
test_file_upload_validates_type()
test_file_upload_validates_size()
test_file_deletion_removes_metadata()
test_file_belongs_to_workspace()
test_cross_workspace_access_denied()
test_list_files_in_workspace()
test_file_metadata_retrieval()
test_file_update_metadata()
test_upload_large_file_returns_413()
```

### Gap #5: resources.py - Resource Management 🟡 MEDIUM

**Current Status:** Partial coverage in test_workspace_isolation.py
**What's Missing:**
- Resource CRUD for all types
- Resource type validation
- Credential encryption/decryption
- Resource filtering by workspace
- Resource permission checks

**Test Cases Needed (12-15):**
```python
test_create_credential_resource()
test_create_variable_resource()
test_create_tool_resource()
test_create_dataset_resource()
test_get_single_resource()
test_list_resources_filtered_by_workspace()
test_update_resource_payload()
test_delete_resource()
test_credential_values_encrypted()
test_variable_values_accessible()
test_cross_workspace_resource_access_denied()
test_resource_type_validation()
```

### Gap #6: email_service.py - Email Delivery 🟢 LOW

**Current Status:** No dedicated tests
**What's Missing:**
- Email sending logic
- SMTP connection handling
- Fallback to stdout
- Email template rendering
- Error handling

**Test Cases Needed (5-8):**
```python
test_send_email_via_smtp()
test_send_email_fallback_to_stdout()
test_smtp_connection_error_handling()
test_invitation_email_template()
test_password_reset_email_template()
test_email_service_configuration()
```

---

## Test Implementation Strategy

### Phase 1: Critical Modules (Users, Permissions, Workspace)
**Effort:** 4-5 hours
**Approach:**
1. Convert test_critical_modules.py skeleton into real tests
2. Add actual database operations (not just mocks)
3. Test permission enforcement
4. Test workspace isolation

**Expected Result:** 35-40 test cases

### Phase 2: Secondary Modules (Files, Resources)
**Effort:** 2-3 hours
**Approach:**
1. Create test_files.py
2. Create test_resources_advanced.py (extends current tests)
3. Add integration tests

**Expected Result:** 25-30 test cases

### Phase 3: Optional (Email Service)
**Effort:** 1-2 hours
**Approach:**
1. Mock SMTP server
2. Test email sending
3. Test fallback behavior

**Expected Result:** 6-8 test cases

### Total Effort: 7-10 hours

---

## Test Environment Setup

### Requirements (Already Installed)
- pytest or unittest
- FastAPI TestClient
- Mock libraries
- SQLAlchemy test utilities

### Database for Tests
```python
# Option 1: In-memory SQLite
DATABASE_URL = "sqlite:///:memory:"

# Option 2: Test PostgreSQL database
DATABASE_URL = "postgresql://user:pass@localhost/test_vetrai"

# Option 3: Docker test container
docker run -d -e POSTGRES_PASSWORD=test -p 5433:5432 postgres:15
```

### Mocking Strategy
- ✅ Mock external services (email, Redis, etc.)
- ✅ Use real database with rollback
- ✅ Use TestClient for HTTP testing
- ✅ Use fixtures for setup/teardown

### Coverage Target
- Critical modules: 85%+ coverage
- Secondary modules: 70%+ coverage
- Overall backend: 65%+ coverage

---

## Test Execution

### Run All Tests
```bash
cd backend
pytest tests/ -v --cov=. --cov-report=html
```

### Run Specific Module Tests
```bash
pytest tests/test_users.py -v
pytest tests/test_permissions.py -v
pytest tests/test_workspace.py -v
```

### Run with Coverage
```bash
pytest tests/ --cov=users --cov=permissions --cov=workspace --cov=files --cov=resources
```

### Run Before Deployment
```bash
pytest tests/ -v --tb=short
```

---

## CI/CD Integration

### GitHub Actions Workflow
```yaml
name: Backend Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: test
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-python@v4
        with:
          python-version: '3.11'
      - run: pip install -r backend/requirements.txt pytest pytest-cov
      - run: pytest backend/tests/ -v --cov --cov-report=xml
      - uses: codecov/codecov-action@v3
        with:
          files: ./coverage.xml
```

---

## Success Criteria

### After Implementation
- [ ] All 6 modules have test coverage
- [ ] 65%+ overall backend coverage
- [ ] 85%+ critical module coverage (users, permissions, workspace)
- [ ] All tests pass in CI/CD
- [ ] No test flakiness (3+ runs pass)
- [ ] Documentation for test execution
- [ ] Coverage reports generated

### Quality Gates
- ✅ Coverage cannot decrease
- ✅ All tests pass before merge
- ✅ No test timeouts (>30s)
- ✅ Meaningful test names and docstrings

---

## Estimated Timeline

| Phase | Modules | Hours | Deliverable |
|-------|---------|-------|-------------|
| 1 | users, permissions, workspace | 4-5 | 35-40 tests, 85%+ coverage |
| 2 | files, resources | 2-3 | 25-30 tests, 70%+ coverage |
| 3 | email_service | 1-2 | 6-8 tests, optional |
| **Total** | **6 modules** | **7-10** | **67-78 tests, 65%+ coverage** |

---

## Files to Create/Modify

### New Test Files
- [ ] `backend/tests/test_users.py` (200-250 lines)
- [ ] `backend/tests/test_permissions.py` (200-250 lines)
- [ ] `backend/tests/test_workspace_advanced.py` (200-250 lines)
- [ ] `backend/tests/test_files.py` (150-200 lines)
- [ ] `backend/tests/test_resources_advanced.py` (150-200 lines)
- [ ] `backend/tests/test_email_service.py` (100-150 lines, optional)

### Modified Files
- [ ] `backend/tests/test_critical_modules.py` → Convert to real tests
- [ ] `backend/tests/conftest.py` → Add shared fixtures
- [ ] `backend/requirements.txt` → Add pytest, pytest-cov

### Documentation
- [ ] `docs/TESTING_GUIDE.md` → Update with new tests
- [ ] `docs/TESTING_CHECKLIST.md` → Pre-deployment checklist

---

## Next Steps

1. **Prioritize:** Start with users.py, permissions.py, workspace.py (critical path)
2. **Create Test Database:** Set up test PostgreSQL or SQLite
3. **Implement Phase 1:** 4-5 hours for critical modules
4. **Run Coverage Report:** Target 65%+ overall
5. **Implement Phase 2:** 2-3 hours for secondary modules
6. **CI/CD Integration:** Set up automated testing
7. **Documentation:** Update testing guides

---

## References

### Test Structure Examples
- `backend/tests/test_flows.py` - Integration test example
- `backend/tests/test_workspace_isolation.py` - Workspace test example
- `backend/tests/test_auth.py` - Auth test example

### Framework Docs
- [pytest Documentation](https://docs.pytest.org/)
- [FastAPI Testing](https://fastapi.tiangolo.com/advanced/testing-databases/)
- [SQLAlchemy Testing](https://docs.sqlalchemy.org/en/20/core/testing.html)

---

## Conclusion

The application is **97% feature-complete** but needs **comprehensive test coverage** for:
- Regression prevention
- Deployment confidence
- CI/CD gating
- Production readiness

**Estimated effort: 7-10 hours for full 65%+ coverage**

**Recommendation:** Implement Phase 1 (critical modules) before production deployment.
