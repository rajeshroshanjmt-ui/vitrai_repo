import fs from 'node:fs/promises'
import path from 'node:path'
import { chromium, request } from 'playwright'

const baseUrl = process.env.BASE_URL || 'http://localhost'
const artifactRoot = process.env.ARTIFACT_DIR || 'tmp/test-artifacts'
const screenshotDir = path.join(artifactRoot, 'screens')
const optionalNotFoundPaths = ['/internal-chatmessage/', '/internal-prediction/', '/validation/', '/node-config', '/flow-config/']
const loginEmail = process.env.LOGIN_EMAIL || 'admin@vetrai.com'
const loginPassword = process.env.LOGIN_PASSWORD || 'admin123'

const baseRoutes = [
    { name: 'dashboard', path: '/dashboard' },
    { name: 'chatflows', path: '/chatflows' },
    { name: 'agentflows', path: '/agentflows' },
    { name: 'marketplaces', path: '/marketplaces' },
    { name: 'datasets', path: '/datasets' },
    { name: 'evaluators', path: '/evaluators' },
    { name: 'evaluations', path: '/evaluations' },
    { name: 'assistants', path: '/assistants' },
    { name: 'document_stores', path: '/document-stores' }
]

const flowTypeFromDefinition = (definition = {}) => {
    const explicit = `${definition?.__meta?.flowType || definition?.flowType || definition?.type || ''}`.toUpperCase()
    if (explicit === 'CHATFLOW' || explicit === 'AGENTFLOW' || explicit === 'MULTIAGENT') return explicit
    const nodes = Array.isArray(definition?.nodes) ? definition.nodes : []
    const hasAgentNodes = nodes.some((node) => `${node?.data?.name || ''}`.toLowerCase().includes('agent'))
    return hasAgentNodes ? 'AGENTFLOW' : 'CHATFLOW'
}

const sanitize = (value) => (value || '').replace(/[^a-z0-9_]+/gi, '_').replace(/^_+|_+$/g, '').toLowerCase()

const safeError = (error) => {
    if (!error) return 'Unknown error'
    if (typeof error === 'string') return error
    if (error?.stack) return error.stack
    if (error?.message) return error.message
    return JSON.stringify(error)
}

const relPath = (url) => {
    try {
        return new URL(url).pathname
    } catch {
        return url
    }
}

const fileExists = async (target) => {
    try {
        await fs.access(target)
        return true
    } catch {
        return false
    }
}

const resolveExecutablePath = async () => {
    if (process.env.PLAYWRIGHT_EXECUTABLE_PATH) return process.env.PLAYWRIGHT_EXECUTABLE_PATH

    const candidates = [
        '/root/.cache/ms-playwright/chromium-1169/chrome-linux/chrome',
        '/ms-playwright/chromium-1169/chrome-linux/chrome'
    ]
    for (const candidate of candidates) {
        if (await fileExists(candidate)) return candidate
    }
    return null
}

const nowIso = () => new Date().toISOString()

await fs.mkdir(screenshotDir, { recursive: true })

const executablePath = await resolveExecutablePath()
const browser = await chromium.launch({
    headless: true,
    ...(executablePath ? { executablePath } : {})
})

const context = await browser.newContext({ viewport: { width: 1512, height: 982 } })
const page = await context.newPage()

const pageErrors = []
const consoleEntries = []
const failedRequests = []
const responses = []

page.on('pageerror', (err) => {
    pageErrors.push({ at: nowIso(), url: page.url(), message: safeError(err) })
})

page.on('console', (msg) => {
    consoleEntries.push({
        at: nowIso(),
        url: page.url(),
        type: msg.type(),
        message: msg.text()
    })
})

page.on('requestfailed', (req) => {
    failedRequests.push({
        at: nowIso(),
        pageUrl: page.url(),
        requestUrl: req.url(),
        method: req.method(),
        errorText: req.failure()?.errorText || 'unknown'
    })
})

page.on('response', (res) => {
    const status = res.status()
    if (status >= 400) {
        responses.push({
            at: nowIso(),
            pageUrl: page.url(),
            requestUrl: res.url(),
            method: res.request().method(),
            status
        })
    }
})

