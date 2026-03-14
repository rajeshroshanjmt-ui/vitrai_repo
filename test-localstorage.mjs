#!/usr/bin/env node
import { chromium } from 'playwright'

const baseUrl = process.env.BASE_URL || 'http://localhost'
const loginEmail = 'testuser@vetrai.com'
const loginPassword = 'Test123!'

async function test() {
    let browser, page

    try {
        console.log('🚀 Testing localStorage persistence during login...')
        browser = await chromium.launch()
        page = await browser.newPage()

        console.log('\n📄 Navigate to login page')
        await page.goto(baseUrl, { waitUntil: 'networkidle' })

        console.log('\n📝 Check localStorage before login:')
        const beforeLogin = await page.evaluate(() => {
            return {
                vetrai_access_token: localStorage.getItem('vetrai_access_token'),
                user: localStorage.getItem('user'),
                isAuthenticated: localStorage.getItem('isAuthenticated'),
                permissions: localStorage.getItem('permissions') ? 'exists' : 'missing',
                features: localStorage.getItem('features') ? 'exists' : 'missing'
            }
        })
        console.log('   ', beforeLogin)

        console.log('\n🔑 Filling login form and submitting...')
        await page.fill('input[type="email"]', loginEmail)
        await page.fill('input[type="password"]', loginPassword)
        const signInBtn = page.locator('button:has-text("Sign In")')
        await signInBtn.click()

        console.log('   ⏳ Waiting for login to complete...')
        // Wait for the login to complete and any API calls to finish
        await page.waitForTimeout(3000)
        await page.waitForLoadState('networkidle')

        console.log('\n📝 Check localStorage after login:')
        const afterLogin = await page.evaluate(() => {
            const result = {
                vetrai_access_token: localStorage.getItem('vetrai_access_token') ? `${localStorage.getItem('vetrai_access_token').substring(0, 50)}...` : 'missing',
                user: localStorage.getItem('user') ? 'exists' : 'missing',
                isAuthenticated: localStorage.getItem('isAuthenticated'),
                permissions: localStorage.getItem('permissions') ? 'exists' : 'missing',
                features: localStorage.getItem('features') ? 'exists' : 'missing',
                allKeys: Object.keys(localStorage)
            }
            return result
        })
        console.log('   Token:', afterLogin.vetrai_access_token)
        console.log('   User:', afterLogin.user)
        console.log('   isAuthenticated:', afterLogin.isAuthenticated)
        console.log('   Permissions:', afterLogin.permissions)
        console.log('   Features:', afterLogin.features)
        console.log('   All localStorage keys:', afterLogin.allKeys)

        console.log('\n🔍 Check current URL:')
        const url = page.url()
        console.log('   URL:', url)

        console.log('\n✓ Now navigating to /marketplaces...')
        await page.goto(`${baseUrl}/marketplaces`, { waitUntil: 'networkidle' })
        const newUrl = page.url()
        console.log('   Final URL:', newUrl)

        if (newUrl.includes('login')) {
            console.log('   ❌ Got redirected back to login')
        } else {
            console.log('   ✅ Successfully navigated to marketplaces')
        }

    } catch (error) {
        console.error('\n❌ Error:', error.message)
    } finally {
        if (browser) await browser.close()
    }
}

test()
