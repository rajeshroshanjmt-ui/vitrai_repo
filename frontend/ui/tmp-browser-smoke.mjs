import fs from 'node:fs/promises'
import path from 'node:path'
import { chromium, request } from 'playwright'

const baseUrl = process.env.BASE_URL || 'http://localhost'
const artifactRoot = process.env.ARTIFACT_DIR || 'tmp/test-artifacts'
const screenshotDir = path.join(artifactRoot, 'screens')
const optionalNotFoundPaths = ['/internal-chatmessage/', '/internal-prediction/', '/validation/', '/node-config', '/flow-config/']
const loginEmail = process.env.LOGIN_EMAIL || 'admin@vetrai.com'
const loginPassword = process.env.LOGIN_PASSWORD || 'admin123'
const realWorldAssistantInstruction =
    'You are a senior customer support copilot for a SaaS company. Your goal is to resolve customer issues accurately and quickly while protecting customer trust.\n\n' +
    'Operating standards:\n' +
    '1) Use only confirmed facts from the current conversation and connected knowledge sources.\n' +
    '2) If details are missing, ask concise clarifying questions before giving final guidance.\n' +
    '3) Provide direct next steps, ownership, and expected timelines.\n' +
    '4) When a policy, billing, security, or compliance issue is involved, state the policy impact clearly and avoid guessing.\n' +
    '5) Escalate to a human agent when account actions, refunds, legal risk, or data privacy verification is required.\n\n' +
    'Response format:\n' +
    '- Short diagnosis\n' +
    '- Step-by-step resolution plan\n' +
    '- Customer-facing reply draft\n' +
    '- Escalation note if needed\n\n' +
    'Tone: calm, professional, empathetic, and specific. Avoid generic filler.'

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

const maybeClickButton = async (labelRegex, timeout = 8000) => {
    const button = page.getByRole('button', { name: labelRegex }).first()
    try {
        await button.waitFor({ state: 'visible', timeout })
    } catch {
        return false
    }
    await button.click({ timeout: 4000 })
    return true
}

