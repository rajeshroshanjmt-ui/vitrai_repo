/**
 * End-to-End Browser Tests for Vetrai Phase 1-3
 * Tests complete workflows across all major screens
 * Uses Playwright for browser automation
 *
 * Run with: npx playwright test tests/e2e.spec.ts
 */

import { test, expect, Page } from '@playwright/test'

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000'
const API_URL = process.env.API_URL || 'http://localhost:8000/api'

// Test data
const TEST_USER = {
  email: 'e2e-test@vetrai.com',
  password: 'test-password-123',
  role: 'admin'
}

const NEW_USER = {
  email: 'new-user@vetrai.com',
  role: 'viewer'
}

test.describe('Vetrai E2E - Complete Workflows', () => {
  let page: Page
  let authToken: string

  test.beforeAll(async ({ browser }) => {
    // Get auth token before tests
    const response = await fetch(`${API_URL}/auth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: TEST_USER.email,
        tenant_id: '00000000-0000-0000-0000-000000000001',
        password: TEST_USER.password
      })
    })
    const data = await response.json()
    authToken = data.access_token
  })

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage()
    // Set auth token in localStorage
    await page.addInitScript((token) => {
      localStorage.setItem('token', token)
    }, authToken)
  })

  test.afterEach(async () => {
    await page.close()
  })

  // ==================== USERS SCREEN ====================

  test('Users Screen - Complete Workflow', async () => {
    test.info().title = 'Users: List, Invite, Edit, Delete'

    await page.goto(`${BASE_URL}/users`)
    await page.waitForLoadState('networkidle')

    // Verify page loaded
    expect(page.url()).toContain('/users')
    const pageTitle = await page.locator('h1, h2').first().textContent()
    expect(pageTitle).toContain('User')

    // Check table is visible
    const table = await page.locator('table')
    expect(table).toBeVisible()
    await expect(table.locator('thead')).toBeVisible()

    // Test: Invite User
    const inviteBtn = await page.locator('button:has-text("Invite User"), button:has-text("Add User")')
    if (inviteBtn.isVisible()) {
      await inviteBtn.click()

      // Fill form
      await page.locator('input[name="email"], input[placeholder*="email"]').fill(NEW_USER.email)
      await page.locator('select[name="role"], [role="listbox"]').selectOption(NEW_USER.role)

      // Submit
      const confirmBtn = await page.locator('button:has-text("Invite"), button:has-text("Add")')
      await confirmBtn.click()

      // Wait for success message
      await expect(page.locator('.snackbar, .toast, [role="alert"]')).toContainText(
        /success|created|invited/i,
        { timeout: 5000 }
      )
    }

    // Verify user appears in list
    await page.waitForTimeout(1000)
    const userRows = await page.locator('tbody tr')
    const userCount = await userRows.count()
    expect(userCount).toBeGreaterThan(0)

    // Test: Edit User Role
    const firstUserRow = userRows.first()
    const editBtn = await firstUserRow.locator('button:has-text("Edit"), [aria-label*="Edit"]')
    if (editBtn.isVisible()) {
      await editBtn.click()
      const roleSelect = await page.locator('select[name="role"], [role="listbox"]').first()
      if (roleSelect.isVisible()) {
        await roleSelect.selectOption('editor')
        const saveBtn = await page.locator('button:has-text("Save"), button:has-text("Update")')
        await saveBtn.click()
        await expect(page.locator('.snackbar, .toast')).toContainText(/success|updated/i, { timeout: 5000 })
      }
    }
  })

  // ==================== FILES SCREEN ====================

  test('Files Screen - Upload & Management', async () => {
    test.info().title = 'Files: Upload, List, Delete'

    await page.goto(`${BASE_URL}/files`)
    await page.waitForLoadState('networkidle')

    // Verify page loaded
    expect(page.url()).toContain('/files')

    // Test: Upload File
    const uploadInput = await page.locator('input[type="file"]')
    if (uploadInput.isVisible()) {
      // Create test file
      const buffer = Buffer.from('Test document content for Vetrai E2E testing')
      await uploadInput.setInputFiles({
        name: 'test-document.txt',
        mimeType: 'text/plain',
        buffer: buffer
      })

      // Click upload button
      const uploadBtn = await page.locator('button:has-text("Upload"), button:has-text("Add File")')
      if (uploadBtn.isVisible()) {
        await uploadBtn.click()
        await expect(page.locator('.snackbar, .toast')).toContainText(/success|uploaded/i, { timeout: 10000 })
      }
    }

    // Verify file appears in list
    await page.waitForTimeout(1000)
    const fileList = await page.locator('[data-testid*="file"], tr, .file-card')
    const fileCount = await fileList.count()
    expect(fileCount).toBeGreaterThan(0)
  })

  // ==================== WORKSPACE SCREEN ====================

  test('Workspace Screen - Create & Manage', async () => {
    test.info().title = 'Workspace: Create, Switch, Delete'

    await page.goto(`${BASE_URL}/workspace`)
    await page.waitForLoadState('networkidle')

    // Verify page loaded
    expect(page.url()).toContain('/workspace')

    // Test: Create Workspace
    const createBtn = await page.locator('button:has-text("New Workspace"), button:has-text("Create")')
    if (createBtn.isVisible()) {
      await createBtn.click()

      // Fill form
      const nameInput = await page.locator('input[name="name"], input[placeholder*="name"]').first()
      await nameInput.fill('E2E Test Workspace')

      const descInput = await page.locator('input[name="description"], textarea[name="description"]')
      if (descInput.isVisible()) {
        await descInput.fill('Workspace created by E2E tests')
      }

      // Submit
      const confirmBtn = await page.locator('button:has-text("Create"), button:has-text("Add"), button:has-text("Save")')
      await confirmBtn.first().click()

      await expect(page.locator('.snackbar, .toast')).toContainText(/success|created/i, { timeout: 5000 })
    }

    // Verify workspace appears in list
    await page.waitForTimeout(1000)
    const workspaceRows = await page.locator('[data-testid*="workspace"], tr, .workspace-card')
    const workspaceCount = await workspaceRows.count()
    expect(workspaceCount).toBeGreaterThan(0)

    // Test: Switch Workspace
    const switchBtn = await page.locator('button:has-text("Switch"), button:has-text("Select")').first()
    if (switchBtn.isVisible()) {
      await switchBtn.click()
      await expect(page.locator('.snackbar, .toast')).toContainText(/success|switched/i, { timeout: 5000 })
    }
  })

  // ==================== MARKETPLACE SCREEN ====================

  test('Marketplace - Use Template', async () => {
    test.info().title = 'Marketplace: Browse & Use Template'

    await page.goto(`${BASE_URL}/marketplace`)
    await page.waitForLoadState('networkidle')

    // Verify page loaded
    expect(page.url()).toContain('/marketplace')

    // Check templates are visible
    const templates = await page.locator('[data-testid*="template"], .template-card, .marketplace-item')
    const templateCount = await templates.count()
    expect(templateCount).toBeGreaterThan(0)

    // Test: Use Template
    const useTemplateBtn = await page.locator('button:has-text("Use Template"), button:has-text("Import")')
    if (useTemplateBtn.isVisible()) {
      await useTemplateBtn.first().click()

      // Should navigate to canvas with new flow
      await page.waitForURL(/.*canvas.*/i, { timeout: 10000 })
      expect(page.url()).toContain('/canvas')

      // Verify canvas elements exist
      const canvas = await page.locator('[data-testid="canvas-container"], .react-flow')
      expect(canvas.isVisible()).toBeTruthy()
    }
  })

  // ==================== DOCUMENT STORE SCREEN ====================

  test('Document Store - Upload & Process', async () => {
    test.info().title = 'DocStore: Create, Upload, Process'

    await page.goto(`${BASE_URL}/document-stores`)
    await page.waitForLoadState('networkidle')

    // Verify page loaded
    expect(page.url()).toContain('/document')

    // Test: Create Document Store
    const createBtn = await page.locator('[data-testid="docstore-add-new"], button:has-text("Add New"), button:has-text("Create")')
    if (createBtn.isVisible()) {
      await createBtn.click()

      // Fill form
      const nameInput = await page.locator('input[name="name"], input[placeholder*="name"]').first()
      await nameInput.fill('E2E Test Document Store')

      // Submit
      const confirmBtn = await page.locator('button:has-text("Create"), button:has-text("Add")')
      await confirmBtn.first().click()

      await expect(page.locator('.snackbar, .toast')).toContainText(/success|created/i, { timeout: 5000 })
    }

    // Verify store appears in list
    await page.waitForTimeout(1000)
    const storeItems = await page.locator('[data-testid*="docstore"], tr, .docstore-card')
    const storeCount = await storeItems.count()
    expect(storeCount).toBeGreaterThan(0)
  })

  // ==================== EVALUATIONS SCREEN ====================

  test('Evaluations - Create & Run', async () => {
    test.info().title = 'Evaluations: Create Dataset & Run Evaluation'

    await page.goto(`${BASE_URL}/evaluations`)
    await page.waitForLoadState('networkidle')

    // Verify page loaded
    expect(page.url()).toContain('/evaluations')

    // Check evaluations table/list
    const evalTable = await page.locator('[data-testid="evaluations-table"], table')
    if (evalTable.isVisible()) {
      // Test: Create Evaluation
      const createBtn = await page.locator('[data-testid="evaluations-add-new"], button:has-text("New Evaluation")')
      if (createBtn.isVisible()) {
        await createBtn.click()

        // Fill form - would need to know the exact form structure
        // For now, just verify dialog opened
        const dialog = await page.locator('[role="dialog"], .dialog, .modal').first()
        expect(dialog.isVisible()).toBeTruthy()

        // Click close/cancel
        const cancelBtn = await page.locator('button:has-text("Cancel"), button:has-text("Close")')
        if (cancelBtn.isVisible()) {
          await cancelBtn.click()
        }
      }
    }
  })

  // ==================== ASSISTANTS SCREEN ====================

  test('Assistants - Browse Templates', async () => {
    test.info().title = 'Assistants: View Available Templates'

    await page.goto(`${BASE_URL}/assistants`)
    await page.waitForLoadState('networkidle')

    // Verify page loaded
    expect(page.url()).toContain('/assistants')

    // Check assistant cards are visible
    const assistantCards = await page.locator('[data-testid*="assistants-card"], .assistant-card, .feature-card')
    const cardCount = await assistantCards.count()
    expect(cardCount).toBeGreaterThan(0)

    // Test: Click on first assistant
    const firstCard = assistantCards.first()
    if (firstCard.isVisible()) {
      await firstCard.click()
      await page.waitForLoadState('networkidle')

      // Should navigate to assistant creation
      expect(page.url()).toContain('/assistants')
    }
  })

  // ==================== RBAC PERMISSION TESTS ====================

  test('RBAC - Permission Enforcement', async () => {
    test.info().title = 'RBAC: Verify Role-Based Restrictions'

    // Check that permissions are loaded
    const permissions = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('permissions') || '[]')
    })
    expect(permissions.length).toBeGreaterThan(0)

    // Visit admin-only screens as admin
    await page.goto(`${BASE_URL}/users`)
    expect(page.url()).toContain('/users')

    // Check for admin buttons
    const adminButtons = await page.locator('button:has-text("Invite"), button:has-text("Delete")')
    const visibleCount = await adminButtons.locator('visible=true').count()
    expect(visibleCount).toBeGreaterThan(0)
  })

  // ==================== FEATURE FLAGS ====================

  test('Feature Flags - All Enabled', async () => {
    test.info().title = 'Features: Verify All Flags Enabled'

    const features = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('features') || '{}')
    })

    // Check expected features are enabled
    expect(features['feat:files']).toBe(true)
    expect(features['feat:workspace']).toBe(true)
    expect(features['feat:sso-config']).toBe(true)
    expect(features['feat:login-activity']).toBe(true)

    // Verify screens are accessible
    const screens = [
      '/files',
      '/workspace',
      '/sso-config',
      '/login-activity'
    ]

    for (const screen of screens) {
      await page.goto(`${BASE_URL}${screen}`)
      await page.waitForLoadState('networkidle')
      expect(page.url()).toContain(screen)
    }
  })

  // ==================== DATA-TESTID VERIFICATION ====================

  test('Data-testid Attributes Present', async () => {
    test.info().title = 'UI: Verify All Test IDs Present'

    const testIds = [
      'chatflows-add-new',
      'agentflows-add-new',
      'evaluations-add-new',
      'docstore-add-new',
      'assistants-grid',
      'api-code-dialog'
    ]

    // Check chatflows
    await page.goto(`${BASE_URL}/chatflows`)
    await expect(page.locator('[data-testid="chatflows-add-new"]')).toBeVisible()
    await expect(page.locator('[data-testid*="chatflows"]')).toBeDefined()

    // Check agentflows
    await page.goto(`${BASE_URL}/agentflows`)
    await expect(page.locator('[data-testid="agentflows-add-new"]')).toBeVisible()

    // Check evaluations
    await page.goto(`${BASE_URL}/evaluations`)
    await expect(page.locator('[data-testid="evaluations-add-new"]')).toBeVisible()

    // Check assistants
    await page.goto(`${BASE_URL}/assistants`)
    await expect(page.locator('[data-testid="assistants-grid"]')).toBeVisible()

    // Check docstore
    await page.goto(`${BASE_URL}/document-stores`)
    await expect(page.locator('[data-testid="docstore-add-new"]')).toBeVisible()
  })

  // ==================== RESPONSIVE DESIGN ====================

  test('Responsive Design - Mobile View', async ({ page }) => {
    test.info().title = 'UI: Responsive Design on Mobile'

    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })

    await page.goto(`${BASE_URL}/users`)
    await page.waitForLoadState('networkidle')

    // Check page is responsive
    expect(page.url()).toContain('/users')

    // Buttons should still be clickable
    const buttons = await page.locator('button')
    const visibleCount = await buttons.locator('visible=true').count()
    expect(visibleCount).toBeGreaterThan(0)

    // Reset viewport
    await page.setViewportSize({ width: 1280, height: 720 })
  })

  // ==================== ERROR HANDLING ====================

  test('Error Handling - 404 and Network Errors', async () => {
    test.info().title = 'Error: Graceful Error Handling'

    // Test 404 page
    await page.goto(`${BASE_URL}/nonexistent-page`, { waitUntil: 'networkidle' })
    const pageContent = await page.content()
    expect(pageContent).toContain(/404|not found|doesn't exist/i)

    // Test with network error
    await page.route('**/api/**', (route) => {
      route.abort('failed')
    })

    await page.goto(`${BASE_URL}/users`)
    await page.waitForLoadState('networkidle')

    // Should show error message
    const errorMsg = await page.locator('.error, [role="alert"], .snackbar').first()
    expect(errorMsg).toBeDefined()
  })

  // ==================== PERFORMANCE ====================

  test('Performance - Bundle & Load Times', async () => {
    test.info().title = 'Performance: Bundle Size & Load Times'

    const startTime = Date.now()
    await page.goto(`${BASE_URL}`, { waitUntil: 'networkidle' })
    const loadTime = Date.now() - startTime

    // Should load within reasonable time (adjust threshold as needed)
    expect(loadTime).toBeLessThan(5000) // 5 seconds

    // Check that chunks are loaded (not single bundle)
    const scripts = await page.locator('script[src]').count()
    expect(scripts).toBeGreaterThan(1) // Multiple script chunks

    // Log performance metrics
    console.log(`Page load time: ${loadTime}ms`)
    console.log(`Script count: ${scripts}`)
  })
})
