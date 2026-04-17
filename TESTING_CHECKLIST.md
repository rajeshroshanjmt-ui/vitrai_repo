# P0 Fixes Testing Checklist

Quick reference for verifying all critical (P0) fixes.

## Quick Start (5 minutes)

```bash
# 1. Start services
docker-compose up -d
sleep 15  # Wait for services to be ready

# 2. Run E2E test suite
chmod +x scripts/e2e-test-p0-fixes.sh
./scripts/e2e-test-p0-fixes.sh

# 3. Check result
# Expected: "✓ All P0 fixes verified!" with Passed: 24, Failed: 0
```

---

## What's Being Tested

### 1. **Database Schema** ✓
- User model: `full_name`, `is_active`, `updated_at`
- Flow model: `flow_type`, `updated_at`  
- Migration applied to Postgres
- **Test:** E2E creates user with full_name, verifies in response

### 2. **Password Complexity** ✓
- Minimum 8 characters required
- Must include uppercase (A-Z)
- Must include lowercase (a-z)
- Must include digit (0-9)
- **Test:** E2E rejects weak passwords, accepts strong ones

### 3. **Brute Force Protection** ✓
- 5 failed login attempts trigger lockout
- Lockout duration: 15 minutes (900 seconds)
- Counter stored in Redis
- **Test:** E2E makes 5 failed attempts, verifies 6th is locked

### 4. **API Key Encryption (AES-256-GCM)** ✓
- Keys encrypted with random nonce
- Raw key shown only at creation (show-once pattern)
- Subsequent fetches show only hash/prefix
- **Test:** E2E creates key, verifies no raw value on fetch

### 5. **Credential Masking** ✓
- Sensitive payloads masked as `****xxxx` in responses
- Secrets not leaked in audit logs
- Security resource types: credential, api_key
- **Test:** E2E creates credential, verifies masking

### 6. **Token Claims (JTI)** ✓
- New tokens include JTI claim (for revocation tracking)
- All tokens include IAT (issued at) and EXP claims
- Optional backward compatibility for legacy tokens
- **Test:** Unit test decodes token, verifies claims

### 7. **Token Blacklist & Logout** ✓
- Redis-backed token revocation
- Logout adds token JTI to blacklist
- Subsequent requests with blacklisted token rejected
- **Test:** E2E logs out, verifies token invalid

### 8. **Frontend Bootstrap Fix** ✓
- No 422 errors on page load
- Removed async bootstrap token generation
- localStorage token used if present
- **Test:** E2E navigates frontend, verifies no 422

### 9. **Nginx HTTPS Cert Paths** ✓
- Production config uses `/etc/nginx/certs/` (not `/etc/ssl/certs/`)
- Matches docker-compose.prod.yml volume mounts
- **Test:** Unit test verifies nginx.prod.conf path

---

## Test Files

| File | Type | Tests | Run |
|------|------|-------|-----|
| `scripts/e2e-test-p0-fixes.sh` | E2E | All 9 fixes | `./scripts/e2e-test-p0-fixes.sh` |
| `backend/tests/test_p0_fixes.py` | Unit | 8 test classes | `pytest backend/tests/test_p0_fixes.py -v` |
| `docs/E2E_TESTING_GUIDE.md` | Doc | Manual steps | Read for details |

---

## Running Tests

### Option 1: Automated E2E (Recommended)
```bash
chmod +x scripts/e2e-test-p0-fixes.sh
./scripts/e2e-test-p0-fixes.sh
```
**Expected:** All tests pass (24 passed, 0 failed)  
**Duration:** ~30-60 seconds

### Option 2: Unit Tests Only
```bash
cd backend
python -m pytest tests/test_p0_fixes.py -v
```
**Expected:** All test classes pass  
**Duration:** ~5-10 seconds

### Option 3: Manual Testing
See `docs/E2E_TESTING_GUIDE.md` for curl examples and manual verification steps for each fix.

---

## Pre-Test Checklist

- [ ] Docker installed: `docker --version`
- [ ] Docker Compose installed: `docker-compose --version`
- [ ] Git repo is clean: `git status` (no uncommitted changes)
- [ ] Backend requirements installed: `pip install -r backend/requirements.txt` (if running tests locally)
- [ ] Current directory: `c:\Users\LENOVO\Rajesh\vetrai`

