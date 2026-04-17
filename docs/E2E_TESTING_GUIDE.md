# End-to-End Testing Guide for P0 Fixes

This guide covers comprehensive testing of all critical (P0) fixes implemented in the Vetrai platform.

## Quick Start

```bash
# Run all tests
chmod +x scripts/e2e-test-p0-fixes.sh
./scripts/e2e-test-p0-fixes.sh
```

---

## Test Coverage Map

| P0 Fix | Test Type | File | Status |
|--------|-----------|------|--------|
| Password Complexity | Unit | `backend/tests/test_p0_fixes.py::TestPasswordComplexity` | ✓ |
| Brute Force Protection | Unit | `backend/tests/test_p0_fixes.py::TestBruteForceProtection` | ✓ |
| API Key Encryption | Unit | `backend/tests/test_p0_fixes.py::TestAPIKeyEncryption` | ✓ |
| Credential Masking | Unit | `backend/tests/test_p0_fixes.py::TestCredentialMasking` | ✓ |
| Token JTI Claims | Unit | `backend/tests/test_p0_fixes.py::TestTokenClaims` | ✓ |
| Token Blacklist | Unit | `backend/tests/test_p0_fixes.py::TestTokenBlacklist` | ✓ |
| Database Schema | Unit | `backend/tests/test_p0_fixes.py::TestDatabaseSchema` | ✓ |
| Full Auth Flow | Unit | `backend/tests/test_p0_fixes.py::TestFullAuthFlow` | ✓ |
| **All above + API integration** | E2E | `scripts/e2e-test-p0-fixes.sh` | ✓ |

---

## Prerequisites

### Required
- Docker & Docker Compose
- Bash shell (or WSL on Windows)
- curl (for HTTP testing)
- Python 3.12+ (for unit tests)

### Optional
- pytest (for running unit tests directly)
- jq (for JSON parsing in test output)

---

## Running Unit Tests

### All P0 Tests
```bash
cd backend
python -m pytest tests/test_p0_fixes.py -v
```

### Specific Test Class
```bash
# Test password complexity only
python -m pytest tests/test_p0_fixes.py::TestPasswordComplexity -v

# Test brute force protection
python -m pytest tests/test_p0_fixes.py::TestBruteForceProtection -v

# Test API key encryption
python -m pytest tests/test_p0_fixes.py::TestAPIKeyEncryption -v
```

### With Coverage Report
```bash
python -m pytest tests/test_p0_fixes.py --cov=. --cov-report=html
```

---

## Running E2E Tests

### Prerequisites
Start the application stack:
```bash
docker-compose up -d
```

Wait for all services to be healthy:
```bash
docker-compose ps  # All should show "healthy"
```

### Run E2E Test Suite
```bash
chmod +x scripts/e2e-test-p0-fixes.sh
./scripts/e2e-test-p0-fixes.sh
```

### Expected Output
```
╔════════════════════════════════════════════════════════════╗
║     Vetrai P0 Fixes End-to-End Test Suite                 ║
╚════════════════════════════════════════════════════════════╝

[P0-1] Database Schema Alignment
▶ User can be created with full_name
✓ Full name persisted in user creation

[P0-2] Password Complexity Validation
▶ Weak password (too short) is rejected
✓ Short password rejected with validation error
...

╔════════════════════════════════════════════════════════════╗
║                      Test Results Summary                 ║
╚════════════════════════════════════════════════════════════╝
Passed: 24
Failed: 0
✓ All P0 fixes verified!
```

---

## Individual Test Scenarios

### [P0-1] Database Schema Alignment

**What's being tested:**
- User model accepts `full_name`, `is_active`, `updated_at`
- Flow model accepts `flow_type`, `updated_at`

**Manual verification:**
```bash
# Create a user with full_name
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "StrongPass123!",
    "tenant_id": "00000000-0000-0000-0000-000000000001",
    "full_name": "John Doe"
  }'

# Verify full_name in response
# Expected: {"full_name": "John Doe", ...}
```

---

### [P0-2] Password Complexity Validation

**What's being tested:**
- Minimum 8 characters
- At least one uppercase letter (A-Z)
- At least one lowercase letter (a-z)
- At least one digit (0-9)

**Manual tests:**
```bash
# ✗ Too short (5 chars)
curl -X POST http://localhost:8000/api/auth/register \
  -d '{"password": "Pass1"}'
# Expected: Error mentioning "8 characters"

# ✗ No uppercase
curl -X POST http://localhost:8000/api/auth/register \
  -d '{"password": "lowerpass123"}'
# Expected: Error mentioning "uppercase"

# ✗ No digit
curl -X POST http://localhost:8000/api/auth/register \
  -d '{"password": "PassWord"}'
# Expected: Error mentioning "digit" or "number"

# ✓ Valid
curl -X POST http://localhost:8000/api/auth/register \
  -d '{"password": "StrongPass123"}'
# Expected: 200 OK
```

