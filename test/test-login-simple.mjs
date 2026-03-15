#!/usr/bin/env node
import { chromium } from 'playwright'

const baseUrl = process.env.BASE_URL || 'http://localhost'
const loginEmail = process.env.LOGIN_EMAIL || 'rajesh@satagrp.com'
const loginPassword = process.env.LOGIN_PASSWORD || 'rajesh@123'

async function test() {
    let browser, page

    try {
        console.log('🚀 Starting login test...')
        browser = await chromium.launch()
        page = await browser.newPage()

        console.log(`\n📄 Navigating to ${baseUrl}`)
        await page.goto(baseUrl, { waitUntil: 'networkidle' })

        console.log(`\n📝 Filling login form with email: ${loginEmail}`)

        // Fill email
        const emailInput = page.locator('input[type="email"]')
        await emailInput.fill(loginEmail)
        console.log('   ✓ Email filled')

        // Fill password
        const passwordInput = page.locator('input[type="password"]')
        await passwordInput.fill(loginPassword)
        console.log('   ✓ Password filled')

        // Click sign in
        const signInBtn = page.locator('button:has-text("Sign In")')
        console.log('   ✓ Clicking Sign In button...')
        await signInBtn.click()

        // Wait for navigation - be more flexible about the target URL
        console.log('   ⏳ Waiting for login to complete...')
        try {
            // Wait for either dashboard or any successful navigation away from login
            await page.waitForFunction(() => {
                const url = window.location.pathname
                return !url.includes('login') && !url.includes('signin') && !url.includes('auth')
            }, { timeout: 15000 })

            const currentUrl = page.url()
            console.log(`\n✅ Login successful!`)
            console.log(`   Current URL: ${currentUrl}`)

            // Wait a bit for page to fully load
            await page.waitForLoadState('networkidle')

            // Check if we're on a protected page
            const body = await page.locator('body').textContent()
            if (body.includes('Dashboard') || body.includes('Chatflows') || body.includes('Users')) {
                console.log('   ✓ Page loaded with expected content')
            }

        } catch (e) {
            console.log(`\n❌ Login failed or timeout: ${e.message}`)

            // Debug: check current page state
            const currentUrl = page.url()
            console.log(`   Current URL: ${currentUrl}`)

            // Check for error messages
            const errorText = await page.locator('[role="alert"]').textContent().catch(() => 'no alert')
            console.log(`   Alert text: ${errorText}`)

            // Take screenshot for debugging
            await page.screenshot({ path: 'login-error.png' })
            console.log('   📸 Screenshot saved: login-error.png')

            throw e
        }

    } catch (error) {
        console.error('\n❌ Test failed:', error.message)
        process.exit(1)
    } finally {
        if (browser) await browser.close()
    }
}

test()