---

## Test Execution

### Step 1: Start Services (2 min)
```bash
docker-compose up -d
```

Check service health:
```bash
docker-compose ps
# All services should show "healthy" or "running"
```

If services not healthy, check logs:
```bash
docker-compose logs backend | tail -20
docker-compose logs postgres | tail -20
docker-compose logs redis | tail -20
```

### Step 2: Run E2E Suite (1 min)
```bash
./scripts/e2e-test-p0-fixes.sh
```

Watch for:
- ✓ Green check marks (pass)
- ✗ Red X marks (fail) — investigate

### Step 3: Review Results
```
✓ Passed: 24
✗ Failed: 0
✓ All P0 fixes verified!
```

---

## Troubleshooting

### Backend not starting
```bash
docker-compose logs backend
# Look for: "DATABASE_URL", "REDIS_HOST", "JWT_SECRET"
```

### 422 Unprocessable Entity in tests
```bash
# This indicates password validation is working
# Check test output — expected for weak password tests
```

### API tests timing out
```bash
# Services still starting
docker-compose ps  # Check "healthy" status
# Wait 30 seconds and retry
```

### Token verification failing
```bash
# Check Redis is running
docker-compose exec redis redis-cli ping
# Expected: PONG

# Check PAYLOAD_ENCRYPTION_KEY is set
docker-compose config | grep PAYLOAD_ENCRYPTION_KEY
```

---

## Pass Criteria

All tests PASS when:

✓ **E2E Test Suite**
- Passed: 24 or more
- Failed: 0
- All green check marks

✓ **Unit Tests** (optional)
- All test classes pass
- No import errors
- No assertion failures

✓ **No Critical Errors**
- No 500 Internal Server errors
- No database connection errors
- No Redis connection errors

---

## Success Indicators

After tests complete, verify:

```bash
# 1. Check application health
curl http://localhost:8000/api/health | jq .
# Expected: {"status": "ok"}

# 2. Check database schema
docker-compose exec postgres psql -U admin -c "\d users" | grep full_name
# Expected: full_name | text |

# 3. Check Redis is running
docker-compose exec redis redis-cli INFO server | head -3
# Expected: Redis server info

# 4. Check frontend loads
curl http://localhost:3000 | head -5
# Expected: HTML with <html>, <head>, <body> tags
```

---

## Next Steps After Testing

Once all tests pass:

1. **Cleanup**
   ```bash
   docker-compose down  # Stop services
   ```

2. **Documentation**
   - Read `docs/E2E_TESTING_GUIDE.md` for detailed scenarios
   - Review changes in git: `git log --oneline -10`

3. **Staging Deployment**
   - Deploy to staging environment
   - Re-run full test suite in staging
   - Verify with real users

4. **Production Deployment**
   - Follow deployment guide in `docs/`
   - Apply database migrations
   - Monitor logs for errors

5. **P1 Issues** (High Priority)
   - 52 high-priority gaps identified in audit
   - Plan Phase 2 for addressing these

---

## Test Summary

| Fix | Unit | E2E | Status |
|-----|------|-----|--------|
| Database Schema | ✓ | ✓ | Ready |
| Password Complexity | ✓ | ✓ | Ready |
| Brute Force | ✓ | ✓ | Ready |
| API Key Encryption | ✓ | ✓ | Ready |
| Credential Masking | ✓ | ✓ | Ready |
| Token JTI | ✓ | ✓ | Ready |
| Token Blacklist | ✓ | ✓ | Ready |
| Frontend Bootstrap | ✗ | ✓ | Ready |
| Nginx HTTPS Paths | ✗ | ✓ | Ready |

---

## Support

**Issue with tests?**
1. Check logs: `docker-compose logs -f backend`
2. Read guide: `docs/E2E_TESTING_GUIDE.md`
3. Verify prerequisites: Docker, Docker Compose, bash

**All tests passing?**
→ P0 fixes verified! Ready for staging/production.

---

**Created:** 2026-04-17  
**Test Count:** 24 automated tests + 8 manual scenarios  
**Estimated Time:** 5 minutes (automated) / 30 minutes (manual)