---

### [P0-3] Brute Force Protection

**What's being tested:**
- Failed login counter incremented per (user, tenant) pair
- Account locked after 5 failed attempts
- Lockout duration: 15 minutes (900 seconds)

**Manual test:**
```bash
# Create test account
EMAIL="brute.test@example.com"
curl -X POST http://localhost:8000/api/auth/register \
  -d '{"email": "'$EMAIL'", "password": "ValidPass123!", "tenant_id": "..."}'

# Make 5 failed login attempts
for i in {1..5}; do
  curl -X POST http://localhost:8000/api/auth/token \
    -d '{"email": "'$EMAIL'", "password": "WrongPassword", "tenant_id": "..."}'
done

# 6th attempt (with correct password) should be locked
curl -X POST http://localhost:8000/api/auth/token \
  -d '{"email": "'$EMAIL'", "password": "ValidPass123!", "tenant_id": "..."}'
# Expected: 429 Too Many Requests OR error mentioning "locked"

# After 15 minutes, should work again (test by checking Redis key TTL)
redis-cli TTL "login_attempts:user_id:tenant_id"
# Expected: ~900 seconds
```

---

### [P0-4] Token Claims (JTI for Revocation)

**What's being tested:**
- New tokens include JTI (JSON Web Token ID) claim
- New tokens include IAT (Issued At) claim
- Tokens have expiry set

**Manual verification:**
```bash
# Obtain token
curl -X POST http://localhost:8000/api/auth/token \
  -d '{"email": "user@example.com", "password": "Pass123!", "tenant_id": "..."}'
# Extract access_token

# Decode token (third segment is payload)
TOKEN="eyJ..."
PAYLOAD=$(echo $TOKEN | cut -d'.' -f2 | base64 -d)
echo $PAYLOAD | jq .
# Expected: {"sub": "...", "jti": "...", "iat": 1234567890, "exp": 1234571490, ...}
```

---

### [P0-5] API Key Encryption (AES-256-GCM)

**What's being tested:**
- API keys generated with `prefix_xxxxxxxx` format
- Raw key returned only at creation (show-once pattern)
- Key hash stored, never raw key
- Subsequent fetches don't return raw key

**Manual test:**
```bash
# Get auth token first
TOKEN=$(curl -s -X POST http://localhost:8000/api/auth/token -d '...' | jq -r '.access_token')

# Create API key
curl -X POST http://localhost:8000/api/resources \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": "...",
    "resource_type": "api_key",
    "name": "My API Key",
    "metadata": {}
  }' | jq .
# Expected: {"raw_api_key": "sk_abc123xyz...", "id": "..."}
# IMPORTANT: Copy the raw_api_key value now — it won't be shown again

# Fetch the resource again
curl -X GET http://localhost:8000/api/resources/$RESOURCE_ID \
  -H "Authorization: Bearer $TOKEN" | jq .
# Expected: No "raw_api_key" field, only "key_prefix": "sk_abc123xx"
```

---

### [P0-6] Credential Masking

**What's being tested:**
- Credential payloads masked in responses (****xxxx pattern)
- Secrets not leaked in audit logs

**Manual test:**
```bash
# Create credential with secrets
curl -X POST http://localhost:8000/api/resources \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "resource_type": "credential",
    "payload": {
      "api_key": "sk-supersecret123",
      "password": "mypassword456"
    }
  }' | jq .
# Expected: {"payload": {"api_key": "****cret123", "password": "****word456"}, ...}

# Check audit log (if accessible)
curl -X GET http://localhost:8000/api/audit-logs?resource_id=... \
  -H "Authorization: Bearer $TOKEN" | jq '.items[0].details'
# Expected: payload NOT included or masked in details
```

---

### [P0-7] Frontend Client Bootstrap (No 422 on Page Load)

**What's being tested:**
- Frontend loads without triggering bootstrap 422 errors
- No repeated authentication token requests on page load

**Manual test:**
```bash
# Open browser console (F12 → Console tab)
# Navigate to http://localhost:3000

# Expected: No 422 POST /api/auth/token errors in Network tab
# Expected: Page loads successfully with or without localStorage token

# Verify in browser console:
# - If localStorage has 'vetrai_access_token', it should be used
# - If not, page should load empty state (not error)
```

---

### [P0-8] Nginx HTTPS Configuration

**What's being tested:**
- Production nginx config references `/etc/nginx/certs/` (not `/etc/ssl/certs/`)
- Cert paths match docker-compose.prod.yml volume mounts

