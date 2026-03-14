#!/usr/bin/env node
import { chromium } from 'playwright'

const baseUrl = process.env.BASE_URL || 'http://localhost'
const loginEmail = 'testuser@vetrai.com'
const loginPassword = 'Test123!'

async function test() {
    let browser, page

    try {
        console.log('🚀 Starting marketplace detail test...')
        browser = await chromium.launch()
        page = await browser.newPage()

        console.log('\n📄 Login...')
        await page.goto(baseUrl, { waitUntil: 'networkidle' })
        await page.fill('input[type="email"]', loginEmail)
        await page.fill('input[type="password"]', loginPassword)
        await page.click('button:has-text("Sign In")')

        await page.waitForFunction(() => {
            const url = window.location.pathname
            return !url.includes('login') && !url.includes('signin')
        }, { timeout: 15000 })

        await page.waitForLoadState('networkidle')
        console.log('✅ Logged in')

        console.log('\n📄 Navigate to marketplace...')
        await page.goto(`${baseUrl}/marketplaces`, { waitUntil: 'networkidle' })

        // Wait a bit for all content to render
        await page.waitForTimeout(2000)

        // Take screenshot
        await page.screenshot({ path: 'marketplace-page.png' })
        console.log('📸 Screenshot saved: marketplace-page.png')

        // Check page content
        const pageText = await page.locator('body').textContent()

        // Look for specific text
        console.log('\n🔍 Page content check:')
        console.log(`   - Contains "Marketplace": ${pageText.includes('Marketplace')}`)
        console.log(`   - Contains "Chatflow": ${pageText.includes('Chatflow')}`)
        console.log(`   - Contains "Featured": ${pageText.includes('Featured')}`)
        console.log(`   - Contains "All Templates": ${pageText.includes('All Templates')}`)
        console.log(`   - Contains "template": ${pageText.includes('template')}`)
        console.log(`   - Page length: ${pageText.length} characters`)

        // List all visible text sections
        const sections = await page.locator('h1, h2, h3, h4, h5, h6').all()
        console.log(`\n   Found ${sections.length} headings:`)
        for (let i = 0; i < sections.length && i < 10; i++) {
            const text = await sections[i].textContent()
            console.log(`     - ${text.trim()}`)
        }

        // Check grid items
        const gridItems = await page.locator('[role="region"], .MuiGrid-item, .card').all()
        console.log(`\n   Found ${gridItems.length} grid/card items`)

        // Check if there's an error message
        const alert = await page.locator('[role="alert"]').textContent().catch(() => null)
        if (alert) {
            console.log(`\n   ⚠️  Alert message: ${alert}`)
        }

        // Check the hero banner div structure
        const heroBanner = await page.locator('div').filter({ has: page.locator('text=Marketplace') }).first().isVisible().catch(() => false)
        console.log(`\n   Hero banner div visible: ${heroBanner}`)

        // Check current URL
        const url = page.url()
        console.log(`\n   Current URL: ${url}`)

    } catch (error) {
        console.error('\n❌ Error:', error.message)
    } finally {
        if (browser) await browser.close()
    }
}

test()
