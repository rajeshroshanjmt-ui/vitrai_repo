#!/usr/bin/env node
import { chromium } from 'playwright'

const baseUrl = process.env.BASE_URL || 'http://localhost'
const loginEmail = 'testuser@vetrai.com'
const loginPassword = 'Test123!'

async function test() {
    let browser, page

    try {
        console.log('🚀 Testing login with console logging...\n')
        browser = await chromium.launch()
        page = await browser.newPage()

        // Log all console messages
        page.on('console', msg => {
            if (msg.type() === 'error') {
                console.log(`[ERROR] ${msg.text()}`)
            }
        })

        // Log all network responses
        page.on('response', response => {
            if (!response.ok()) {
                console.log(`[NETWORK] ${response.status()} ${response.url()}`)
            }
        })

        console.log('Step 1: Navigate to login')
        await page.goto(baseUrl, { waitUntil: 'networkidle' })
        console.log('✓ Login page loaded')

        console.log('\nStep 2: Fill login form')
        await page.fill('input[type="email"]', loginEmail)
        await page.fill('input[type="password"]', loginPassword)
        console.log('✓ Form filled')

        console.log('\nStep 3: Click Sign In')
        await page.click('button:has-text("Sign In")')

        console.log('\nStep 4: Wait for navigation')
        await page.waitForFunction(
            () => !window.location.pathname.includes('login'),
            { timeout: 10000 }
        )
        console.log('✓ Navigated away from login')

        console.log('\nStep 5: Check auth state')
        const authState = await page.evaluate(() => {
            return {
                url: window.location.href,
                localStorage: {
                    token: localStorage.getItem('vetrai_access_token') ? '✓' : '✗',
                    user: localStorage.getItem('user') ? '✓' : '✗',
                    isAuthenticated: localStorage.getItem('isAuthenticated')
                }
            }
        })
        console.log('Auth state:', authState)

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
