#!/usr/bin/env node
import { chromium } from 'playwright'

const baseUrl = process.env.BASE_URL || 'http://localhost'
const loginEmail = process.env.LOGIN_EMAIL || 'rajesh@satagrp.com'
const loginPassword = process.env.LOGIN_PASSWORD || 'rajesh@123'

async function test() {
    let browser, page

    try {
        console.log('🚀 Opening browser...')
        browser = await chromium.launch()
        page = await browser.newPage()

        console.log(`\n📄 Navigating to ${baseUrl}`)
        await page.goto(baseUrl, { waitUntil: 'networkidle' })

        // Screenshot before login
        await page.screenshot({ path: 'login-page.png' })
        console.log('📸 Screenshot saved: login-page.png')

        // Debug: print page content
        const pageTitle = await page.title()
        console.log(`\n📋 Page title: ${pageTitle}`)

        // Try to find login form elements
        console.log('\n🔍 Looking for login form elements:')

        const emailFields = await page.locator('input[type="email"]').count()
        console.log(`   - Email input fields: ${emailFields}`)

        const passwordFields = await page.locator('input[type="password"]').count()
        console.log(`   - Password input fields: ${passwordFields}`)

        const signInButtons = await page.locator('button:has-text("Sign In")').count()
        console.log(`   - Sign In buttons: ${signInButtons}`)

        // List all inputs
        const inputs = await page.locator('input').all()
        console.log(`\n   Total inputs on page: ${inputs.length}`)
        for (let i = 0; i < inputs.length; i++) {
            const type = await inputs[i].getAttribute('type')
            const placeholder = await inputs[i].getAttribute('placeholder')
            const id = await inputs[i].getAttribute('id')
            console.log(`     ${i}: type="${type}" placeholder="${placeholder}" id="${id}"`)
        }

        // List all buttons
        const buttons = await page.locator('button').all()
        console.log(`\n   Total buttons on page: ${buttons.length}`)
        for (let i = 0; i < buttons.length; i++) {
            const text = await buttons[i].textContent()
            const id = await buttons[i].getAttribute('id')
            console.log(`     ${i}: "${text.trim()}" id="${id}"`)
        }

        // Try to get page HTML
        const html = await page.content()
        const htmlPreview = html.substring(0, 1000)
        console.log(`\n📄 Page HTML preview:\n${htmlPreview}...`)

    } catch (error) {
        console.error('\n❌ Error:', error.message)
    } finally {
        if (browser) await browser.close()
    }
}

test()