const visitRoute = async ({ name, path: routePath, waitMs = 2000 }) => {
    const start = {
        pageErrors: pageErrors.length,
        console: consoleEntries.length,
        failedRequests: failedRequests.length,
        responses: responses.length
    }
    let status = 'ok'
    let navError = null
    const target = `${baseUrl}${routePath}`

    try {
        await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 45000 })
        await page.waitForTimeout(waitMs)
    } catch (error) {
        status = 'navigation_error'
        navError = safeError(error)
    }

    const screenshotName = sanitize(name) || sanitize(routePath) || 'route'
    const screenshotPath = path.join(screenshotDir, `${screenshotName}.png`)
    await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => {})

    return {
        name,
        path: routePath,
        finalUrl: page.url(),
        status,
        navError,
        pageErrors: pageErrors.slice(start.pageErrors),
        consoleEntries: consoleEntries.slice(start.console),
        failedRequests: failedRequests.slice(start.failedRequests),
        responses: responses.slice(start.responses)
    }
}

const runAction = async (name, runner) => {
    try {
        const details = await runner()
        return { name, status: 'passed', details: details || null }
    } catch (error) {
        return { name, status: 'failed', details: { error: safeError(error) } }
    }
}

const maybeClickButton = async (labelRegex) => {
    const button = page.getByRole('button', { name: labelRegex }).first()
    if ((await button.count()) === 0) return false
    await button.click({ timeout: 4000 })
    return true
}

const loginStart = await visitRoute({ name: 'login_resolver', path: '/login', waitMs: 900 })
const loginResolverUrl = page.url()

const usernameInput = page.locator('input[name="username"], input[type="email"]').first()
const passwordInput = page.locator('input[name="password"], input[type="password"]').first()
await usernameInput.fill(loginEmail)
await passwordInput.fill(loginPassword)
await page.getByRole('button', { name: /sign in|login/i }).first().click()
await page.waitForTimeout(2500)

const postLoginUrl = page.url()
const storageState = await page.evaluate(() => ({
    vetrai_access_token: localStorage.getItem('vetrai_access_token'),
    vetrai_tenant_id: localStorage.getItem('vetrai_tenant_id'),
    vetrai_role: localStorage.getItem('vetrai_role')
}))

const authApi = await request.newContext({ baseURL: baseUrl })
const tokenResponse = await authApi.post('/api/auth/token', {
    data: {
        email: loginEmail,
        tenant_id: storageState.vetrai_tenant_id || '00000000-0000-0000-0000-000000000001',
        role: storageState.vetrai_role || 'admin'
    }
})
const tokenPayload = await tokenResponse.json().catch(() => ({}))
const issuedToken = tokenPayload?.access_token || storageState.vetrai_access_token
const meResponse = await authApi.get('/api/auth/me', {
    headers: issuedToken ? { Authorization: `Bearer ${issuedToken}` } : {}
})

const flowResponse = await authApi.get('/api/flows/list?limit=300', {
    headers: issuedToken ? { Authorization: `Bearer ${issuedToken}` } : {}
})
const flowPayload = await flowResponse.json().catch(() => ({}))
const flowItems = Array.isArray(flowPayload?.items) ? flowPayload.items : []
const chatflow = flowItems.find((row) => flowTypeFromDefinition(row?.latest_definition || {}) === 'CHATFLOW')
const agentflow = flowItems.find((row) => flowTypeFromDefinition(row?.latest_definition || {}) === 'AGENTFLOW')

const templateResponse = await authApi.get('/api/resources/marketplace?limit=600&offset=0', {
    headers: issuedToken ? { Authorization: `Bearer ${issuedToken}` } : {}
})
const templatePayload = await templateResponse.json().catch(() => ({}))
const templateItems = Array.isArray(templatePayload?.items) ? templatePayload.items : []
const chatTemplate = templateItems.find((tpl) => tpl?.payload?.type === 'Chatflow')
const agentTemplate = templateItems.find((tpl) => tpl?.payload?.type === 'AgentflowV2')

const routeResults = []
for (const route of baseRoutes) {
    routeResults.push(await visitRoute(route))
}

if (chatflow?.flow_id) {
    routeResults.push(await visitRoute({ name: 'chatflow_canvas', path: `/canvas/${chatflow.flow_id}` }))
}
if (agentflow?.flow_id) {
    routeResults.push(await visitRoute({ name: 'agentflow_v2_canvas', path: `/v2/agentcanvas/${agentflow.flow_id}` }))
}
if (chatTemplate?.resource_id) {
    routeResults.push(await visitRoute({ name: 'marketplace_chat_canvas', path: `/marketplace/${chatTemplate.resource_id}` }))
}
if (agentTemplate?.resource_id) {
    routeResults.push(await visitRoute({ name: 'marketplace_agent_canvas', path: `/v2/marketplace/${agentTemplate.resource_id}` }))
}

