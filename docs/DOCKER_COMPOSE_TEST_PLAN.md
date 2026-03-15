# Docker Compose Integration Test Plan

**Purpose:** Verify backend/frontend synchronization in Docker environment
**Status:** Ready for Testing
**Date:** 2026-03-15

---

## Pre-Test Checklist

### Environment Verification
- [ ] `.env` file exists with all required variables
- [ ] Docker daemon running: `docker ps`
- [ ] Docker Compose available: `docker compose version`
- [ ] Sufficient disk space: `df -h` (>10GB recommended)
- [ ] Ports available: 80, 443, 3000, 8000, 5432, 6379, 6333, 11434

### Configuration Check
```bash
# Verify required environment variables
grep -E "JWT_SECRET|POSTGRES_PASSWORD|REDIS_HOST" .env

# Expected output:
# JWT_SECRET=your_super_secret_jwt_key...
# POSTGRES_PASSWORD=password
# REDIS_HOST=redis
```

---

## Test Execution

### Phase 1: Service Startup (5 minutes)

#### Step 1: Build Images
```bash
cd /path/to/vetrai
docker compose build
# Expected: All services build successfully
```

#### Step 2: Start Services
```bash
docker compose up -d
# Expected: All services start

# Verify startup
docker compose ps
# Expected output:
# NAME                 STATUS              PORTS
# vetrai-nginx-1       Up (healthy)        0.0.0.0:80->80/tcp
# vetrai-frontend-1    Up (healthy)        3000/tcp
# vetrai-backend-1     Up (healthy)        8000/tcp
# vetrai-postgres-1    Up (healthy)        5432/tcp
# vetrai-redis-1       Up (healthy)        6379/tcp
# vetrai-qdrant-1      Up (healthy)        6333/tcp
# vetrai-ollama-1      Up (healthy)        11434/tcp
```

#### Step 3: Health Checks
```bash
# Frontend health
curl -v http://localhost
# Expected: Status 200, HTML response

# Backend health
curl -v http://localhost/api/health
# Expected: Status 200, {"status": "ok"}

# Check logs for errors
docker compose logs -f --tail=20
```

---

### Phase 2: Authentication Flow (5 minutes)

#### Test 2.1: Login
```bash
# Get token
curl -X POST http://localhost/api/auth/token \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@vetrai.com",
    "password": "your_password",
    "tenant_id": "00000000-0000-0000-0000-000000000001"
  }'

# Expected response:
# {
#   "access_token": "eyJhbGc...",
#   "token_type": "bearer"
# }

TOKEN="<access_token_from_above>"
```

#### Test 2.2: Verify Token
```bash
curl -X GET http://localhost/api/auth/me \
  -H "Authorization: Bearer $TOKEN"

# Expected response:
# {
#   "email": "admin@vetrai.com",
#   "tenant_id": "...",
#   "role": "admin",
#   "features": {...}
# }
```

#### Test 2.3: Logout
```bash
curl -X POST http://localhost/api/auth/logout \
  -H "Authorization: Bearer $TOKEN"

# Expected response:
# {
#   "message": "Logged out successfully. Token has been revoked."
# }
```

#### Test 2.4: Verify Token Revoked
```bash
# Try to use revoked token
curl -X GET http://localhost/api/auth/me \
  -H "Authorization: Bearer $TOKEN"

# Expected: Status 401
# Response: {
#   "detail": "Token has been revoked"
# }
```

---

### Phase 3: Frontend Integration (5 minutes)

#### Test 3.1: Access Frontend
```bash
# Open browser or use curl
curl http://localhost

# Expected:
# - Page loads
# - No 500 errors
# - API base URL correctly configured
```

#### Test 3.2: Login via UI (Manual)
1. Navigate to http://localhost
2. Enter credentials:
   - Email: `admin@vetrai.com`
   - Password: (check DB seed)
   - Tenant: `00000000-0000-0000-0000-000000000001`
3. Click Login
4. Verify:
   - Token stored in localStorage
   - Redirected to dashboard
   - User menu shows email

