# End-to-End Testing Guide

Complete browser-based E2E testing for Vetrai Phase 1-3 implementations.

## 🚀 Quick Start

### 1. Install Playwright

```bash
cd frontend/ui
npm install -D @playwright/test
# or
yarn add -D @playwright/test
```

### 2. Run E2E Tests

```bash
# Run all tests
npx playwright test tests/e2e.spec.ts

# Run with UI mode (interactive)
npx playwright test --ui

# Run specific test
npx playwright test -g "Users Screen"

# Run in headed mode (see browser)
npx playwright test --headed

# Generate HTML report
npx playwright show-report
```

### 3. Prerequisites

Before running tests, ensure:
- ✅ Backend running on `http://localhost:8000`
- ✅ Frontend running on `http://localhost:3000`
- ✅ Database populated with test user
- ✅ Ollama/Qdrant running (for document/evaluation tests)

---

## 📋 Test Coverage

### 6 Major Screens Tested

1. **Users Screen** (3 workflows)
   - List all users
   - Invite new user
   - Edit user role
   - Delete user

2. **Files Screen** (3 workflows)
   - Upload file
   - List files
   - Delete file

3. **Workspace Screen** (3 workflows)
   - Create workspace
   - Switch workspace
   - Delete workspace

4. **Document Store** (2 workflows)
   - Create document store
   - Upload documents
   - Process documents

5. **Evaluations Screen** (1 workflow)
   - Create evaluation
   - Run evaluation
   - Verify real LLM outputs

6. **Marketplace** (1 workflow)
   - Browse templates
   - Use template → navigate to canvas

### Quality Assurance Tests

- ✅ RBAC permission enforcement
- ✅ Feature flag verification (all 4 enabled)
- ✅ Data-testid attribute presence
- ✅ Responsive design (mobile view)
- ✅ Error handling (404, network errors)
- ✅ Performance metrics (bundle size, load time)

---

## 🔧 Configuration

### Environment Variables

```bash
# .env.test or set in terminal
export TEST_BASE_URL=http://localhost:3000
export API_URL=http://localhost:8000/api
export TEST_TIMEOUT=30000
```

### Playwright Config (`playwright.config.ts`)

```typescript
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html'],
    ['json', { outputFile: 'test-results/results.json' }],
    ['junit', { outputFile: 'test-results/junit.xml' }]
  ],
  use: {
    baseURL: process.env.TEST_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry'
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI
  }
})
```

---

## ✅ Test Data Setup

### Required Test User

```sql
INSERT INTO users (id, tenant_id, email, password_hash, role, status)
VALUES (
  'test-user-id',
  '00000000-0000-0000-0000-000000000001',
  'e2e-test@vetrai.com',
  'hashed-password', -- hash of 'test-password-123'
  'admin',
  'active'
);
```

### Test Workspace (Optional)

```sql
INSERT INTO tenant_resources (id, tenant_id, resource_type, name, payload)
VALUES (
  'test-workspace-id',
  '00000000-0000-0000-0000-000000000001',
  'workspace',
  'E2E Test Workspace',
  '{"description": "Workspace for E2E testing"}'::jsonb
);
```

---

## 📊 Test Results Interpretation

### Pass Criteria
```
✓ Users: All CRUD operations complete
✓ Files: Upload, list, delete successful
✓ Workspace: Create, switch, delete working
✓ Marketplace: Template usage creates new flow
✓ Permissions: RBAC enforced correctly
✓ Features: All 4 flags enabled
✓ Selectors: All data-testid attributes present
✓ Performance: Load time < 5 seconds
✓ Responsive: Mobile view works
✓ Errors: Graceful error handling
```

### Common Failures

**"Page did not load"**
- Check backend is running: `curl http://localhost:8000/api/health/ready`
- Check frontend is running: `curl http://localhost:3000`

**"Button not found"**
- Button may be in different location or have different text
- Check page structure with `--headed` flag to see actual UI

**"Timeout waiting for response"**
- API may be slow or unresponsive
- Check backend logs: `docker logs vetrai-backend`

**"Permission denied"**
- Test user may not have required role
- Check user role in database

---

## 🎬 Recording & Debugging

### Video Recording

```bash
# Record videos of all tests
npx playwright test --record-video=on

# View recorded videos
npx playwright show-report
```

### Debug Mode

```bash
# Step through test with inspector
npx playwright test --debug

# Or use Playwright Inspector
PWDEBUG=1 npx playwright test tests/e2e.spec.ts
```

### Browser DevTools

```typescript
// Add to test to pause and open DevTools
await page.pause()
```

---

## 📈 CI/CD Integration

### GitHub Actions

```yaml
name: E2E Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
      redis:
        image: redis:7
      qdrant:
        image: qdrant/qdrant:latest
      ollama:
        image: ollama/ollama:latest

    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright browsers
        run: npx playwright install --with-deps

      - name: Start backend
        run: uvicorn backend.main:app --host 0.0.0.0 --port 8000 &

      - name: Start frontend
        run: npm run dev &

      - name: Wait for services
        run: sleep 10

      - name: Run E2E tests
        run: npx playwright test

      - name: Upload report
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 30
```

---

## 🔄 Continuous Improvement

### After First Run
1. Review HTML report: `npx playwright show-report`
2. Check for flaky tests (tests that sometimes fail)
3. Adjust timeouts if tests are timing out
4. Add more specific selectors if elements are hard to find

### Performance Benchmarks
```
Target load time: < 3 seconds (optimal)
Target load time: < 5 seconds (acceptable)
Target load time: > 5 seconds (investigate)
```

### Regular Maintenance
- Update selectors if UI changes
- Add new tests for new features
- Update test data as needed
- Review and optimize slow tests

---

## 🐛 Troubleshooting

### Tests Pass Locally but Fail in CI

**Cause:** Timing differences or missing services
**Solution:**
- Increase timeouts: `{ timeout: 30000 }`
- Add explicit waits: `await page.waitForFunction()`
- Check service health before tests start

### Flaky Tests (Pass/Fail Randomly)

**Cause:** Race conditions or unpredictable timing
**Solution:**
- Use explicit waits instead of `waitForTimeout`
- Increase timeout margins
- Add retry logic for critical operations

### Tests Can't Connect to Backend

**Cause:** Backend not running or port blocked
**Solution:**
```bash
# Check backend is running
curl http://localhost:8000/api/health/ready

# Check port is available
lsof -i :8000

# Start backend if needed
uvicorn backend.main:app --reload
```

### Permission Denied Errors

**Cause:** Test user doesn't have required role
**Solution:**
```sql
-- Check user role
SELECT id, email, role FROM users WHERE email = 'e2e-test@vetrai.com';

-- Update role to admin
UPDATE users SET role = 'admin'
WHERE email = 'e2e-test@vetrai.com';
```

---

## 📚 Resources

- [Playwright Documentation](https://playwright.dev)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [Test Configuration Reference](https://playwright.dev/docs/test-configuration)
- [Debugging Guide](https://playwright.dev/docs/debug)

---

## ✨ Next Steps

After E2E tests pass:
1. ✅ Verify all Phase 1-3 implementations work end-to-end
2. ✅ Add performance thresholds to CI gate
3. ✅ Integrate Deepseek LLM for evaluations (see DEEPSEEK.md)
4. ✅ Set up continuous testing in CI/CD