const actions = []

actions.push(
    await runAction('chatflows_add_new', async () => {
        await page.goto(`${baseUrl}/chatflows`, { waitUntil: 'domcontentloaded' })
        const clicked = await maybeClickButton(/add new/i)
        await page.waitForTimeout(1200)
        return {
            clicked,
            finalUrl: page.url(),
            landedOnCanvas: page.url().includes('/canvas')
        }
    })
)

actions.push(
    await runAction('chatflow_open_api_dialog', async () => {
        if (!chatflow?.flow_id) throw new Error('No chatflow ID available')
        await page.goto(`${baseUrl}/canvas/${chatflow.flow_id}`, { waitUntil: 'domcontentloaded' })
        await page.waitForTimeout(1500)
        const apiTrigger = page.locator('[title*="Embed in website"], [title*="API"], button:has-text("API")').first()
        const exists = (await apiTrigger.count()) > 0
        if (!exists) return { opened: false, reason: 'trigger_not_found' }
        await apiTrigger.click({ timeout: 4000 })
        await page.waitForTimeout(1000)
        const dialogVisible = (await page.locator('text=Embed in website or use as API').count()) > 0
        await page.keyboard.press('Escape').catch(() => {})
        return { opened: dialogVisible }
    })
)

actions.push(
    await runAction('chatflow_chat_popup', async () => {
        if (!chatflow?.flow_id) throw new Error('No chatflow ID available')
        await page.goto(`${baseUrl}/canvas/${chatflow.flow_id}`, { waitUntil: 'domcontentloaded' })
        await page.waitForTimeout(1500)
        const chatBtn = page.locator('button[title="Chat"]').first()
        if ((await chatBtn.count()) === 0) return { clicked: false, reason: 'chat_button_not_found' }
        await chatBtn.click({ timeout: 4000 })
        await page.waitForTimeout(800)
        const popupVisible = (await page.locator('text=Type your question here').count()) > 0
        return { clicked: true, popupVisible }
    })
)

actions.push(
    await runAction('agentflows_add_new_v2', async () => {
        await page.goto(`${baseUrl}/agentflows`, { waitUntil: 'domcontentloaded' })
        const clicked = await maybeClickButton(/add new/i)
        await page.waitForTimeout(1200)
        return {
            clicked,
            finalUrl: page.url(),
            landedOnAgentCanvas: page.url().includes('/v2/agentcanvas') || page.url().includes('/agentcanvas')
        }
    })
)

actions.push(
    await runAction('marketplace_import_navigation', async () => {
        await page.goto(`${baseUrl}/marketplaces`, { waitUntil: 'domcontentloaded' })
        await page.waitForTimeout(1500)
        if (!chatTemplate?.resource_id && !agentTemplate?.resource_id) {
            return { imported: false, reason: 'no_marketplace_templates' }
        }
        if (chatTemplate?.resource_id) {
            await page.goto(`${baseUrl}/marketplace/${chatTemplate.resource_id}`, { waitUntil: 'domcontentloaded' })
        } else {
            await page.goto(`${baseUrl}/v2/marketplace/${agentTemplate.resource_id}`, { waitUntil: 'domcontentloaded' })
        }
        await page.waitForTimeout(1200)
        return {
            imported: page.url().includes('/marketplace/'),
            finalUrl: page.url()
        }
    })
)

actions.push(
    await runAction('assistants_custom_open', async () => {
        await page.goto(`${baseUrl}/assistants`, { waitUntil: 'domcontentloaded' })
        const customCard = page.getByText(/custom assistant/i).first()
        if ((await customCard.count()) === 0) return { opened: false, reason: 'card_not_found' }
        await customCard.click({ timeout: 4000 })
        await page.waitForTimeout(1000)
        return { opened: page.url().includes('/assistants/custom'), finalUrl: page.url() }
    })
)

actions.push(
    await runAction('document_stores_add_dialog', async () => {
        await page.goto(`${baseUrl}/document-stores`, { waitUntil: 'domcontentloaded' })
        const clicked = await maybeClickButton(/add new/i)
        await page.waitForTimeout(1000)
        const opened = (await page.locator('text=Add New Document Store').count()) > 0
        await page.keyboard.press('Escape').catch(() => {})
        return { clicked, opened }
    })
)

