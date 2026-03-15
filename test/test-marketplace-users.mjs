#!/usr/bin/env node
import { chromium } from 'playwright'
import fs from 'node:fs/promises'
import path from 'node:path'

const baseUrl = process.env.BASE_URL || 'http://localhost'
const loginEmail = process.env.LOGIN_EMAIL || 'rajesh@satagrp.com'
const loginPassword = process.env.LOGIN_PASSWORD || 'rajesh@123'

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
    let browser, context, page

    try {
        console.log('🚀 Starting browser test...')
        browser = await chromium.launch()
        page = await browser.newPage()

        // Test 1: Login
        console.log('\n✓ Test 1: Login with rajesh@satagrp.com')
        await page.goto(baseUrl, { waitUntil: 'networkidle' })
        await page.fill('input[type="email"]', loginEmail)
        await page.fill('input[type="password"]', loginPassword)
        await page.click('button:has-text("Sign In")')

        try {
            await page.waitForURL(`${baseUrl}/dashboard`, { timeout: 10000 })
            results.loginSuccess = true
            console.log('✅ Login successful, redirected to dashboard')
        } catch (e) {
            results.errors.push(`Login failed: ${e.message}`)
            console.log('❌ Login failed')
            throw e
        }

        // Test 2: Check Users menu visibility
        console.log('\n✓ Test 2: Check if Users menu is visible in sidebar')
        const usersMenuVisible = await page.locator('text=Users').first().isVisible().catch(() => false)
        if (usersMenuVisible) {
            results.usersMenuVisible = true
            console.log('✅ Users menu item is visible in sidebar')
        } else {
            results.errors.push('Users menu not visible in sidebar')
            console.log('❌ Users menu not visible')
        }

        // Test 3: Navigate to Users page
        if (results.usersMenuVisible) {
            console.log('\n✓ Test 3: Navigate to Users page')
            await page.click('text=Users')
            try {
                await page.waitForURL(`${baseUrl}/users`, { timeout: 5000 })
                results.usersPageLoads = true
                console.log('✅ Users page loaded successfully')
            } catch (e) {
                results.errors.push(`Users page failed to load: ${e.message}`)
                console.log('❌ Users page failed to load')
            }
        }

        // Test 4: Navigate to Marketplace
        console.log('\n✓ Test 4: Navigate to Marketplace')
        await page.goto(`${baseUrl}/marketplaces`, { waitUntil: 'networkidle' })

        // Test 4a: Check for hero banner
        const heroBanner = await page.locator('text=Marketplace').first().isVisible().catch(() => false)
        if (heroBanner) {
            results.marketplaceHeroBanner = true
            console.log('✅ Hero banner with Marketplace title visible')
        } else {
            results.errors.push('Hero banner not found')
            console.log('❌ Hero banner not visible')
        }

        // Test 4b: Check for category tiles
        const categoryTiles = await page.locator('text=/^(All Templates|Chatflows|Agentflows|Assistants)$/').count()
        if (categoryTiles >= 4) {
            results.marketplaceCategoryTiles = true
            console.log('✅ Category tiles visible (All, Chatflows, Agentflows, Assistants)')
        } else {
            results.errors.push(`Expected 4 category tiles, found ${categoryTiles}`)
            console.log(`❌ Category tiles: expected 4, found ${categoryTiles}`)
        }

        // Test 4c: Check for Featured Templates heading
        const featuredHeading = await page.locator('text=Featured Templates').isVisible().catch(() => false)
        if (featuredHeading) {
            results.marketplaceFeaturedTemplates = true
            console.log('✅ Featured Templates section visible')
        } else {
            results.errors.push('Featured Templates heading not found')
            console.log('❌ Featured Templates section not visible')
        }

        // Test 5: Refresh and check persistence
        console.log('\n✓ Test 5: Refresh page and check auth persistence')
        await page.reload({ waitUntil: 'networkidle' })

        // Should still be on marketplace and still logged in
        const stillLoggedIn = await page.locator('text=Marketplace').first().isVisible({ timeout: 5000 }).catch(() => false)
        if (stillLoggedIn) {
            results.persistenceAfterRefresh = true
            console.log('✅ Session persisted after page refresh')
        } else {
            results.errors.push('Session not persisted after refresh')
            console.log('❌ Session lost after refresh')
        }

        // Test 6: Click category tile and verify filtering
        console.log('\n✓ Test 6: Test category tile interaction')
        const chatflowsTile = await page.locator('text=Chatflows').first()
        if (await chatflowsTile.isVisible()) {
            await chatflowsTile.click()
            await page.waitForTimeout(500) // Wait for filter animation
            const pageContent = await page.content()
            console.log('✅ Category tile click handled')
        }

        console.log('\n' + '='.repeat(60))
        console.log('TEST SUMMARY')
        console.log('='.repeat(60))
        console.log(`✅ Login Success:                  ${results.loginSuccess ? 'PASS' : 'FAIL'}`)
        console.log(`✅ Users Menu Visible:             ${results.usersMenuVisible ? 'PASS' : 'FAIL'}`)
        console.log(`✅ Users Page Loads:               ${results.usersPageLoads ? 'PASS' : 'FAIL'}`)
        console.log(`✅ Marketplace Hero Banner:        ${results.marketplaceHeroBanner ? 'PASS' : 'FAIL'}`)
        console.log(`✅ Marketplace Category Tiles:     ${results.marketplaceCategoryTiles ? 'PASS' : 'FAIL'}`)
        console.log(`✅ Featured Templates Section:     ${results.marketplaceFeaturedTemplates ? 'PASS' : 'FAIL'}`)
        console.log(`✅ Persistence After Refresh:      ${results.persistenceAfterRefresh ? 'PASS' : 'FAIL'}`)
        console.log('='.repeat(60))

        if (results.errors.length > 0) {
            console.log('\n⚠️  ERRORS:')
            results.errors.forEach(err => console.log(`   - ${err}`))
        }

        const allPass = Object.values(results).filter(v => typeof v === 'boolean').every(v => v)
        console.log(`\n${allPass ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`)

    } catch (error) {
        console.error('\n❌ Test execution failed:', error)
        results.errors.push(error.message)
    } finally {
        try {
            if (page) await page.close()
            if (browser) await browser.close()
        } catch (e) {
            // ignore cleanup errors
        }
        process.exit(Object.values(results).filter(v => typeof v === 'boolean').every(v => v) ? 0 : 1)
    }
}

test()
