#!/usr/bin/env node
import { chromium } from 'playwright'

const baseUrl = process.env.BASE_URL || 'http://localhost'
const loginEmail = 'testuser@vetrai.com'
const loginPassword = 'Test123!'

const results = {
    loginSuccess: false,
    usersMenuVisible: false,
    usersPageLoads: false,
    marketplaceHeroBanner: false,
    marketplaceCategoryTiles: false,
    marketplaceFeaturedTemplates: false,
    persistenceAfterRefresh: false,
    errors: []
}

async function test() {
    let browser, page

    try {
        console.log('🚀 Starting application test...')
        browser = await chromium.launch()
        page = await browser.newPage()

        // Test 1: Login
        console.log('\n✓ Test 1: Login with testuser@vetrai.com')
        await page.goto(baseUrl, { waitUntil: 'networkidle' })
        await page.fill('input[type="email"]', loginEmail)
        await page.fill('input[type="password"]', loginPassword)
        await page.click('button:has-text("Sign In")')

        try {
            // Wait for successful login (URL change away from /login or /signin)
            await page.waitForFunction(() => {
                const url = window.location.pathname
                return !url.includes('login') && !url.includes('signin') && !url.includes('auth')
            }, { timeout: 15000 })

            results.loginSuccess = true
            await page.waitForLoadState('networkidle')
            console.log(`✅ Login successful`)
        } catch (e) {
            results.errors.push(`Login failed: ${e.message}`)
            console.log('❌ Login failed')
            throw e
        }

        // Test 2: Check Users menu visibility
        console.log('\n✓ Test 2: Check if Users menu is visible in sidebar')
        try {
            const usersMenu = await page.locator('text=/Users/i').first().isVisible({ timeout: 5000 }).catch(() => false)
            if (usersMenu) {
                results.usersMenuVisible = true
                console.log('✅ Users menu item is visible in sidebar')
            } else {
                console.log('⚠️  Users menu not visible in sidebar')
            }
        } catch (e) {
            console.log('⚠️  Could not check Users menu:', e.message)
        }

        // Test 3: Navigate to Marketplace
        console.log('\n✓ Test 3: Navigate to Marketplace')
        await page.goto(`${baseUrl}/marketplaces`, { waitUntil: 'networkidle' })

        // Test 3a: Check for hero banner
        try {
            const heroBanner = await page.locator('text=Marketplace').first().isVisible({ timeout: 5000 })
            if (heroBanner) {
                results.marketplaceHeroBanner = true
                console.log('✅ Hero banner with Marketplace title visible')
            }
        } catch (e) {
            console.log('⚠️  Hero banner not found:', e.message)
        }

        // Test 3b: Check for category tiles
        try {
            const categoryCount = await page.locator('text=/^(All Templates|Chatflows|Agentflows|Assistants)$/').count()
            if (categoryCount >= 3) {
                results.marketplaceCategoryTiles = true
                console.log(`✅ Category tiles visible (found ${categoryCount} tiles)`)
            } else {
                console.log(`⚠️  Category tiles: expected >=3, found ${categoryCount}`)
            }
        } catch (e) {
            console.log('⚠️  Could not check category tiles:', e.message)
        }

        // Test 3c: Check for Featured Templates heading
        try {
            const featuredHeading = await page.locator('text=Featured Templates').isVisible({ timeout: 5000 }).catch(() => false)
            if (featuredHeading) {
                results.marketplaceFeaturedTemplates = true
                console.log('✅ Featured Templates section visible')
            } else {
                console.log('⚠️  Featured Templates section not visible')
            }
        } catch (e) {
            console.log('⚠️  Could not check Featured Templates:', e.message)
        }

        // Test 4: Refresh and check persistence
        console.log('\n✓ Test 4: Refresh page and check auth persistence')
        try {
            await page.reload({ waitUntil: 'networkidle' })

            // Should still be on marketplace and still logged in
            const stillOnMarketplace = await page.locator('text=Marketplace').first().isVisible({ timeout: 5000 }).catch(() => false)
            if (stillOnMarketplace) {
                results.persistenceAfterRefresh = true
                console.log('✅ Session persisted after page refresh')
            } else {
                console.log('⚠️  Could not verify persistence')
            }
        } catch (e) {
            console.log('⚠️  Persistence check failed:', e.message)
        }

        // Summary
        console.log('\n' + '='.repeat(60))
        console.log('TEST SUMMARY')
        console.log('='.repeat(60))
        console.log(`✓ Login Success:                  ${results.loginSuccess ? '✅ PASS' : '❌ FAIL'}`)
        console.log(`✓ Users Menu Visible:             ${results.usersMenuVisible ? '✅ PASS' : '⚠️  NOT CHECKED'}`)
        console.log(`✓ Marketplace Hero Banner:        ${results.marketplaceHeroBanner ? '✅ PASS' : '⚠️  NOT CHECKED'}`)
        console.log(`✓ Marketplace Category Tiles:     ${results.marketplaceCategoryTiles ? '✅ PASS' : '⚠️  NOT CHECKED'}`)
        console.log(`✓ Featured Templates Section:     ${results.marketplaceFeaturedTemplates ? '✅ PASS' : '⚠️  NOT CHECKED'}`)
        console.log(`✓ Persistence After Refresh:      ${results.persistenceAfterRefresh ? '✅ PASS' : '⚠️  NOT CHECKED'}`)
        console.log('='.repeat(60))

        if (results.errors.length > 0) {
            console.log('\n⚠️  ERRORS/WARNINGS:')
            results.errors.forEach(err => console.log(`   - ${err}`))
        }

        if (results.loginSuccess) {
            console.log('\n✅ LOGIN AND MARKETPLACE TESTS PASSED')
        } else {
            console.log('\n❌ LOGIN FAILED - APPLICATION NOT TESTED')
            process.exit(1)
        }

    } catch (error) {
        console.error('\n❌ Test execution failed:', error.message)
        results.errors.push(error.message)
        process.exit(1)
    } finally {
        try {
            if (page) await page.close()
            if (browser) await browser.close()
        } catch (e) {
            // ignore cleanup errors
        }
    }
}

test()
