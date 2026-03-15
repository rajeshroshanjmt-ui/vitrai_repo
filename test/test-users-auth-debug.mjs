#!/usr/bin/env node
import { chromium } from 'playwright'

const baseUrl = process.env.BASE_URL || 'http://localhost'
const loginEmail = 'testuser@vetrai.com'
const loginPassword = 'Test123!'

async function test() {
    let browser, page

    try {
        console.log('🚀 Debugging Users page auth issue...\n')
        browser = await chromium.launch()
        page = await browser.newPage()

        // Login
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
        console.log('✅ Login successful\n')

        // Check localStorage immediately after login
        console.log('Step 2: Check localStorage after login')
        const authData = await page.evaluate(() => {
            return {
                token: localStorage.getItem('vetrai_access_token') ? 'exists' : 'missing',
                user: localStorage.getItem('user') ? 'exists' : 'missing',
                isAuthenticated: localStorage.getItem('isAuthenticated'),
                url: window.location.href
            }
        })
        console.log('  Auth data:', authData)
        console.log('  Current URL:', page.url(), '\n')

        // Navigate to users page
        console.log('Step 3: Navigate to /users')
        await page.goto(`${baseUrl}/users`, { waitUntil: 'networkidle' })

        // Check if we got redirected
        const finalUrl = page.url()
        console.log('  Final URL:', finalUrl)

        // Check localStorage after navigation
        const authDataAfter = await page.evaluate(() => {
            return {
                token: localStorage.getItem('vetrai_access_token') ? 'exists' : 'missing',
                user: localStorage.getItem('user') ? 'exists' : 'missing',
                isAuthenticated: localStorage.getItem('isAuthenticated'),
                url: window.location.href
            }
        })
        console.log('  Auth data after nav:', authDataAfter)

        // Check page title to see if we're on login or users page
        const pageText = await page.locator('body').textContent()
        const onLoginPage = pageText.includes('Sign In')
        const onUsersPage = finalUrl.includes('/users')

        console.log(`\n  On users page: ${onUsersPage}`)
        console.log(`  On login page: ${onLoginPage}`)

        // If on login page, check for error messages
        if (onLoginPage) {
            const errorMsg = await page.locator('[role="alert"], [class*="error"]').textContent().catch(() => '')
            console.log(`  Error message: ${errorMsg.substring(0, 100)}`)
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