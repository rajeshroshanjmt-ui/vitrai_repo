#!/usr/bin/env node
import { chromium } from 'playwright'
import fs from 'node:fs/promises'

const baseUrl = process.env.BASE_URL || 'http://localhost'
const loginEmail = 'testuser@vetrai.com'
const loginPassword = 'Test123!'

async function test() {
    let browser, page

    try {
        console.log('🚀 Starting marketplace visual test...')
        browser = await chromium.launch()
        page = await browser.newPage()

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

        // Take screenshot
        const screenshotPath = 'marketplace.png'
        await page.screenshot({ path: screenshotPath })
        console.log(`📸 Screenshot saved: ${screenshotPath}`)

        // Get page content
        const bodyText = await page.locator('body').textContent()
        console.log(`\n📋 Page text length: ${bodyText.length} characters`)

        // Check for specific elements
        console.log('\n🔍 Searching for elements:')

        // Look for hero banner
        const heroBannerElements = await page.locator('div').filter({ has: page.locator('text=Marketplace') }).all()
        console.log(`   Hero banner divs with "Marketplace" text: ${heroBannerElements.length}`)

        // Look for category tiles
        const categoryTiles = await page.locator('[role="button"], button, [class*="Grid"]').filter({ has: page.locator('text=/All Templates|Chatflows|Agentflows|Assistants/') }).all()
        console.log(`   Category tile elements: ${categoryTiles.length}`)

        // Look for templates grid
        const gridItems = await page.locator('[class*="MuiGrid-item"], [role="grid"], .card, [class*="template"]').all()
        console.log(`   Grid/card items: ${gridItems.length}`)

        // Check page structure
        const mainElement = await page.locator('main').isVisible().catch(() => false)
        console.log(`   Main element visible: ${mainElement}`)

        const layoutElement = await page.locator('[class*="MainLayout"]').isVisible().catch(() => false)
        console.log(`   Layout element visible: ${layoutElement}`)

        // List all visible headings
        const headings = await page.locator('h1, h2, h3, h4, h5, h6').all()
        console.log(`\n   Visible headings (${headings.length}):`)
        for (let i = 0; i < headings.length && i < 15; i++) {
            const text = await headings[i].textContent()
            const tag = await headings[i].evaluate(el => el.tagName)
            console.log(`     ${tag}: ${text.trim().substring(0, 60)}`)
        }

        // Check if there's an error or loading state
        const spinner = await page.locator('[class*="Spinner"], [class*="Skeleton"], [class*="Loading"]').isVisible().catch(() => false)
        console.log(`\n   Loading spinner visible: ${spinner}`)

        // Check for error messages
        const alerts = await page.locator('[role="alert"], [class*="alert"], [class*="error"]').all()
        console.log(`   Alert elements: ${alerts.length}`)
        for (let i = 0; i < alerts.length && i < 3; i++) {
            const text = await alerts[i].textContent().catch(() => '')
            if (text) console.log(`     Alert: ${text.trim().substring(0, 80)}`)
        }

        // Check current page title and URL
        const title = await page.title()
        const url = page.url()
        console.log(`\n   Page title: ${title}`)
        console.log(`   Current URL: ${url}`)

    } catch (error) {
        console.error('\n❌ Error:', error.message)
    } finally {
        if (browser) await browser.close()
    }
}

test()
