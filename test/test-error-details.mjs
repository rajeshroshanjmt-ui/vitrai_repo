#!/usr/bin/env node
import { chromium } from 'playwright'

const baseUrl = process.env.BASE_URL || 'http://localhost'
const loginEmail = 'testuser@vetrai.com'
const loginPassword = 'Test123!'

async function test() {
    let browser, page

    try {
        console.log('🚀 Testing marketplace error...')
        browser = await chromium.launch()
        page = await browser.newPage()

        // Listen to console messages
        page.on('console', msg => {
            console.log(`[CONSOLE] ${msg.type()}: ${msg.text()}`)
        })

        // Listen to uncaught exceptions
        page.on('pageerror', error => {
            console.log(`[ERROR] ${error.message}`)
            console.log(`  Stack: ${error.stack}`)
        })

        console.log('\n📄 Login...')
        await page.goto(baseUrl, { waitUntil: 'networkidle' })
        await page.fill('input[type="email"]', loginEmail)
        await page.fill('input[type="password"]', loginPassword)
        await page.click('button:has-text("Sign In")')
        await page.waitForTimeout(3000)
        await page.waitForLoadState('networkidle')
        console.log('✅ Logged in')

        console.log('\n📄 Navigate to marketplace...')
        await page.goto(`${baseUrl}/marketplaces`, { waitUntil: 'networkidle' })
        await page.waitForTimeout(2000)

        // Get the error message
        const errorMessage = await page.locator('h3:has-text("Something went wrong")').evaluate(el => {
            return {
                text: el.textContent,
                parent: el.parentElement?.textContent,
                html: el.parentElement?.innerHTML
            }
        }).catch(() => null)

        if (errorMessage) {
            console.log('\n📋 Error details:')
            console.log(`   Message: ${errorMessage.text}`)
            console.log(`   Parent text: ${errorMessage.parent?.substring(0, 200)}`)
        }

        // Check for more error info
        const errorContainer = await page.locator('[class*="error"], [role="alert"]').nth(0).textContent().catch(() => null)
        if (errorContainer) {
            console.log(`   Container: ${errorContainer.substring(0, 200)}`)
        }

        // Take screenshot
        await page.screenshot({ path: 'error-page.png' })
        console.log('\n📸 Screenshot saved: error-page.png')

    } catch (error) {
        console.error('\n❌ Error:', error.message)
    } finally {
        if (browser) await browser.close()
    }
}

test()