#### Test 3.3: Logout via UI (Manual)
1. Click user menu
2. Select Logout
3. Verify:
   - Redirected to login page
   - Token removed from localStorage
   - Cannot access protected pages

---

### Phase 4: API Synchronization (10 minutes)

#### Test 4.1: User Management
```bash
TOKEN="<valid_token>"

# Get users list
curl -X GET http://localhost/api/users/ \
  -H "Authorization: Bearer $TOKEN"

# Expected: 200, list of users
# [{"id": "...", "email": "...", "role": "...", ...}]
```

#### Test 4.2: Workspace Operations
```bash
# List workspaces
curl -X GET http://localhost/api/workspace/ \
  -H "Authorization: Bearer $TOKEN"

# Expected: 200, list of workspaces
# {"items": [...], "total": 1, ...}
```

#### Test 4.3: Flow Management
```bash
# List flows
curl -X GET http://localhost/api/flows/ \
  -H "Authorization: Bearer $TOKEN"

# Expected: 200, list of flows
```

#### Test 4.4: Permissions Check
```bash
# Get user permissions
curl -X GET http://localhost/api/auth/me \
  -H "Authorization: Bearer $TOKEN" | jq '.permissions'

# Expected: Array of permission strings
# ["chatflows:view", "chatflows:create", ...]
```

---

### Phase 5: Error Handling (5 minutes)

#### Test 5.1: Invalid Token
```bash
curl -X GET http://localhost/api/users/ \
  -H "Authorization: Bearer invalid.token.here"

# Expected: 401
# Response: {"detail": "Invalid token"}
```

#### Test 5.2: Missing Token
```bash
curl -X GET http://localhost/api/users/

# Expected: 401
# Response: {"detail": "Missing auth token"}
```

#### Test 5.3: Insufficient Permissions
```bash
# Login as viewer (non-admin)
TOKEN_VIEWER="<viewer_token>"

curl -X POST http://localhost/api/users/ \
  -H "Authorization: Bearer $TOKEN_VIEWER" \
  -H "Content-Type: application/json" \
  -d '{"email": "new@example.com", "role": "editor"}'

# Expected: 403
# Response: {"detail": "Permission denied"}
```

---

### Phase 6: Feature Flags (5 minutes)

#### Test 6.1: Check Enabled Features
```bash
TOKEN="<valid_token>"

curl -X GET http://localhost/api/auth/me \
  -H "Authorization: Bearer $TOKEN" | jq '.features'

# Expected: Feature flags object
# {
#   "feat:files": true,
#   "feat:sso-config": true,
#   "feat:roles": true,
#   "feat:login-activity": true,
#   ...
# }
```

#### Test 6.2: Verify Frontend Uses Flags
1. Check localStorage: `localStorage.getItem('vetrai_features')`
2. Verify it matches `/api/auth/me` response
3. Check UI shows only enabled features

---

### Phase 7: Workspace Isolation (5 minutes)

#### Test 7.1: Create Workspace
```bash
TOKEN="<valid_token>"

curl -X POST http://localhost/api/workspace/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Workspace", "description": "For testing"}'

# Expected: 200 or 201
# Response: {"id": "...", "name": "Test Workspace", ...}

WS_ID="<workspace_id>"
```

#### Test 7.2: Switch Workspace
```bash
curl -X POST http://localhost/api/workspace/switch \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"workspace_id": "'$WS_ID'"}'

# Expected: 200
# Response: {"message": "Workspace switched successfully"}
```

#### Test 7.3: Verify Isolation
```bash
# Create resource in workspace 1
curl -X POST http://localhost/api/resources/credential \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Cred", "payload": {"key": "value"}}'

# List should show resources from current workspace only
curl -X GET http://localhost/api/resources/credential \
  -H "Authorization: Bearer $TOKEN"
```

---

## Sync-Specific Tests

### Test 8.1: Token Cleanup on Invalid Response
```bash
# Use revoked token
curl -X GET http://localhost/api/users/ \
  -H "Authorization: Bearer <revoked_token>"

# Expected: 401 response

# In browser: Verify localStorage token is cleared
# Run: localStorage.getItem('vetrai_access_token')
# Should be: null (after 401 response)
```

