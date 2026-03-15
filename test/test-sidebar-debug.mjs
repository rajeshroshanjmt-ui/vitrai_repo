#!/usr/bin/env node
import { chromium } from 'playwright'

const baseUrl = process.env.BASE_URL || 'http://localhost'
const loginEmail = 'testuser@vetrai.com'
const loginPassword = 'Test123!'

async function test() {
    let browser, page

    try {
        console.log('🚀 Debugging sidebar content...\n')
        browser = await chromium.launch()
        page = await browser.newPage()

        console.log('Step 1: Login')
        await page.goto(baseUrl, { waitUntil: 'networkidle' })
        await page.fill('input[type="email"]', loginEmail)
        await page.fill('input[type="password"]', loginPassword)
        await page.click('button:has-text("Sign In")')

        await page.waitForFunction(
            () => !window.location.pathname.includes('login'),
            { timeout: 15000 }
        )
        await page.waitForLoadState('networkidle')
        await page.waitForTimeout(2000)
        console.log('✅ Logged in\n')

        console.log('Step 2: Get sidebar content')
        const sidebarText = await page.evaluate(() => {
            const sidebar = document.querySelector('[class*="Sidebar"], [class*="sidebar"], nav')
            return sidebar ? sidebar.innerText : 'NO SIDEBAR FOUND'
        })

        console.log('Sidebar text:')
        console.log(sidebarText)

        console.log('\nStep 3: List all menu items')
        const menuItems = await page.evaluate(() => {
            const items = []
            document.querySelectorAll('a, button, [role="menuitem"]').forEach((el) => {
                const text = el.textContent?.trim()
                if (text && text.length > 0 && text.length < 50) {
                    items.push({
                        text: text.substring(0, 30),
                        tag: el.tagName,
                        href: el.getAttribute('href') || el.getAttribute('role') || 'no-href'
                    })
                }
            })
            return items
        })

        menuItems.forEach((item, i) => {
            if (i < 30) {
                console.log(`  ${i}: ${item.text.padEnd(20)} [${item.tag}] ${item.href}`)
            }
        })

        console.log(`\n  (showing first 30 of ${menuItems.length} items)`)

        // Check for Users specifically
        const hasUsers = menuItems.some(item => item.text.toLowerCase().includes('user'))
        console.log(`\n  Contains "Users": ${hasUsers ? '✅' : '❌'}`)

        // Check admin section
        const hasAdmin = menuItems.some(item => item.text.includes('ADMIN'))
        console.log(`  Contains "ADMIN": ${hasAdmin ? '✅' : '❌'}`)

    } catch (error) {
        console.error('\n❌ Error:', error.message)
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