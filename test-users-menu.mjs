#!/usr/bin/env node
import { chromium } from 'playwright'

const baseUrl = process.env.BASE_URL || 'http://localhost'
const loginEmail = 'testuser@vetrai.com'
const loginPassword = 'Test123!'

async function test() {
    let browser, page

    try {
        console.log('🚀 Testing Users menu visibility...\n')
        browser = await chromium.launch()
        page = await browser.newPage()

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
        await page.waitForTimeout(1000)
        console.log('✅ Logged in\n')

        console.log('Step 2: Check sidebar for Users menu')
        // Try different selectors to find the Users menu item
        const usersMenu1 = await page.locator('text=/^Users$/').first().isVisible({ timeout: 3000 }).catch(() => false)
        const usersMenu2 = await page.locator('a:has-text("Users")').first().isVisible({ timeout: 3000 }).catch(() => false)
        const usersMenu3 = await page.locator('[href="/users"]').first().isVisible({ timeout: 3000 }).catch(() => false)
        const adminSection = await page.locator('text=ADMIN').first().isVisible({ timeout: 3000 }).catch(() => false)

        console.log(`   ADMIN section visible: ${adminSection ? '✅' : '⚠️'}`)
        console.log(`   Users menu (text match): ${usersMenu1 ? '✅' : '⚠️'}`)
        console.log(`   Users menu (link): ${usersMenu2 ? '✅' : '⚠️'}`)
        console.log(`   Users menu (href): ${usersMenu3 ? '✅' : '⚠️'}\n`)

        if (usersMenu1 || usersMenu2 || usersMenu3) {
            console.log('Step 3: Click Users menu and navigate')
            const usersLink = page.locator('[href="/users"], a:has-text("Users")').first()
            await usersLink.click()
            await page.waitForLoadState('networkidle')
            await page.waitForTimeout(1000)

            const onUsersPage = page.url().includes('/users')
            console.log(`   ${onUsersPage ? '✅' : '❌'} Navigated to /users\n`)

            if (onUsersPage) {
                console.log('========================================')
                console.log('✅ USERS MENU AND PAGE WORKING')
                console.log('========================================')
            }
        } else {
            console.log('⚠️ Users menu not found in sidebar')
        }

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