**Manual verification:**
```bash
# Check nginx config
grep -n "ssl_certificate" nginx/nginx.prod.conf
# Expected output:
# 24:    ssl_certificate /etc/nginx/certs/fullchain.pem;
# 25:    ssl_certificate_key /etc/nginx/certs/privkey.pem;

# Verify docker-compose volume mount
grep -A3 "volumes:" docker-compose.prod.yml | grep certs
# Expected: - ./nginx/certs:/etc/nginx/certs:ro
```

---

### [P0-9] Token Blacklist & Logout

**What's being tested:**
- Tokens added to Redis blacklist on logout
- Blacklisted tokens rejected on verification
- Blacklist TTL respects token expiry

**Manual test:**
```bash
# Get token
TOKEN=$(curl -s -X POST http://localhost:8000/api/auth/token -d '...' | jq -r '.access_token')

# Verify token works
curl -X GET http://localhost:8000/api/auth/verify \
  -H "Authorization: Bearer $TOKEN" | jq .
# Expected: {"email": "user@example.com", ...}

# Logout (revoke token)
curl -X POST http://localhost:8000/api/auth/logout \
  -H "Authorization: Bearer $TOKEN" | jq .

# Try to use token again
curl -X GET http://localhost:8000/api/auth/verify \
  -H "Authorization: Bearer $TOKEN" | jq .
# Expected: 401 Unauthorized or error

# Check Redis (if accessible)
redis-cli GET "blacklist:$JTI"
# Expected: "1" (token is in blacklist)
```

---

## Automated Full Test Suite

The `e2e-test-p0-fixes.sh` script runs all scenarios above automatically:

```bash
./scripts/e2e-test-p0-fixes.sh

# Sample output:
# ▶ User can be created with full_name
# ✓ Full name persisted in user creation
# ▶ Weak password (too short) is rejected
# ✓ Short password rejected with validation error
# ▶ Weak password (no uppercase) is rejected
# ✓ Password without uppercase rejected
# ...
# ✓ All P0 fixes verified!
```

---

## Troubleshooting

### Services not ready
```bash
# Check service health
docker-compose ps

# View logs
docker-compose logs backend
docker-compose logs postgres
docker-compose logs redis
```

### Tests failing with connection errors
```bash
# Ensure backend is healthy
curl http://localhost:8000/api/health

# Check database connectivity
docker-compose exec postgres pg_isready -U admin

# Check Redis
docker-compose exec redis redis-cli ping
# Expected: PONG
```

### Token decode failing
```bash
# Install jq for JSON parsing
# macOS: brew install jq
# Ubuntu: apt-get install jq
# Windows: Download from https://stedolan.github.io/jq/download/
```

### API key test failing
```bash
# Verify PAYLOAD_ENCRYPTION_KEY is set
docker-compose exec backend env | grep PAYLOAD_ENCRYPTION_KEY
# Should show: PAYLOAD_ENCRYPTION_KEY=<long-base64-string>
```

---

## Performance Baselines

Expected test completion times:

| Test Type | Duration | Notes |
|-----------|----------|-------|
| Unit tests (all) | 5-10s | No external services |
| E2E tests (full) | 30-60s | Includes service startup |
| Single API call | 100-500ms | Network + processing |
| Token generation | 10-50ms | Crypto operation |
| Database query | 50-200ms | Including network |

---

## Continuous Integration

To integrate with CI/CD:

```yaml
# GitHub Actions example
- name: Run P0 Unit Tests
  run: |
    cd backend
    python -m pytest tests/test_p0_fixes.py -v --tb=short

- name: Run E2E Tests
  run: |
    docker-compose up -d
    sleep 30  # Wait for services
    ./scripts/e2e-test-p0-fixes.sh
```

---

## Post-Testing Checklist

- [ ] All 9 P0 fixes verified
- [ ] Unit tests passing (backend/tests/test_p0_fixes.py)
- [ ] E2E script completed successfully
- [ ] No unexpected errors in application logs
- [ ] Database migrations applied
- [ ] Redis running and responsive
- [ ] Frontend loads without 422 errors
- [ ] HTTPS certs path correct (for production)

---

## Next Steps

Once all P0 tests pass:

1. **Deploy to staging** - Run same test suite in staging environment
2. **Test P1 issues** - Address high-priority (52 items) quality improvements
3. **Load testing** - Verify rate limiting under concurrent load
4. **Security audit** - External penetration test
5. **Production deployment** - Roll out to production

---

## Support

For test failures, check:
1. Application logs: `docker-compose logs -f backend`
2. Database state: `docker-compose exec postgres psql -U admin -c "\dt"`
3. Redis state: `docker-compose exec redis redis-cli INFO`
4. Env vars: `docker-compose config | grep PAYLOAD_ENCRYPTION_KEY`

---

**Last Updated:** 2026-04-17  
**Test Suite Version:** 1.0  
**Coverage:** 9 P0 fixes across 8 test classes + E2E scenarios
