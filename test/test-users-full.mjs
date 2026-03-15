#!/usr/bin/env node
import { chromium } from 'playwright'

const baseUrl = process.env.BASE_URL || 'http://localhost'
const loginEmail = 'testuser@vetrai.com'
const loginPassword = 'Test123!'

async function test() {
    let browser, page

    try {
        console.log('🚀 Testing Users page (full)...\n')
        browser = await chromium.launch()
        page = await browser.newPage()

        // Capture console errors
        const errors = []
        page.on('console', msg => {
            if (msg.type() === 'error') {
                errors.push(msg.text())
            }
        })

        console.log('Step 1: Login')
        await page.goto(baseUrl, { waitUntil: 'networkidle' })
        await page.fill('input[type="email"]', loginEmail)
        await page.fill('input[type="password"]', loginPassword)
        await page.click('button:has-text("Sign In")')

        await page.waitForFunction(
            () => !window.location.pathname.includes('login'),
            { timeout: 15000 }
        )
        await page.waitForLoadState('networkidle')
        console.log('✅ Logged in\n')

        console.log('Step 2: Navigate to Users page')
        const usersLink = await page.locator('[href="/users"]').first().isVisible({ timeout: 3000 })
        if (usersLink) {
            await page.locator('[href="/users"]').first().click()
        } else {
            await page.goto(`${baseUrl}/users`, { waitUntil: 'networkidle' })
        }
        await page.waitForLoadState('networkidle')
        await page.waitForTimeout(2000)
        console.log('✅ Navigated to /users\n')

        console.log('Step 3: Check page content')
        const onUsersPage = page.url().includes('/users')
        const hasPageTitle = await page.locator('text=/Users|User Management/i').count() > 0
        const hasTable = await page.locator('table').count() > 0
        const hasError = await page.locator('text=Something went wrong').count() > 0

        console.log(`   ${onUsersPage ? '✅' : '❌'} On /users page`)
        console.log(`   ${hasPageTitle ? '✅' : '⚠️'} Page title visible`)
        console.log(`   ${hasTable ? '✅' : '⚠️'} User table present`)
        console.log(`   ${!hasError ? '✅' : '❌'} No runtime errors\n`)

        console.log('Step 4: Console errors')
        if (errors.length === 0) {
            console.log('   ✅ No console errors\n')
        } else {
            console.log(`   ❌ Found ${errors.length} console errors:`)
            errors.forEach((err, i) => {
                console.log(`      ${i + 1}: ${err.substring(0, 80)}`)
            })
        }

        console.log('========================================')
        const allPass = onUsersPage && hasPageTitle && hasTable && !hasError && errors.length === 0
        console.log(allPass ? '✅ USERS PAGE FULLY WORKING' : '⚠️ Some issues found')
        console.log('========================================')

    } catch (error) {
        console.error('\n❌ Test failed:', error.message)
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