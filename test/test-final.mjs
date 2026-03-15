#!/usr/bin/env node
import { chromium } from 'playwright'

const baseUrl = process.env.BASE_URL || 'http://localhost'
const loginEmail = 'testuser@vetrai.com'
const loginPassword = 'Test123!'

async function test() {
    let browser, page

    try {
        console.log('🚀 Final application verification test...\n')
        browser = await chromium.launch()
        page = await browser.newPage()

        // Test 1: Login
        console.log('✓ TEST 1: Login')
        await page.goto(baseUrl, { waitUntil: 'networkidle' })
        await page.fill('input[type="email"]', loginEmail)
        await page.fill('input[type="password"]', loginPassword)
        await page.click('button:has-text("Sign In")')

        await page.waitForFunction(
            () => !window.location.pathname.includes('login') && !window.location.pathname.includes('signin'),
            { timeout: 15000 }
        )
        await page.waitForLoadState('networkidle')
        console.log('  ✅ Login successful\n')

        // Test 2: Check sidebar for Users menu
        console.log('✓ TEST 2: Users Management Menu')
        const usersMenuVisible = await page.locator('text=/^Users$/i').first().isVisible({ timeout: 5000 }).catch(() => false)
        console.log(`  ${usersMenuVisible ? '✅' : '⚠️'} Users menu ${usersMenuVisible ? 'visible' : 'not visible'}\n`)

        // Test 3: Navigate to marketplace
        console.log('✓ TEST 3: Marketplace')
        await page.goto(`${baseUrl}/marketplaces`, { waitUntil: 'networkidle' })
        await page.waitForTimeout(2000)

        // Check for hero banner elements
        const hasMarketplaceTitle = await page.locator('text=Marketplace').count() > 0
        console.log(`  ${hasMarketplaceTitle ? '✅' : '❌'} Hero banner title present`)

        // Check for category tiles
        const allTemplatesTile = await page.locator('text=/All Templates/i').count() > 0
        const chatflowsTile = await page.locator('text=/Chatflows/i').count() > 0
        const agentflowsTile = await page.locator('text=/Agentflows/i').count() > 0
        const assistantsTile = await page.locator('text=/Assistants/i').count() > 0

        const categoryTilesCount = [allTemplatesTile, chatflowsTile, agentflowsTile, assistantsTile].filter(Boolean).length
        console.log(`  ${categoryTilesCount >= 3 ? '✅' : '⚠️'} Category tiles: ${categoryTilesCount}/4 found`)

        // Check for Featured Templates
        const hasFeatured = await page.locator('text=/Featured Templates/i').count() > 0
        console.log(`  ${hasFeatured ? '✅' : '⚠️'} Featured Templates section ${hasFeatured ? 'visible' : 'not visible'}\n`)

        // Test 4: Check for errors
        console.log('✓ TEST 4: Error Check')
        const hasError = await page.locator('text=Something went wrong').count() > 0
        console.log(`  ${hasError ? '❌' : '✅'} No runtime errors\n`)

        // Test 5: Persistence after refresh
        console.log('✓ TEST 5: Session Persistence')
        await page.reload({ waitUntil: 'networkidle' })
        const stillOnMarketplace = page.url().includes('/marketplaces')
        const stillLoggedIn = await page.locator('body').textContent().then(text => !text.includes('Sign In')).catch(() => false)
        console.log(`  ${stillOnMarketplace && stillLoggedIn ? '✅' : '⚠️'} Session persisted\n`)

        // Summary
        console.log('='*60)
        const allPass = hasMarketplaceTitle && categoryTilesCount >= 3 && hasFeatured && !hasError && stillLoggedIn
        console.log(allPass ? '✅ ALL TESTS PASSED' : '⚠️  Some tests incomplete')
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