### Test 8.2: API Response Format Consistency
```bash
# Test different endpoints for consistent response format

# Paginated response
curl -X GET "http://localhost/api/users/?limit=10&offset=0" \
  -H "Authorization: Bearer $TOKEN" | jq '.'
# Expected: {items: [...], total: ..., limit: ..., offset: ...}

# Single resource
curl -X GET http://localhost/api/workspace/$WS_ID \
  -H "Authorization: Bearer $TOKEN" | jq '.'
# Expected: {id: ..., name: ..., ...}

# Error response
curl -X GET http://localhost/api/nonexistent \
  -H "Authorization: Bearer $TOKEN" | jq '.'
# Expected: {detail: "..."}
```

---

## Performance Tests (Optional)

### Test 9.1: Response Time
```bash
# Measure backend response time
time curl -s http://localhost/api/health > /dev/null

# Expected: < 500ms
```

### Test 9.2: Load Test (requires `ab` or `wrk`)
```bash
# Apache Bench test
ab -n 100 -c 10 -H "Authorization: Bearer $TOKEN" \
  http://localhost/api/users/

# Expected: All requests succeed
```

---

## Cleanup

### Stop Services
```bash
docker compose down
# All services stopped

# Optional: Remove volumes (clears database)
docker compose down -v
```

### View Logs (if needed)
```bash
# Backend logs
docker compose logs backend

# Frontend logs
docker compose logs frontend

# All logs
docker compose logs -f
```

---

## Expected Results Summary

| Test | Expected Result | Status |
|------|-----------------|--------|
| Services start | All healthy | ✅ |
| Frontend loads | HTTP 200 | ✅ |
| Backend responds | HTTP 200 | ✅ |
| Login works | Token received | ✅ |
| Logout works | Token revoked | ✅ |
| Token validation | 401 on revoked | ✅ |
| API sync | All endpoints work | ✅ |
| Permissions | Enforced correctly | ✅ |
| Feature flags | Loaded from backend | ✅ |
| Error handling | Proper HTTP codes | ✅ |

---

## Troubleshooting

### Service Won't Start
```bash
# Check logs
docker compose logs <service_name>

# Check ports are available
netstat -an | grep LISTEN

# Rebuild
docker compose down -v
docker compose build --no-cache
docker compose up
```

### Backend 500 Error
```bash
# Check database
docker compose exec postgres psql -U admin -d ai_platform -c "SELECT version();"

# Check Redis
docker compose exec redis redis-cli ping

# View backend logs
docker compose logs backend -f
```

### Frontend Not Connecting to Backend
```bash
# Check API URL
# In browser console:
console.log(import.meta.env.VITE_API_BASE_URL)

# Check network requests
# DevTools → Network tab → look for /api/... calls
```

### Token Issues
```bash
# Check token format
curl -X GET http://localhost/api/auth/me \
  -H "Authorization: Bearer <token>" -v

# Check token expiration
# Decode JWT at jwt.io
```

---

## Success Criteria

✅ **All Tests Pass:**
- [ ] All services start and are healthy
- [ ] Authentication flow works (login, token validation, logout)
- [ ] Frontend connects to backend
- [ ] All API endpoints respond correctly
- [ ] Permissions are enforced
- [ ] Feature flags work
- [ ] Error handling is correct
- [ ] Workspace isolation works
- [ ] Token cleanup happens on 401
- [ ] Response formats are consistent

**If all tests pass:** Backend/Frontend sync is verified and working correctly ✅

---

## Next Steps After Testing

1. **If tests pass:**
   - Deployment ready
   - Document any environment-specific notes
   - Set up monitoring/logging

2. **If tests fail:**
   - Check error messages in logs
   - Verify configuration
   - Check network connectivity
   - Review sync analysis for known issues

---

**Generated:** 2026-03-15
**For:** Vetrai Application Docker Compose Integration Testing