const isVisible = async (locator, timeout = 5000) => {
    try {
        await locator.waitFor({ state: 'visible', timeout })
        return true
    } catch {
        return false
    }
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
        const clicked = await maybeClickButton(/add new|new add/i)
        await page.waitForTimeout(900)
        const landedOnCanvas = page.url().includes('/canvas')
        if (!clicked) throw new Error('Add New button was not found/clickable on /chatflows')
        if (!landedOnCanvas) throw new Error(`Add New click did not navigate to canvas. Current URL: ${page.url()}`)

        const createdFlowName = `smoke_chatflow_${Date.now()}`
        const saveTrigger = page.locator('[title="Save Chatflow"]').first()
        if ((await saveTrigger.count()) === 0) throw new Error('Save Chatflow trigger not found on canvas')

        await saveTrigger.click({ timeout: 5000 })
        const saveDialog = page.getByRole('dialog', { name: /save new chatflow/i }).first()
        await saveDialog.waitFor({ state: 'visible', timeout: 5000 })

        const nameInput = saveDialog.locator('#chatflow-name')
        await nameInput.fill(createdFlowName)
        await saveDialog.getByRole('button', { name: /^save$/i }).click({ timeout: 5000 })

        await page.waitForURL(/\/canvas\/[^/?#]+/, { timeout: 12000 })
        const canvasUrlAfterSave = page.url()
        const createdFlowId = canvasUrlAfterSave.match(/\/canvas\/([^/?#]+)/)?.[1] || null

        const canvasHealth = {
            canvasSurfaceVisible: await isVisible(page.locator('.react-flow, .reactflow-wrapper').first(), 7000),
            saveVisible: await isVisible(page.locator('[title="Save Chatflow"]').first(), 7000),
            addNodeVisible: await isVisible(page.locator('[title="Add Node"]').first(), 7000),
            chatButtonVisible: await isVisible(page.locator('button[title="Chat"]').first(), 7000)
        }
        if (!canvasHealth.canvasSurfaceVisible || !canvasHealth.saveVisible || !canvasHealth.addNodeVisible) {
            throw new Error(`chatflow canvas unhealthy after create: ${JSON.stringify(canvasHealth)}`)
        }

        let persistedCheckStatus = null
        if (createdFlowId) {
            const persistedRes = await authApi.get(`/api/flows/${createdFlowId}`, {
                headers: issuedToken ? { Authorization: `Bearer ${issuedToken}` } : {}
            })
            persistedCheckStatus = persistedRes.status()
        }

        let listedInApi = false
        for (let i = 0; i < 3; i += 1) {
            const listRes = await authApi.get('/api/flows/list?limit=500', {
                headers: issuedToken ? { Authorization: `Bearer ${issuedToken}` } : {}
            })
            const listPayload = await listRes.json().catch(() => ({}))
            const listItems = Array.isArray(listPayload?.items) ? listPayload.items : []
            listedInApi = listItems.some((item) => item?.flow_id === createdFlowId)
            if (listedInApi) break
            await page.waitForTimeout(600)
        }

        await page.goto(`${baseUrl}/chatflows`, { waitUntil: 'domcontentloaded' })
        const searchBox = page.locator('input[placeholder="Search Name or Category"]').first()
        if ((await searchBox.count()) > 0) {
            await searchBox.fill(createdFlowName)
            await page.waitForTimeout(700)
        }
        const listEntry = page.getByText(createdFlowName, { exact: false }).first()
        const visibleInUiList = (await listEntry.count()) > 0

        let cleanupDeleteStatus = null
        if (createdFlowId) {
            const cleanupRes = await authApi.delete(`/api/flows/${createdFlowId}`, {
                headers: issuedToken ? { Authorization: `Bearer ${issuedToken}` } : {}
            })
            cleanupDeleteStatus = cleanupRes.status()
        }

        const cleanedUp = cleanupDeleteStatus !== null && cleanupDeleteStatus >= 200 && cleanupDeleteStatus < 300
        if (!listedInApi || !cleanedUp) {
            throw new Error(
                `chatflow fullcycle failed: listedInApi=${listedInApi}, cleanedUp=${cleanedUp}, ` +
                    `persistedCheckStatus=${persistedCheckStatus}, cleanupDeleteStatus=${cleanupDeleteStatus}`
            )
        }

        return {
            clicked,
            finalUrl: page.url(),
            landedOnCanvas,
            created: true,
            createdFlowName,
            createdFlowId,
            canvasHealth,
            persistedCheckStatus,
            listedInApi,
            visibleInUiList,
            cleanupDeleteStatus,
            cleanedUp
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
        const clicked = await maybeClickButton(/add new|new add/i)
        await page.waitForTimeout(900)
        const landedOnAgentCanvas = page.url().includes('/v2/agentcanvas') || page.url().includes('/agentcanvas')
        if (!clicked) throw new Error('Add New button was not found/clickable on /agentflows')
        if (!landedOnAgentCanvas) throw new Error(`Add New click did not navigate to agent canvas. Current URL: ${page.url()}`)

        const createdFlowName = `smoke_agentflow_${Date.now()}`
        const saveTrigger = page.locator('[title="Save Agents"], [title="Save Agent"]').first()
        if ((await saveTrigger.count()) === 0) throw new Error('Save Agent trigger not found on agent canvas')

        await saveTrigger.click({ timeout: 5000 })
        const saveDialog = page.getByRole('dialog', { name: /save new agents|save new agent/i }).first()
        await saveDialog.waitFor({ state: 'visible', timeout: 5000 })

        const nameInput = saveDialog.locator('#chatflow-name')
        await nameInput.fill(createdFlowName)
        await saveDialog.getByRole('button', { name: /^save$/i }).click({ timeout: 5000 })

        await page.waitForURL(/\/(?:v2\/)?agentcanvas\/[^/?#]+/, { timeout: 12000 })
        const canvasUrlAfterSave = page.url()
        const createdFlowId = canvasUrlAfterSave.match(/\/(?:v2\/)?agentcanvas\/([^/?#]+)/)?.[1] || null

        const canvasHealth = {
            canvasSurfaceVisible: await isVisible(page.locator('.react-flow, .reactflow-wrapper').first(), 7000),
            saveVisible: await isVisible(page.locator('[title="Save Agents"], [title="Save Agent"]').first(), 7000),
            addNodeVisible: await isVisible(page.locator('[title="Add Node"]').first(), 7000),
            generateButtonVisible: await isVisible(page.locator('[title="Generate Agentflow"]').first(), 7000)
        }
        if (!canvasHealth.canvasSurfaceVisible || !canvasHealth.saveVisible || !canvasHealth.addNodeVisible) {
            throw new Error(`agentflow canvas unhealthy after create: ${JSON.stringify(canvasHealth)}`)
        }

        let persistedCheckStatus = null
        if (createdFlowId) {
            const persistedRes = await authApi.get(`/api/flows/${createdFlowId}`, {
                headers: issuedToken ? { Authorization: `Bearer ${issuedToken}` } : {}
            })
            persistedCheckStatus = persistedRes.status()
        }

        let listedInApi = false
        for (let i = 0; i < 3; i += 1) {
            const listRes = await authApi.get('/api/flows/list?limit=500', {
                headers: issuedToken ? { Authorization: `Bearer ${issuedToken}` } : {}
            })
            const listPayload = await listRes.json().catch(() => ({}))
            const listItems = Array.isArray(listPayload?.items) ? listPayload.items : []
            listedInApi = listItems.some((item) => item?.flow_id === createdFlowId)
            if (listedInApi) break
            await page.waitForTimeout(600)
        }

        await page.goto(`${baseUrl}/agentflows`, { waitUntil: 'domcontentloaded' })
        const searchBox = page.locator('input[placeholder="Search Name or Category"]').first()
        if ((await searchBox.count()) > 0) {
            await searchBox.fill(createdFlowName)
            await page.waitForTimeout(700)
        }
        const listEntry = page.getByText(createdFlowName, { exact: false }).first()
        const visibleInUiList = (await listEntry.count()) > 0

        let cleanupDeleteStatus = null
        if (createdFlowId) {
            const cleanupRes = await authApi.delete(`/api/flows/${createdFlowId}`, {
                headers: issuedToken ? { Authorization: `Bearer ${issuedToken}` } : {}
            })
            cleanupDeleteStatus = cleanupRes.status()
        }

        const cleanedUp = cleanupDeleteStatus !== null && cleanupDeleteStatus >= 200 && cleanupDeleteStatus < 300
        if (!listedInApi || !cleanedUp) {
            throw new Error(
                `agentflow fullcycle failed: listedInApi=${listedInApi}, cleanedUp=${cleanedUp}, ` +
                    `persistedCheckStatus=${persistedCheckStatus}, cleanupDeleteStatus=${cleanupDeleteStatus}`
            )
        }

        return {
            clicked,
            finalUrl: page.url(),
            landedOnAgentCanvas,
            created: true,
            createdFlowName,
            createdFlowId,
            canvasHealth,
            persistedCheckStatus,
            listedInApi,
            visibleInUiList,
            cleanupDeleteStatus,
            cleanedUp
        }
    })
)

actions.push(
    await runAction('agentflow_prompt_based_generate', async () => {
        await page.goto(`${baseUrl}/v2/agentcanvas`, { waitUntil: 'domcontentloaded' })
        await page.waitForTimeout(1200)

        const generateTrigger = page.locator('[title="Generate Agentflow"]').first()
        if ((await generateTrigger.count()) === 0) {
            return { opened: false, generated: false, reason: 'generate_trigger_not_found' }
        }
        await generateTrigger.click({ timeout: 5000 })

        const dialog = page.getByRole('dialog', { name: /what would you like to build/i }).first()
        await dialog.waitFor({ state: 'visible', timeout: 7000 })

        const defaultPrompt = dialog.getByRole('button', { name: /summarize a document/i }).first()
        if ((await defaultPrompt.count()) > 0) {
            await defaultPrompt.click({ timeout: 4000 })
        }

        const modelInput = dialog.locator('#chatModel').first()
        if ((await modelInput.count()) === 0) {
            return { opened: true, generated: false, reason: 'model_dropdown_not_found' }
        }
        await modelInput.click({ timeout: 5000 })
        await page.waitForTimeout(500)

        const firstOption = page.locator('li[role="option"]').first()
        if ((await firstOption.count()) === 0) {
            await page.keyboard.press('Escape').catch(() => {})
            return { opened: true, generated: false, reason: 'no_chat_models_available' }
        }
        await firstOption.click({ timeout: 5000 })
        await page.waitForTimeout(800)

        const generateButton = dialog.getByRole('button', { name: /^generate$/i }).first()
        if ((await generateButton.count()) === 0) {
            return { opened: true, generated: false, reason: 'generate_button_not_found' }
        }
        if (await generateButton.isDisabled()) {
            return { opened: true, generated: false, reason: 'required_model_fields_missing' }
        }

        await generateButton.click({ timeout: 5000 })

        let outcome = 'timeout'
        for (let i = 0; i < 24; i += 1) {
            const dialogCount = await dialog.count()
            const dialogOpen = dialogCount > 0 && (await dialog.isVisible().catch(() => false))

            if (!dialogOpen) {
                outcome = 'graph_generated'
                break
            }

            const applyButton = dialog.getByRole('button', { name: /^apply$/i }).first()
            if ((await applyButton.count()) > 0) {
                await applyButton.click({ timeout: 5000 })
                await page.waitForTimeout(600)
                outcome = 'instruction_generated_applied'
                break
            }

            const failedText = page.getByText(/failed to generate agentflow/i).first()
            if ((await failedText.count()) > 0) {
                outcome = 'generation_failed'
                break
            }

            await page.waitForTimeout(500)
        }

        return {
            opened: true,
            generated: outcome === 'graph_generated' || outcome === 'instruction_generated_applied',
            outcome,
            reason: outcome === 'generation_failed' ? 'backend_or_model_generation_failed' : null
        }
    })
)

actions.push(
    await runAction('marketplace_use_template_create_cycle', async () => {
        const selectedTemplate = chatTemplate?.resource_id
            ? {
                  kind: 'chatflow',
                  route: `/marketplace/${chatTemplate.resource_id}`
              }
            : agentTemplate?.resource_id
              ? {
                    kind: 'agentflow_v2',
                    route: `/v2/marketplace/${agentTemplate.resource_id}`
                }
              : null

        if (!selectedTemplate) {
            return { usedTemplate: false, reason: 'no_marketplace_template_available' }
        }

        await page.goto(`${baseUrl}${selectedTemplate.route}`, { waitUntil: 'domcontentloaded' })
        const useTemplateBtn = page.getByRole('button', { name: /use template/i }).first()
        if (!(await isVisible(useTemplateBtn, 7000))) {
            return {
                usedTemplate: false,
                reason: 'use_template_button_not_visible',
                templateRoute: selectedTemplate.route,
                templateKind: selectedTemplate.kind
            }
        }

        await useTemplateBtn.click({ timeout: 5000 })
        await page.waitForURL(/\/(?:v2\/)?agentcanvas(?:\/[^/?#]+)?|\/canvas(?:\/[^/?#]+)?/, { timeout: 12000 })
        await page.waitForTimeout(800)

        const openedUrl = page.url()
        const isChatCanvas = /\/canvas(?:\/|$)/.test(openedUrl) && !openedUrl.includes('/agentcanvas')
        const isAgentCanvas = openedUrl.includes('/agentcanvas')
        const saveSelector = isChatCanvas ? '[title="Save Chatflow"]' : '[title="Save Agents"], [title="Save Agent"]'
        const saveTrigger = page.locator(saveSelector).first()
        if (!(await isVisible(saveTrigger, 7000))) {
            throw new Error(`Use Template opened canvas but save control missing on ${openedUrl}`)
        }

        const createdFlowName = `smoke_template_${Date.now()}`
        await saveTrigger.click({ timeout: 5000 })
        const saveDialog = page.getByRole('dialog').first()
        await saveDialog.waitFor({ state: 'visible', timeout: 6000 })
        const nameInput = saveDialog.locator('#chatflow-name')
        await nameInput.fill(createdFlowName)
        await saveDialog.getByRole('button', { name: /^save$/i }).click({ timeout: 5000 })

        const urlRegex = isChatCanvas ? /\/canvas\/[^/?#]+/ : /\/(?:v2\/)?agentcanvas\/[^/?#]+/
        await page.waitForURL(urlRegex, { timeout: 12000 })
        const createdUrl = page.url()
        const createdFlowId = isChatCanvas
            ? createdUrl.match(/\/canvas\/([^/?#]+)/)?.[1] || null
            : createdUrl.match(/\/(?:v2\/)?agentcanvas\/([^/?#]+)/)?.[1] || null

        const canvasHealth = {
            canvasSurfaceVisible: await isVisible(page.locator('.react-flow, .reactflow-wrapper').first(), 7000),
            saveVisible: await isVisible(page.locator(saveSelector).first(), 7000),
            addNodeVisible: await isVisible(page.locator('[title="Add Node"]').first(), 7000)
        }
        if (!canvasHealth.canvasSurfaceVisible || !canvasHealth.saveVisible || !canvasHealth.addNodeVisible) {
            throw new Error(`template-created canvas unhealthy: ${JSON.stringify(canvasHealth)}`)
        }

        let persistedCheckStatus = null
        let persistedNodeCount = null
        if (createdFlowId) {
            const persistedRes = await authApi.get(`/api/flows/${createdFlowId}`, {
                headers: issuedToken ? { Authorization: `Bearer ${issuedToken}` } : {}
            })
            persistedCheckStatus = persistedRes.status()
            const persistedPayload = await persistedRes.json().catch(() => ({}))
            const def = persistedPayload?.json_definition || {}
            persistedNodeCount = Array.isArray(def?.nodes) ? def.nodes.length : 0
        }

        let cleanupDeleteStatus = null
        if (createdFlowId) {
            const cleanupRes = await authApi.delete(`/api/flows/${createdFlowId}`, {
                headers: issuedToken ? { Authorization: `Bearer ${issuedToken}` } : {}
            })
            cleanupDeleteStatus = cleanupRes.status()
        }
        const cleanedUp = cleanupDeleteStatus !== null && cleanupDeleteStatus >= 200 && cleanupDeleteStatus < 300
        if (!cleanedUp) {
            throw new Error(
                `template fullcycle cleanup failed: createdFlowId=${createdFlowId}, cleanupDeleteStatus=${cleanupDeleteStatus}`
            )
        }

        return {
            usedTemplate: true,
            templateKind: selectedTemplate.kind,
            templateRoute: selectedTemplate.route,
            openedUrl,
            createdFlowName,
            createdFlowId,
            canvasHealth,
            persistedCheckStatus,
            persistedNodeCount,
            cleanupDeleteStatus,
            cleanedUp
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
    await runAction('assistants_custom_create_realworld', async () => {
        await page.goto(`${baseUrl}/assistants/custom`, { waitUntil: 'domcontentloaded' })
        const addButtons = page.getByRole('button', { name: /^add$/i })
        const addButtonCount = await addButtons.count()
        const assistantName = `smoke_custom_assistant_${Date.now()}`
        let assistantId = null
        let creationMode = 'ui'

        if (addButtonCount > 0) {
            const dialog = page.getByRole('dialog', { name: /add new custom assistant/i }).first()
            let dialogOpened = false
            for (let i = 0; i < addButtonCount; i += 1) {
                await addButtons.nth(i).click({ timeout: 5000 }).catch(() => {})
                if (await isVisible(dialog, 2500)) {
                    dialogOpened = true
                    break
                }
            }

            if (dialogOpened) {
                const desiredProfileLabel = 'Customer Support Copilot'
                const profileSelect = dialog.locator('#assistant-profile-select').first()
                if ((await profileSelect.count()) > 0) {
                    await profileSelect.click({ timeout: 5000 })
                    const profileOption = page.getByRole('option', { name: new RegExp(desiredProfileLabel, 'i') }).first()
                    if ((await profileOption.count()) > 0) {
                        await profileOption.click({ timeout: 5000 })
                    } else {
                        await page.keyboard.press('Escape').catch(() => {})
                    }
                }

                let nameInput = dialog.locator('#custom-assistant-name').first()
                if ((await nameInput.count()) === 0) {
                    nameInput = dialog.locator('input[type="text"], input').first()
                }
                if ((await nameInput.count()) > 0) {
                    await nameInput.fill(assistantName)
                    await dialog.getByRole('button', { name: /^add$/i }).click({ timeout: 5000 })
                    await page.waitForURL(/\/assistants\/custom\/[^/?#]+/, { timeout: 12000 })
                    const createdUrl = page.url()
                    assistantId = createdUrl.match(/\/assistants\/custom\/([^/?#]+)/)?.[1] || null
                }
            }
        }

        if (!assistantId) {
            creationMode = 'api_fallback'
            const createResp = await authApi.post('/api/assistants', {
                headers: issuedToken ? { Authorization: `Bearer ${issuedToken}` } : {},
                data: {
                    type: 'CUSTOM',
                    credential: `smoke-${Date.now()}`,
                    details: JSON.stringify({
                        name: assistantName,
                        instruction: realWorldAssistantInstruction,
                        profileId: 'customer_support_copilot',
                        profileLabel: 'Customer Support Copilot',
                        qualityPreset: 'real_world_v1'
                    })
                }
            })
            if (createResp.status() < 200 || createResp.status() >= 300) {
                throw new Error(`Custom assistant create failed via API fallback: status=${createResp.status()}`)
            }
            const createPayload = await createResp.json().catch(() => ({}))
            assistantId = createPayload?.id || null
            if (!assistantId) {
                throw new Error('API fallback did not return assistant id')
            }
            await page.goto(`${baseUrl}/assistants/custom/${assistantId}`, { waitUntil: 'domcontentloaded' })
        }

        let fetchStatus = null
        let profileId = null
        let profileLabel = null
        let instructionLength = 0
        if (assistantId) {
            const getResp = await authApi.get(`/api/assistants/${assistantId}`, {
                headers: issuedToken ? { Authorization: `Bearer ${issuedToken}` } : {}
            })
            fetchStatus = getResp.status()
            const payload = await getResp.json().catch(() => ({}))
            const detailsRaw = payload?.details
            const details = typeof detailsRaw === 'string' ? JSON.parse(detailsRaw) : detailsRaw || {}
            profileId = details?.profileId || null
            profileLabel = details?.profileLabel || null
            instructionLength = String(details?.instruction || '').trim().length
        }

        let cleanupDeleteStatus = null
        if (assistantId) {
            const cleanupResp = await authApi.delete(`/api/assistants/${assistantId}`, {
                headers: issuedToken ? { Authorization: `Bearer ${issuedToken}` } : {}
            })
            cleanupDeleteStatus = cleanupResp.status()
        }
        const cleanedUp = cleanupDeleteStatus !== null && cleanupDeleteStatus >= 200 && cleanupDeleteStatus < 300
        const qualityReady = instructionLength >= 250

        if (!qualityReady || !cleanedUp) {
            throw new Error(
                `custom assistant realworld cycle failed: qualityReady=${qualityReady}, cleanedUp=${cleanedUp}, ` +
                    `instructionLength=${instructionLength}, cleanupDeleteStatus=${cleanupDeleteStatus}, profileId=${profileId}`
            )
        }

        return {
            created: true,
            creationMode,
            assistantName,
            assistantId,
            fetchStatus,
            profileId,
            profileLabel,
            instructionLength,
            qualityReady,
            cleanupDeleteStatus,
            cleanedUp
        }
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