actions.push(
    await runAction('datasets_add_dialog', async () => {
        await page.goto(`${baseUrl}/datasets`, { waitUntil: 'domcontentloaded' })
        const clicked = await maybeClickButton(/add new/i)
        await page.waitForTimeout(900)
        const opened = (await page.locator('text=Dataset').count()) > 0
        await page.keyboard.press('Escape').catch(() => {})
        return { clicked, opened }
    })
)

actions.push(
    await runAction('evaluators_new_dialog', async () => {
        await page.goto(`${baseUrl}/evaluators`, { waitUntil: 'domcontentloaded' })
        const clicked = await maybeClickButton(/new evaluator|add new/i)
        await page.waitForTimeout(900)
        const opened = (await page.locator('text=Evaluator').count()) > 0
        await page.keyboard.press('Escape').catch(() => {})
        return { clicked, opened }
    })
)

actions.push(
    await runAction('evaluations_new_dialog', async () => {
        await page.goto(`${baseUrl}/evaluations`, { waitUntil: 'domcontentloaded' })
        const clicked = await maybeClickButton(/start new evaluation|new evaluation/i)
        await page.waitForTimeout(900)
        const opened = (await page.locator('text=Start New Evaluation').count()) > 0
        await page.keyboard.press('Escape').catch(() => {})
        return { clicked, opened }
    })
)

await authApi.dispose()
await browser.close()

const response404 = responses.filter((item) => item.status === 404)
const optional404 = response404.filter((item) => optionalNotFoundPaths.some((pattern) => item.requestUrl.includes(pattern)))
const nonOptional404 = response404.filter((item) => !optionalNotFoundPaths.some((pattern) => item.requestUrl.includes(pattern)))
const consoleErrors = consoleEntries.filter((entry) => entry.type === 'error')
const consoleWarnings = consoleEntries.filter((entry) => entry.type === 'warning')

const summary = {
    generatedAt: nowIso(),
    baseUrl,
    executablePath: executablePath || null,
    login: {
        resolverRouteFinalUrl: loginResolverUrl,
        postLoginUrl,
        resolverReachedSignIn: loginResolverUrl.includes('/signin') || loginResolverUrl.includes('/login'),
        localStorage: {
            hasAccessToken: Boolean(storageState.vetrai_access_token),
            hasTenantId: Boolean(storageState.vetrai_tenant_id),
            hasRole: Boolean(storageState.vetrai_role)
        },
        authChain: {
            tokenStatus: tokenResponse.status(),
            meStatus: meResponse.status()
        }
    },
    dataSetup: {
        detectedChatflowId: chatflow?.flow_id || null,
        detectedAgentflowId: agentflow?.flow_id || null,
        detectedMarketplaceChatTemplate: chatTemplate?.resource_id || null,
        detectedMarketplaceAgentTemplate: agentTemplate?.resource_id || null
    },
    metrics: {
        totalRoutes: routeResults.length,
        routesWithNavErrors: routeResults.filter((r) => r.status !== 'ok').length,
        routesWithPageErrors: routeResults.filter((r) => r.pageErrors.length > 0).length,
        routesWithConsoleErrors: routeResults.filter((r) => r.consoleEntries.some((e) => e.type === 'error')).length,
        routesWithHttp4xx5xx: routeResults.filter((r) => r.responses.length > 0).length,
        totalPageErrors: pageErrors.length,
        totalConsoleErrors: consoleErrors.length,
        totalConsoleWarnings: consoleWarnings.length,
        totalFailedRequests: failedRequests.length,
        total4xx5xxResponses: responses.length,
        optional404Count: optional404.length,
        nonOptional404Count: nonOptional404.length,
        actionFailures: actions.filter((action) => action.status !== 'passed').length
    },
    routeResults,
    actions,
    failures: {
        pageErrors,
        consoleErrors,
        consoleWarnings,
        failedRequests,
        responses,
        optional404,
        nonOptional404
    },
    classifications: {
        crash: [...pageErrors, ...consoleErrors.filter((entry) => /uncaught|typeerror|referenceerror/i.test(entry.message))],
        blocking: [
            ...routeResults.filter((route) => route.status !== 'ok'),
            ...actions.filter((action) => action.status !== 'passed'),
            ...nonOptional404
        ],
        nonBlockingWarning: [...consoleWarnings, ...optional404]
    },
    notes: [
        '404 responses under optional OSS compatibility endpoints are classified as non-blocking unless paired with runtime crashes.',
        'Action failures can be due to UI label drift; route-level stability and runtime crash status remain primary gates.'
    ],
    artifacts: {
        screenshotDir
    }
}

console.log(JSON.stringify(summary, null, 2))
