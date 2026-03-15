#!/usr/bin/env node
import { chromium } from 'playwright'

const baseUrl = process.env.BASE_URL || 'http://localhost'
const loginEmail = 'testuser@vetrai.com'
const loginPassword = 'Test123!'

async function test() {
    let browser, page

    try {
        console.log('🚀 Testing Users Management Page...\n')
        browser = await chromium.launch()
        page = await browser.newPage()

        // Login
        console.log('✓ Step 1: Login')
        await page.goto(baseUrl, { waitUntil: 'networkidle' })
        await page.fill('input[type="email"]', loginEmail)
        await page.fill('input[type="password"]', loginPassword)
        await page.click('button:has-text("Sign In")')
        await page.waitForFunction(
            () => !window.location.pathname.includes('login'),
            { timeout: 15000 }
        )
        await page.waitForLoadState('networkidle')
        console.log('  ✅ Login successful\n')

        // Navigate to Users page
        console.log('✓ Step 2: Navigate to /users')
        await page.goto(`${baseUrl}/users`, { waitUntil: 'networkidle' })
        await page.waitForTimeout(2000)

        const url = page.url()
        const onUsersPage = url.includes('/users')
        if (!onUsersPage) {
            console.log(`  ❌ Redirected to: ${url}`)
        }
        console.log(`  ${onUsersPage ? '✅' : '❌'} On /users page\n`)

        // Check for page elements
        console.log('✓ Step 3: Check page elements')

        const hasPageTitle = await page.locator('text=/Users|User Management/i').count() > 0
        console.log(`  ${hasPageTitle ? '✅' : '⚠️'} Page title found`)

        const hasTable = await page.locator('table, [role="table"]').count() > 0
        console.log(`  ${hasTable ? '✅' : '⚠️'} User table present`)

        const hasAddUserBtn = await page.locator('button').filter({ hasText: /Invite|Add/ }).count() > 0
        console.log(`  ${hasAddUserBtn ? '✅' : '⚠️'} Add/Invite user button found`)

        const hasNoError = await page.locator('text=Something went wrong').count() === 0
        console.log(`  ${hasNoError ? '✅' : '❌'} No runtime errors\n`)

        // Check table content
        console.log('✓ Step 4: Table content')
        const userRows = await page.locator('table tbody tr, [role="row"]').count()
        console.log(`  ${userRows > 0 ? '✅' : '⚠️'} User rows found: ${userRows}`)

        const hasEmailColumn = await page.locator('text=/email|user/i').count() > 0
        console.log(`  ${hasEmailColumn ? '✅' : '⚠️'} Email column visible`)

        const hasStatusColumn = await page.locator('text=/ACTIVE|INVITED|INACTIVE/i').count() > 0
        console.log(`  ${hasStatusColumn ? '✅' : '⚠️'} Status column visible\n`)

        // Summary
        console.log('='*60)
        const allPass = onUsersPage && hasPageTitle && hasTable && hasNoError && hasAddUserBtn
        console.log(allPass ? '✅ USERS PAGE WORKING' : '⚠️ Some features missing')
        console.log('='*60)

    } catch (error) {
        console.error('\n❌ Test failed:', error.message)
        process.exit(1)
    } finally {
        try {
            if (page) await page.close()
            if (browser) await browser.close()
        } catch (e) {
            // ignore
        }
    }
}

test()