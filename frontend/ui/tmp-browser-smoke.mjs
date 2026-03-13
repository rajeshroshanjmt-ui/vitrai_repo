import fs from 'node:fs/promises'
import path from 'node:path'
import { chromium, request } from 'playwright'

const baseUrl = process.env.BASE_URL || 'http://localhost'
const artifactRoot = process.env.ARTIFACT_DIR || 'tmp/test-artifacts'
const screenshotDir = path.join(artifactRoot, 'screens')
const optionalNotFoundPaths = [
    '/internal-chatmessage/',
    '/internal-prediction/',
    '/validation/',
    '/node-config',
    '/flow-config/',
    '/chatflows-streaming/',
    '/public-chatbotConfig/',
    '/components-credentials-icon/'
]
const loginEmail = process.env.LOGIN_EMAIL || 'admin@vetrai.com'
const loginPassword = process.env.LOGIN_PASSWORD || 'admin123'
const defaultTenantId = process.env.TENANT_ID || '00000000-0000-0000-0000-000000000001'
const defaultRole = process.env.ROLE || 'admin'

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

const authenticatedRoutes = [
    { name: 'dashboard', path: '/dashboard' },
    { name: 'chatflows', path: '/chatflows' },
    { name: 'agentflows', path: '/agentflows' },
    { name: 'executions', path: '/executions' },
    { name: 'marketplaces', path: '/marketplaces' },
    { name: 'apikey', path: '/apikey' },
    { name: 'tools', path: '/tools' },
    { name: 'assistants', path: '/assistants' },
    { name: 'assistants_custom', path: '/assistants/custom' },
    { name: 'assistants_openai', path: '/assistants/openai' },
    { name: 'assistants_azure', path: '/assistants/azure' },
    { name: 'credentials', path: '/credentials' },
    { name: 'variables', path: '/variables' },
    { name: 'document_stores', path: '/document-stores' },
    { name: 'datasets', path: '/datasets' },
    { name: 'evaluators', path: '/evaluators' },
    { name: 'evaluations', path: '/evaluations' },
    { name: 'logs', path: '/logs' },
    { name: 'files', path: '/files' },
    { name: 'account', path: '/account' },
    { name: 'documentation', path: '/documentation' },
    { name: 'sso_success', path: '/sso-success' },
    { name: 'canvas_new', path: '/canvas' },
    { name: 'agentcanvas_new', path: '/agentcanvas' },
    { name: 'agentcanvas_v2_new', path: '/v2/agentcanvas' },
    { name: 'users', path: '/users', expectFinalPath: '/unauthorized' },
    { name: 'roles', path: '/roles', expectFinalPath: '/unauthorized' },
    { name: 'login_activity', path: '/login-activity', expectFinalPath: '/unauthorized' },
    { name: 'workspaces', path: '/workspaces', expectFinalPath: '/unauthorized' },
    { name: 'sso_config', path: '/sso-config', expectFinalPath: '/unauthorized' },
    { name: 'workspace_users', path: `/workspace-users/${defaultTenantId}`, expectFinalPath: '/unauthorized' }
]

const authRoutes = [
    { name: 'auth_login', path: '/login' },
    { name: 'auth_signin', path: '/signin' },
    { name: 'auth_register', path: '/register' },
    { name: 'auth_verify', path: '/verify' },
    { name: 'auth_forgot_password', path: '/forgot-password' },
    { name: 'auth_reset_password', path: '/reset-password' },
    { name: 'auth_unauthorized', path: '/unauthorized' },
    { name: 'auth_rate_limited', path: '/rate-limited' },
    { name: 'auth_organization_setup', path: '/organization-setup' },
    { name: 'auth_license_expired', path: '/license-expired' }
]

const cleanupTasks = []

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

const isOptionalNoise = (value = '') => optionalNotFoundPaths.some((pattern) => `${value}`.includes(pattern))

const usesAgentflowV2Types = (definition = {}) => {
    const nodes = Array.isArray(definition?.nodes) ? definition.nodes : []
    const edges = Array.isArray(definition?.edges) ? definition.edges : []
    return (
        nodes.some((node) => `${node?.type || ''}`.toLowerCase() === 'agentflow') ||
        edges.some((edge) => `${edge?.type || ''}`.toLowerCase() === 'agentflow')
    )
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

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const ensure = (condition, message) => {
    if (!condition) throw new Error(message)
}

const registerCleanup = (name, cleanupFn) => {
    cleanupTasks.push({ name, cleanupFn })
}

const isTransientNetworkFailure = (errorText = '') => {
    const text = String(errorText || '').toLowerCase()
    return text.includes('econnrefused') || text.includes('502') || text.includes('bad gateway')
}

const runCleanupTasks = async () => {
    const results = []
    while (cleanupTasks.length) {
        const task = cleanupTasks.pop()
        let completed = false
        let lastError = null

        for (let attempt = 1; attempt <= 5; attempt += 1) {
            try {
                await task.cleanupFn()
                results.push({ name: task.name, status: 'ok', attempts: attempt })
                completed = true
                break
            } catch (error) {
                lastError = safeError(error)
                if (attempt < 5 && isTransientNetworkFailure(lastError)) {
                    await delay(1000)
                    continue
                }
                break
            }
        }

        if (!completed) {
            results.push({ name: task.name, status: 'failed', error: lastError || 'Unknown cleanup failure' })
        }
    }
    return results
}

const waitForStartup = async () => {
    const startupApi = await request.newContext({ baseURL: baseUrl })
    let lastError = null
    let stablePasses = 0

    for (let attempt = 1; attempt <= 90; attempt += 1) {
        try {
            const health = await startupApi.get('/api/health')
            const ready = await startupApi.get('/api/health/ready')
            const loginPage = await startupApi.get('/login')
            const rootPage = await startupApi.get('/')

            const backendHealthy = health.status() === 200 && ready.status() === 200
            const frontendHealthy = loginPage.status() >= 200 && loginPage.status() < 500 && rootPage.status() >= 200 && rootPage.status() < 500

            if (backendHealthy && frontendHealthy) {
                stablePasses += 1
            } else {
                stablePasses = 0
            }

            if (stablePasses >= 3) {
                await startupApi.dispose()
                return { attempts: attempt, stablePasses }
            }

            lastError = `health=${health.status()} ready=${ready.status()} login=${loginPage.status()} root=${rootPage.status()} stable=${stablePasses}`
        } catch (error) {
            stablePasses = 0
            lastError = safeError(error)
        }
        await delay(1500)
    }

    await startupApi.dispose()
    throw new Error(`Startup stabilization failed: ${lastError}`)
}

const createMinimalChatflowDefinition = (name = 'Smoke Chatflow') => ({
    __meta: { flowType: 'CHATFLOW', smokeGenerated: true },
    nodes: [
        {
            id: 'prompt_0',
            type: 'customNode',
            position: { x: 120, y: 140 },
            data: {
                id: 'prompt_0',
                name: 'promptTemplate',
                label: 'Prompt',
                inputParams: [{ label: 'Template', name: 'template', type: 'string', optional: false }],
                inputAnchors: [],
                outputAnchors: [{ id: 'prompt_0-output-prompt-PromptTemplate', name: 'prompt', label: 'Prompt', type: 'PromptTemplate' }],
                inputs: { template: `${name} prompt` },
                outputs: {}
            }
        },
        {
            id: 'llm_0',
            type: 'customNode',
            position: { x: 420, y: 140 },
            data: {
                id: 'llm_0',
                name: 'ollamaChat',
                label: 'Ollama Chat',
                inputParams: [{ label: 'Model', name: 'model', type: 'string', optional: false }],
                inputAnchors: [{ id: 'llm_0-input-prompt-PromptTemplate', label: 'Prompt', name: 'prompt', type: 'PromptTemplate' }],
                outputAnchors: [{ id: 'llm_0-output-chatModel-ChatModel', name: 'chatModel', label: 'Chat Model', type: 'ChatModel' }],
                inputs: { model: 'llama3.2', prompt: '{{prompt_0.data.instance}}' },
                outputs: {}
            }
        }
    ],
    edges: [
        {
            source: 'prompt_0',
            sourceHandle: 'prompt_0-output-prompt-PromptTemplate',
            target: 'llm_0',
            targetHandle: 'llm_0-input-prompt-PromptTemplate',
            type: 'buttonedge',
            id: 'prompt_0-prompt_0-output-prompt-PromptTemplate-llm_0-llm_0-input-prompt-PromptTemplate'
        }
    ]
})

const createMinimalAgentflowDefinition = (name = 'Smoke Agentflow') => ({
    __meta: { flowType: 'AGENTFLOW', smokeGenerated: true },
    nodes: [
        {
            id: 'start_0',
            type: 'agentFlow',
            position: { x: 120, y: 180 },
            data: {
                id: 'start_0',
                name: 'startAgentflow',
                label: 'Start',
                color: '#7EE787',
                inputParams: [],
                inputAnchors: [],
                outputAnchors: [{ id: 'start_0-output-0', label: 'Start', name: 'startAgentflow' }],
                inputs: {},
                outputs: {}
            }
        },
        {
            id: 'llm_0',
            type: 'agentFlow',
            position: { x: 420, y: 180 },
            data: {
                id: 'llm_0',
                name: 'llmAgentflow',
                label: 'LLM',
                color: '#64B5F6',
                inputParams: [{ label: 'Instruction', name: 'instruction', type: 'string', optional: true }],
                inputAnchors: [],
                outputAnchors: [{ id: 'llm_0-output-0', label: 'LLM', name: 'llmAgentflow' }],
                inputs: { instruction: `${name} instruction` },
                outputs: {}
            }
        },
        {
            id: 'reply_0',
            type: 'agentFlow',
            position: { x: 720, y: 180 },
            data: {
                id: 'reply_0',
                name: 'directReplyAgentflow',
                label: 'Reply',
                color: '#4DDBBB',
                inputParams: [],
                inputAnchors: [],
                outputAnchors: [],
                inputs: {},
                outputs: {}
            }
        }
    ],
    edges: [
        {
            source: 'start_0',
            sourceHandle: 'start_0-output-0',
            target: 'llm_0',
            targetHandle: 'llm_0',
            type: 'agentFlow',
            id: 'start_0-start_0-output-0-llm_0-llm_0',
            data: { sourceColor: '#7EE787', targetColor: '#64B5F6' }
        },
        {
            source: 'llm_0',
            sourceHandle: 'llm_0-output-0',
            target: 'reply_0',
            targetHandle: 'reply_0',
            type: 'agentFlow',
            id: 'llm_0-llm_0-output-0-reply_0-reply_0',
            data: { sourceColor: '#64B5F6', targetColor: '#4DDBBB' }
        }
    ]
})

const createMinimalLegacyAgentflowDefinition = (name = 'Smoke Legacy Agentflow') => {
    const base = createMinimalChatflowDefinition(name)
    return {
        ...base,
        __meta: { flowType: 'AGENTFLOW', smokeGenerated: true, smokeLegacy: true }
    }
}

await fs.mkdir(screenshotDir, { recursive: true })
const startupInfo = await waitForStartup()

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

const visitRoute = async ({ name, path: routePath, waitMs = 1400, expectFinalPath = null, expectPathPrefix = null }) => {
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

    const finalPath = relPath(page.url())
    let expectationFailed = false
    let expectationError = null

    if (status === 'ok' && expectFinalPath && finalPath !== expectFinalPath) {
        expectationFailed = true
        expectationError = `Expected final path ${expectFinalPath} but got ${finalPath}`
    }

    if (status === 'ok' && expectPathPrefix && !finalPath.startsWith(expectPathPrefix)) {
        expectationFailed = true
        expectationError = `Expected final path to start with ${expectPathPrefix} but got ${finalPath}`
    }

    const screenshotName = sanitize(name) || sanitize(routePath) || 'route'
    const screenshotPath = path.join(screenshotDir, `${screenshotName}.png`)
    await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => {})

    return {
        name,
        path: routePath,
        finalUrl: page.url(),
        finalPath,
        status,
        navError,
        expectationFailed,
        expectationError,
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
    await button.scrollIntoViewIfNeeded().catch(() => {})
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

const authApi = await request.newContext({ baseURL: baseUrl })
let cleanupResults = []

try {
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

    const tokenResponse = await authApi.post('/api/auth/token', {
        data: {
            email: loginEmail,
            tenant_id: storageState.vetrai_tenant_id || defaultTenantId,
            role: storageState.vetrai_role || defaultRole
        }
    })
    const tokenPayload = await tokenResponse.json().catch(() => ({}))
    const issuedToken = tokenPayload?.access_token || storageState.vetrai_access_token
    const authHeaders = issuedToken ? { Authorization: `Bearer ${issuedToken}` } : {}

    const meResponse = await authApi.get('/api/auth/me', { headers: authHeaders })

    const apiGetJson = async (url) => {
        const response = await authApi.get(url, { headers: authHeaders })
        return response.json().catch(() => ({}))
    }

    const apiPostJson = async (url, data = {}) => {
        const response = await authApi.post(url, { headers: authHeaders, data })
        return { status: response.status(), data: await response.json().catch(() => ({})) }
    }

    const apiPutJson = async (url, data = {}) => {
        const response = await authApi.put(url, { headers: authHeaders, data })
        return { status: response.status(), data: await response.json().catch(() => ({})) }
    }

    const apiDelete = async (url) => {
        const response = await authApi.delete(url, { headers: authHeaders })
        return response.status()
    }

    const getFlows = async () => {
        const payload = await apiGetJson('/api/flows/list?limit=500')
        return Array.isArray(payload?.items) ? payload.items : []
    }

    let flowItems = await getFlows()
    let chatflow = flowItems.find((row) => flowTypeFromDefinition(row?.latest_definition || {}) === 'CHATFLOW')
    let agentflowV2 = flowItems.find(
        (row) => flowTypeFromDefinition(row?.latest_definition || {}) === 'AGENTFLOW' && usesAgentflowV2Types(row?.latest_definition || {})
    )
    let agentflowLegacy = flowItems.find(
        (row) => flowTypeFromDefinition(row?.latest_definition || {}) === 'AGENTFLOW' && !usesAgentflowV2Types(row?.latest_definition || {})
    )

    if (!chatflow?.flow_id) {
        const name = `smoke_chatflow_seed_${Date.now()}`
        const created = await apiPostJson('/api/flows/create', {
            name,
            json_definition: createMinimalChatflowDefinition(name)
        })
        ensure(created.status >= 200 && created.status < 300 && created.data?.flow_id, 'Failed to create fallback chatflow fixture')
        const createdFlowId = created.data.flow_id
        registerCleanup(`delete_chatflow_${createdFlowId}`, async () => {
            await apiDelete(`/api/flows/${createdFlowId}`)
        })
        flowItems = await getFlows()
        chatflow = flowItems.find((row) => row?.flow_id === createdFlowId) || { flow_id: createdFlowId, name }
    }

    if (!agentflowV2?.flow_id) {
        const name = `smoke_agentflow_v2_seed_${Date.now()}`
        const created = await apiPostJson('/api/flows/create', {
            name,
            json_definition: createMinimalAgentflowDefinition(name)
        })
        ensure(created.status >= 200 && created.status < 300 && created.data?.flow_id, 'Failed to create fallback agentflow v2 fixture')
        const createdFlowId = created.data.flow_id
        registerCleanup(`delete_agentflow_v2_${createdFlowId}`, async () => {
            await apiDelete(`/api/flows/${createdFlowId}`)
        })
        flowItems = await getFlows()
        agentflowV2 = flowItems.find((row) => row?.flow_id === createdFlowId) || { flow_id: createdFlowId, name }
    }

    if (!agentflowLegacy?.flow_id) {
        const name = `smoke_agentflow_legacy_seed_${Date.now()}`
        const created = await apiPostJson('/api/flows/create', {
            name,
            json_definition: createMinimalLegacyAgentflowDefinition(name)
        })
        ensure(created.status >= 200 && created.status < 300 && created.data?.flow_id, 'Failed to create fallback legacy agentflow fixture')
        const createdFlowId = created.data.flow_id
        registerCleanup(`delete_agentflow_legacy_${createdFlowId}`, async () => {
            await apiDelete(`/api/flows/${createdFlowId}`)
        })
        flowItems = await getFlows()
        agentflowLegacy = flowItems.find((row) => row?.flow_id === createdFlowId) || { flow_id: createdFlowId, name }
    }

    let templatePayload = await apiGetJson('/api/resources/marketplace?limit=800&offset=0')
    let templateItems = Array.isArray(templatePayload?.items) ? templatePayload.items : []
    let chatTemplate = templateItems.find((tpl) => tpl?.payload?.type === 'Chatflow')
    let agentTemplate = templateItems.find((tpl) => tpl?.payload?.type === 'AgentflowV2')

    const createTemplate = async (type, flowData, name) => {
        const created = await apiPostJson('/api/resources/marketplace', {
            name,
            payload: {
                type,
                badge: 'NEW',
                flowData: JSON.stringify(flowData),
                isCustom: false,
                usecases: ['Smoke Test'],
                framework: 'LangChain',
                categories: ['Smoke'],
                isPrebuilt: true,
                description: `Generated by browser smoke (${type})`
            }
        })
        ensure(created.status >= 200 && created.status < 300 && created.data?.resource_id, `Failed to create ${type} template fixture`)
        const resourceId = created.data.resource_id
        registerCleanup(`delete_template_${resourceId}`, async () => {
            await apiDelete(`/api/resources/marketplace/${resourceId}`)
        })
        return resourceId
    }

    if (!chatTemplate?.resource_id) {
        const resourceId = await createTemplate('Chatflow', createMinimalChatflowDefinition('Smoke Template Chatflow'), `Smoke Template Chatflow ${Date.now()}`)
        templatePayload = await apiGetJson('/api/resources/marketplace?limit=800&offset=0')
        templateItems = Array.isArray(templatePayload?.items) ? templatePayload.items : []
        chatTemplate = templateItems.find((tpl) => tpl?.resource_id === resourceId) || { resource_id: resourceId, payload: { type: 'Chatflow' } }
    }

    if (!agentTemplate?.resource_id) {
        const resourceId = await createTemplate(
            'AgentflowV2',
            createMinimalAgentflowDefinition('Smoke Template Agentflow'),
            `Smoke Template Agentflow ${Date.now()}`
        )
        templatePayload = await apiGetJson('/api/resources/marketplace?limit=800&offset=0')
        templateItems = Array.isArray(templatePayload?.items) ? templatePayload.items : []
        agentTemplate = templateItems.find((tpl) => tpl?.resource_id === resourceId) || { resource_id: resourceId, payload: { type: 'AgentflowV2' } }
    }

    let assistants = await apiGetJson('/api/assistants?type=CUSTOM')
    assistants = Array.isArray(assistants) ? assistants : []
    let assistant = assistants[0] || null
    if (!assistant?.id) {
        const created = await apiPostJson('/api/assistants', {
            type: 'CUSTOM',
            credential: `smoke-seed-${Date.now()}`,
            details: JSON.stringify({
                name: `Smoke Assistant ${Date.now()}`,
                instruction: realWorldAssistantInstruction,
                profileId: 'customer_support_copilot',
                profileLabel: 'Customer Support Copilot'
            })
        })
        ensure(created.status >= 200 && created.status < 300 && created.data?.id, 'Failed to create fallback assistant fixture')
        assistant = { id: created.data.id }
        registerCleanup(`delete_assistant_${assistant.id}`, async () => {
            await apiDelete(`/api/assistants/${assistant.id}`)
        })
    }

    let documentStores = await apiGetJson('/api/document-store/store?page=1&limit=50')
    documentStores = Array.isArray(documentStores?.data) ? documentStores.data : []
    let docStore = documentStores[0] || null
    let createdDocStore = false

    if (!docStore?.id) {
        const created = await apiPostJson('/api/document-store/store', {
            name: `Smoke Doc Store ${Date.now()}`,
            description: 'Smoke document store fixture'
        })
        ensure(created.status >= 200 && created.status < 300 && created.data?.id, 'Failed to create fallback doc store fixture')
        docStore = { id: created.data.id }
        createdDocStore = true
        registerCleanup(`delete_doc_store_${docStore.id}`, async () => {
            await apiDelete(`/api/document-store/store/${docStore.id}`)
        })
    }

    let docStoreDetail = await apiGetJson(`/api/document-store/store/${docStore.id}`)
    let loaders = Array.isArray(docStoreDetail?.loaders) ? docStoreDetail.loaders : []
    if (loaders.length === 0) {
        const saveLoader = await apiPostJson('/api/document-store/loader/save', {
            storeId: docStore.id,
            loaderId: 'textFileLoader',
            loaderName: 'Smoke Loader',
            loaderConfig: {
                text: 'Smoke loader fixture content for chunk route validation.'
            },
            splitterId: 'recursiveCharacterTextSplitter',
            splitterName: 'Recursive Character Text Splitter',
            splitterConfig: {
                chunkSize: 1000,
                chunkOverlap: 50
            }
        })
        ensure(saveLoader.status >= 200 && saveLoader.status < 300, 'Failed to create loader fixture for document store routes')
        docStoreDetail = await apiGetJson(`/api/document-store/store/${docStore.id}`)
        loaders = Array.isArray(docStoreDetail?.loaders) ? docStoreDetail.loaders : []
        if (!createdDocStore && loaders[0]?.files?.[0]?.id) {
            const fileId = loaders[0].files[0].id
            registerCleanup(`delete_doc_loader_file_${docStore.id}_${fileId}`, async () => {
                await apiDelete(`/api/document-store/loader/${docStore.id}/${fileId}`)
            })
        }
    }

    const primaryLoader = loaders[0] || {}
    const docFileId = primaryLoader?.files?.[0]?.id || null
    const loaderName = encodeURIComponent(primaryLoader?.loaderName || primaryLoader?.name || 'loader')

    let datasetsPayload = await apiGetJson('/api/datasets?page=1&limit=50')
    let datasets = Array.isArray(datasetsPayload?.data) ? datasetsPayload.data : []
    let dataset = datasets[0] || null

    if (!dataset?.id) {
        const createDataset = await apiPostJson('/api/datasets/set', {
            name: `Smoke Dataset ${Date.now()}`,
            description: 'Smoke dataset fixture'
        })
        ensure(createDataset.status >= 200 && createDataset.status < 300 && createDataset.data?.id, 'Failed to create fallback dataset fixture')
        dataset = { id: createDataset.data.id, name: `Smoke Dataset ${Date.now()}` }
        registerCleanup(`delete_dataset_${dataset.id}`, async () => {
            await apiDelete(`/api/datasets/set/${dataset.id}`)
        })
        await apiPostJson('/api/datasets/rows', {
            datasetId: dataset.id,
            input: 'What is the refund window?',
            output: 'Refunds are allowed within 30 days for unused subscriptions.'
        })
    }

    if (dataset?.id) {
        const details = await apiGetJson(`/api/datasets/set/${dataset.id}?page=1&limit=1`)
        if (!Array.isArray(details?.rows) || details.rows.length === 0) {
            await apiPostJson('/api/datasets/rows', {
                datasetId: dataset.id,
                input: 'How long is the free trial?',
                output: 'The free trial lasts 14 days.'
            })
        }
    }

    let evaluationsPayload = await apiGetJson('/api/evaluations?page=1&limit=50')
    let evaluations = Array.isArray(evaluationsPayload?.data) ? evaluationsPayload.data : []
    let evaluation = evaluations[0] || null

    if (!evaluation?.id && dataset?.id && chatflow?.flow_id) {
        const evalName = `Smoke Evaluation ${Date.now()}`
        const createEval = await apiPostJson('/api/evaluations', {
            name: evalName,
            evaluationType: 'benchmarking',
            credentialId: '',
            datasetId: dataset.id,
            datasetName: dataset.name || evalName,
            chatflowId: JSON.stringify([chatflow.flow_id]),
            chatflowName: JSON.stringify([chatflow.name || 'Smoke Chatflow']),
            chatflowType: JSON.stringify(['Chatflow']),
            selectedSimpleEvaluators: [],
            selectedLLMEvaluators: [],
            model: '',
            llm: 'no_grading',
            datasetAsOneConversation: false
        })
        const createdEval = Array.isArray(createEval.data) ? createEval.data[0] : null
        ensure(createdEval?.id, 'Failed to create fallback evaluation fixture')
        evaluation = createdEval
        registerCleanup(`delete_evaluation_${evaluation.id}`, async () => {
            await apiDelete(`/api/evaluations/${evaluation.id}`)
        })
    }

    let executions = await apiGetJson('/api/flows/logs?limit=200')
    executions = Array.isArray(executions) ? executions : []
    let executionLog = executions[0] || null

    if (!executionLog?.execution_log_id && chatflow?.flow_id) {
        const triggerExecution = await apiPostJson(`/api/flows/${chatflow.flow_id}/execute`, {
            input: { question: 'Smoke execution route fixture' },
            enable_tools: true,
            wait_for_ingestion: false
        })
        const executionId = triggerExecution.data?.execution_log_id
        if (executionId) {
            await delay(500)
            executions = await apiGetJson('/api/flows/logs?limit=200')
            executions = Array.isArray(executions) ? executions : []
            executionLog = executions.find((row) => row?.execution_log_id === executionId) || { execution_log_id: executionId }
        }
    }

    const parameterizedRoutes = [
        executionLog?.execution_log_id ? { name: 'execution_details', path: `/executions/${executionLog.execution_log_id}` } : null,
        assistant?.id ? { name: 'assistant_custom_details', path: `/assistants/custom/${assistant.id}` } : null,
        docStore?.id ? { name: 'document_store_details', path: `/document-stores/${docStore.id}` } : null,
        docStore?.id ? { name: 'document_store_loader', path: `/document-stores/${docStore.id}/${loaderName}` } : null,
        docStore?.id ? { name: 'document_store_vector', path: `/document-stores/vector/${docStore.id}` } : null,
        docStore?.id && docFileId ? { name: 'document_store_vector_doc', path: `/document-stores/vector/${docStore.id}/${docFileId}` } : null,
        docStore?.id ? { name: 'document_store_query', path: `/document-stores/query/${docStore.id}` } : null,
        docStore?.id && docFileId ? { name: 'document_store_chunks', path: `/document-stores/chunks/${docStore.id}/${docFileId}` } : null,
        dataset?.id ? { name: 'dataset_rows', path: `/dataset_rows/${dataset.id}` } : null,
        evaluation?.id ? { name: 'evaluation_results', path: `/evaluation_results/${evaluation.id}` } : null,
        chatflow?.flow_id ? { name: 'chatflow_canvas', path: `/canvas/${chatflow.flow_id}` } : null,
        agentflowLegacy?.flow_id ? { name: 'agentflow_canvas_legacy', path: `/agentcanvas/${agentflowLegacy.flow_id}` } : null,
        agentflowV2?.flow_id ? { name: 'agentflow_canvas_v2', path: `/v2/agentcanvas/${agentflowV2.flow_id}` } : null,
        chatTemplate?.resource_id ? { name: 'marketplace_chat_canvas', path: `/marketplace/${chatTemplate.resource_id}` } : null,
        agentTemplate?.resource_id ? { name: 'marketplace_agent_canvas', path: `/v2/marketplace/${agentTemplate.resource_id}` } : null
    ].filter(Boolean)

    const routeResults = []

    for (const route of authenticatedRoutes) {
        routeResults.push(await visitRoute(route))
    }

    for (const route of parameterizedRoutes) {
        routeResults.push(await visitRoute(route))
    }

    const actions = []

    actions.push(
        await runAction('chatflows_add_new', async () => {
            await page.goto(`${baseUrl}/chatflows`, { waitUntil: 'domcontentloaded' })
            const clicked = await maybeClickButton(/add new|new add/i)
            await page.waitForTimeout(900)
            const landedOnCanvas = page.url().includes('/canvas')
            ensure(clicked, 'Add New button was not found/clickable on /chatflows')
            ensure(landedOnCanvas, `Add New click did not navigate to canvas. Current URL: ${page.url()}`)

            const createdFlowName = `smoke_chatflow_${Date.now()}`
            const saveTrigger = page.locator('[title="Save Chatflow"]').first()
            ensure((await saveTrigger.count()) > 0, 'Save Chatflow trigger not found on canvas')

            await saveTrigger.click({ timeout: 5000 })
            const saveDialog = page.getByRole('dialog', { name: /save new chatflow/i }).first()
            await saveDialog.waitFor({ state: 'visible', timeout: 5000 })

            const nameInput = saveDialog.locator('#chatflow-name')
            await nameInput.fill(createdFlowName)
            await saveDialog.getByRole('button', { name: /^save$/i }).click({ timeout: 5000 })

            await page.waitForURL(/\/canvas\/[^/?#]+/, { timeout: 12000 })
            const canvasUrlAfterSave = page.url()
            const createdFlowId = canvasUrlAfterSave.match(/\/canvas\/([^/?#]+)/)?.[1] || null
            ensure(createdFlowId, 'Created chatflow id could not be inferred from URL')

            const persisted = await authApi.get(`/api/flows/${createdFlowId}`, { headers: authHeaders })
            ensure(persisted.status() >= 200 && persisted.status() < 300, `Created chatflow is not persisted: status=${persisted.status()}`)

            const cleanupDeleteStatus = await apiDelete(`/api/flows/${createdFlowId}`)
            ensure(cleanupDeleteStatus >= 200 && cleanupDeleteStatus < 300, `Failed to cleanup created chatflow: status=${cleanupDeleteStatus}`)

            return {
                clicked,
                createdFlowId,
                cleanupDeleteStatus
            }
        })
    )

    actions.push(
        await runAction('chatflow_open_api_dialog', async () => {
            ensure(chatflow?.flow_id, 'No chatflow ID available for API dialog check')
            await page.goto(`${baseUrl}/canvas/${chatflow.flow_id}`, { waitUntil: 'domcontentloaded' })
            await page.waitForTimeout(1500)
            const apiTrigger = page
                .locator('[title*="Embed in website"], [title*="Embed"], [title*="API"], button:has-text("API"), button:has-text("Embed")')
                .first()
            ensure((await apiTrigger.count()) > 0, 'API trigger not found on chatflow canvas')
            await apiTrigger.click({ timeout: 4000 })
            await page.waitForTimeout(1000)
            const dialogVisible = (await page.locator('text=Embed in website or use as API').count()) > 0
            await page.keyboard.press('Escape').catch(() => {})
            ensure(dialogVisible, 'Chatflow API dialog did not open')
            return { opened: dialogVisible }
        })
    )

    actions.push(
        await runAction('chatflow_chat_popup', async () => {
            ensure(chatflow?.flow_id, 'No chatflow ID available for chat popup check')
            await page.goto(`${baseUrl}/canvas/${chatflow.flow_id}`, { waitUntil: 'domcontentloaded' })
            await page.waitForTimeout(1500)
            const chatBtn = page.locator('button[title="Chat"], button[title*="chat"], button:has-text("Chat")').first()
            ensure((await chatBtn.count()) > 0, 'Chat button not found on chatflow canvas')
            await chatBtn.click({ timeout: 4000 })
            await page.waitForTimeout(800)
            const popupVisible =
                (await page.locator('text=Type your question...').count()) > 0 ||
                (await page.locator('textarea[placeholder*="Type your question"]').count()) > 0 ||
                (await page.locator('[title="Clear Chat History"]').count()) > 0
            ensure(popupVisible, 'Chat popup did not open on chatflow canvas')
            return { popupVisible }
        })
    )

    actions.push(
        await runAction('agentflows_add_new_v2', async () => {
            await page.goto(`${baseUrl}/agentflows`, { waitUntil: 'domcontentloaded' })
            const clicked = await maybeClickButton(/add new|new add/i)
            await page.waitForTimeout(900)
            const landedOnAgentCanvas = page.url().includes('/v2/agentcanvas') || page.url().includes('/agentcanvas')
            ensure(clicked, 'Add New button was not found/clickable on /agentflows')
            ensure(landedOnAgentCanvas, `Add New click did not navigate to agent canvas. Current URL: ${page.url()}`)

            const createdFlowName = `smoke_agentflow_${Date.now()}`
            const saveTrigger = page.locator('[title="Save Agents"], [title="Save Agent"]').first()
            ensure((await saveTrigger.count()) > 0, 'Save Agent trigger not found on agent canvas')

            await saveTrigger.click({ timeout: 5000 })
            const saveDialog = page.getByRole('dialog', { name: /save new agents|save new agent/i }).first()
            await saveDialog.waitFor({ state: 'visible', timeout: 5000 })

            const nameInput = saveDialog.locator('#chatflow-name')
            await nameInput.fill(createdFlowName)
            await saveDialog.getByRole('button', { name: /^save$/i }).click({ timeout: 5000 })

            await page.waitForURL(/\/(?:v2\/)?agentcanvas\/[^/?#]+/, { timeout: 12000 })
            const createdFlowId = page.url().match(/\/(?:v2\/)?agentcanvas\/([^/?#]+)/)?.[1] || null
            ensure(createdFlowId, 'Created agentflow id could not be inferred from URL')

            const persisted = await authApi.get(`/api/flows/${createdFlowId}`, { headers: authHeaders })
            ensure(persisted.status() >= 200 && persisted.status() < 300, `Created agentflow is not persisted: status=${persisted.status()}`)

            const cleanupDeleteStatus = await apiDelete(`/api/flows/${createdFlowId}`)
            ensure(cleanupDeleteStatus >= 200 && cleanupDeleteStatus < 300, `Failed to cleanup created agentflow: status=${cleanupDeleteStatus}`)

            return {
                clicked,
                createdFlowId,
                cleanupDeleteStatus
            }
        })
    )

    actions.push(
        await runAction('agentflow_prompt_based_generate', async () => {
            await page.goto(`${baseUrl}/v2/agentcanvas`, { waitUntil: 'domcontentloaded' })
            await page.waitForTimeout(1200)

            const generateTrigger = page.locator('[title*="Generate Agentflow"], [title*="Generate"], button:has-text("Generate")').first()
            ensure((await generateTrigger.count()) > 0, 'Generate Agentflow trigger not found')
            await generateTrigger.click({ timeout: 5000 })

            const dialog = page.getByRole('dialog', { name: /what would you like to build/i }).first()
            await dialog.waitFor({ state: 'visible', timeout: 7000 })

            const defaultPrompt = dialog.getByRole('button', { name: /summarize a document/i }).first()
            if ((await defaultPrompt.count()) > 0) {
                await defaultPrompt.click({ timeout: 4000 })
            }

            const modelInput = dialog.locator('#chatModel').first()
            ensure((await modelInput.count()) > 0, 'Chat model dropdown not found in Generate Agentflow dialog')
            await modelInput.click({ timeout: 5000 })
            await page.waitForTimeout(500)

            const firstOption = page.locator('li[role="option"]').first()
            ensure((await firstOption.count()) > 0, 'No chat model options available for Generate Agentflow dialog')
            await firstOption.click({ timeout: 5000 })
            await page.waitForTimeout(800)

            const generateButton = dialog.getByRole('button', { name: /^generate$/i }).first()
            ensure((await generateButton.count()) > 0, 'Generate button not found in Generate Agentflow dialog')
            ensure(!(await generateButton.isDisabled()), 'Generate button disabled in Generate Agentflow dialog')
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

            ensure(outcome === 'graph_generated' || outcome === 'instruction_generated_applied', `Agentflow generation failed: ${outcome}`)
            return { outcome }
        })
    )

    actions.push(
        await runAction('marketplace_use_template_create_cycle', async () => {
            ensure(chatTemplate?.resource_id || agentTemplate?.resource_id, 'No marketplace template fixture available')

            const selectedTemplate = chatTemplate?.resource_id
                ? { kind: 'chatflow', route: `/marketplace/${chatTemplate.resource_id}` }
                : { kind: 'agentflow_v2', route: `/v2/marketplace/${agentTemplate.resource_id}` }

            await page.goto(`${baseUrl}${selectedTemplate.route}`, { waitUntil: 'domcontentloaded' })
            const useTemplateBtn = page.getByRole('button', { name: /use template/i }).first()
            ensure(await isVisible(useTemplateBtn, 7000), 'Use Template button not visible')

            await useTemplateBtn.click({ timeout: 5000 })
            await page.waitForURL(/\/(?:v2\/)?agentcanvas(?:\/[^/?#]+)?|\/canvas(?:\/[^/?#]+)?/, { timeout: 12000 })
            await page.waitForTimeout(800)

            const openedUrl = page.url()
            const isChatCanvas = /\/canvas(?:\/|$)/.test(openedUrl) && !openedUrl.includes('/agentcanvas')
            const saveSelector = isChatCanvas ? '[title="Save Chatflow"]' : '[title="Save Agents"], [title="Save Agent"]'
            const saveTrigger = page.locator(saveSelector).first()
            ensure(await isVisible(saveTrigger, 7000), `Use Template opened canvas but save control missing on ${openedUrl}`)

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
            ensure(createdFlowId, 'Template flow id could not be inferred from URL')

            const cleanupDeleteStatus = await apiDelete(`/api/flows/${createdFlowId}`)
            ensure(cleanupDeleteStatus >= 200 && cleanupDeleteStatus < 300, `Failed to cleanup template-created flow: status=${cleanupDeleteStatus}`)

            return {
                usedTemplate: true,
                templateKind: selectedTemplate.kind,
                createdFlowId,
                cleanupDeleteStatus
            }
        })
    )

    actions.push(
        await runAction('marketplace_import_navigation', async () => {
            await page.goto(`${baseUrl}/marketplaces`, { waitUntil: 'domcontentloaded' })
            await page.waitForTimeout(1500)
            if (chatTemplate?.resource_id) {
                await page.goto(`${baseUrl}/marketplace/${chatTemplate.resource_id}`, { waitUntil: 'domcontentloaded' })
            } else {
                await page.goto(`${baseUrl}/v2/marketplace/${agentTemplate.resource_id}`, { waitUntil: 'domcontentloaded' })
            }
            await page.waitForTimeout(1200)
            const imported = page.url().includes('/marketplace/') || page.url().includes('/v2/marketplace/')
            ensure(imported, `Marketplace import navigation did not land on a marketplace route: ${page.url()}`)
            return { imported, finalUrl: page.url() }
        })
    )

    actions.push(
        await runAction('assistants_custom_open', async () => {
            await page.goto(`${baseUrl}/assistants`, { waitUntil: 'domcontentloaded' })
            await page.waitForTimeout(900)
            const customCard = page.getByRole('heading', { name: /custom assistant/i }).first()
            const cardVisible = (await customCard.count()) > 0
            if (cardVisible) {
                await customCard.click({ timeout: 4000 }).catch(() => {})
                await page.waitForTimeout(1000)
            }

            if (!page.url().includes('/assistants/custom')) {
                await page.goto(`${baseUrl}/assistants/custom`, { waitUntil: 'domcontentloaded' })
            }

            const openedByRoute = page.url().includes('/assistants/custom')
            const openedByUi =
                (await page.getByRole('button', { name: /^add$/i }).count()) > 0 ||
                (await page.locator('text=No Assistant').count()) > 0 ||
                (await page.locator('text=No Custom Assistant').count()) > 0
            ensure(openedByRoute || openedByUi, `Custom assistant section did not open. Current URL: ${page.url()}`)
            return { openedByRoute, openedByUi, cardVisible, finalUrl: page.url() }
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
                    const profileSelect = dialog.locator('#assistant-profile-select').first()
                    if ((await profileSelect.count()) > 0) {
                        await profileSelect.click({ timeout: 5000 })
                        const profileOption = page.getByRole('option', { name: /customer support copilot/i }).first()
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
                        assistantId = page.url().match(/\/assistants\/custom\/([^/?#]+)/)?.[1] || null
                    }
                }
            }

            if (!assistantId) {
                creationMode = 'api_fallback'
                const createResp = await authApi.post('/api/assistants', {
                    headers: authHeaders,
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
                ensure(createResp.status() >= 200 && createResp.status() < 300, `Custom assistant create failed: status=${createResp.status()}`)
                const createPayload = await createResp.json().catch(() => ({}))
                assistantId = createPayload?.id || null
                ensure(assistantId, 'API fallback did not return assistant id')
                await page.goto(`${baseUrl}/assistants/custom/${assistantId}`, { waitUntil: 'domcontentloaded' })
            }

            const getResp = await authApi.get(`/api/assistants/${assistantId}`, { headers: authHeaders })
            const payload = await getResp.json().catch(() => ({}))
            const detailsRaw = payload?.details
            const details = typeof detailsRaw === 'string' ? JSON.parse(detailsRaw) : detailsRaw || {}
            const instructionLength = String(details?.instruction || '').trim().length
            ensure(instructionLength >= 250, `Custom assistant instruction too short: ${instructionLength}`)

            const cleanupResp = await authApi.delete(`/api/assistants/${assistantId}`, { headers: authHeaders })
            ensure(cleanupResp.status() >= 200 && cleanupResp.status() < 300, `Failed to cleanup assistant fixture: status=${cleanupResp.status()}`)

            return {
                created: true,
                creationMode,
                assistantId,
                instructionLength,
                cleanupDeleteStatus: cleanupResp.status()
            }
        })
    )

    actions.push(
        await runAction('document_stores_add_dialog', async () => {
            await page.goto(`${baseUrl}/document-stores`, { waitUntil: 'domcontentloaded' })
            const clicked = await maybeClickButton(/add new/i)
            await page.waitForTimeout(1000)
            const opened = await isVisible(page.getByRole('dialog').filter({ hasText: /document store/i }).first(), 5000)
            await page.keyboard.press('Escape').catch(() => {})
            ensure(clicked, 'Add New button not clickable on /document-stores')
            ensure(opened, 'Add New Document Store dialog did not open')
            return { clicked, opened }
        })
    )

    actions.push(
        await runAction('datasets_add_dialog', async () => {
            await page.goto(`${baseUrl}/datasets`, { waitUntil: 'domcontentloaded' })
            const clicked = await maybeClickButton(/add new/i)
            await page.waitForTimeout(900)
            const opened = await isVisible(page.getByRole('dialog').filter({ hasText: /dataset/i }).first(), 5000)
            await page.keyboard.press('Escape').catch(() => {})
            ensure(clicked, 'Add New button not clickable on /datasets')
            ensure(opened, 'Dataset dialog did not open')
            return { clicked, opened }
        })
    )

    actions.push(
        await runAction('evaluators_new_dialog', async () => {
            await page.goto(`${baseUrl}/evaluators`, { waitUntil: 'domcontentloaded' })
            const clicked = await maybeClickButton(/new evaluator|add new/i)
            await page.waitForTimeout(900)
            const opened = await isVisible(page.getByRole('dialog').filter({ hasText: /evaluator/i }).first(), 5000)
            await page.keyboard.press('Escape').catch(() => {})
            ensure(clicked, 'New Evaluator button not clickable on /evaluators')
            ensure(opened, 'Evaluator dialog did not open')
            return { clicked, opened }
        })
    )

    actions.push(
        await runAction('evaluations_new_dialog', async () => {
            await page.goto(`${baseUrl}/evaluations`, { waitUntil: 'domcontentloaded' })
            const clicked = await maybeClickButton(/start new evaluation|new evaluation/i)
            await page.waitForTimeout(900)
            const opened = await isVisible(page.getByRole('dialog').filter({ hasText: /evaluation/i }).first(), 5000)
            await page.keyboard.press('Escape').catch(() => {})
            ensure(clicked, 'Start New Evaluation button not clickable on /evaluations')
            ensure(opened, 'Start New Evaluation dialog did not open')
            return { clicked, opened }
        })
    )

    routeResults.push(await visitRoute({ name: 'logout', path: '/logout', waitMs: 900 }))

    for (const route of authRoutes) {
        routeResults.push(await visitRoute(route))
    }

    const publicRoutes = [
        executionLog?.execution_log_id ? { name: 'public_execution', path: `/execution/${executionLog.execution_log_id}` } : null,
        chatflow?.flow_id ? { name: 'public_chatbot', path: `/chatbot/${chatflow.flow_id}` } : null
    ].filter(Boolean)

    for (const route of publicRoutes) {
        routeResults.push(await visitRoute(route))
    }

    cleanupResults = await runCleanupTasks()

    const response404 = responses.filter((item) => item.status === 404)
    const optional404 = response404.filter((item) => isOptionalNoise(item.requestUrl))
    const nonOptional404 = response404.filter((item) => !isOptionalNoise(item.requestUrl))
    const consoleErrors = consoleEntries.filter((entry) => entry.type === 'error' && !isOptionalNoise(entry.message))
    const optionalConsoleErrors = consoleEntries.filter((entry) => entry.type === 'error' && isOptionalNoise(entry.message))
    const consoleWarnings = consoleEntries.filter((entry) => entry.type === 'warning')
    const routeExpectationFailures = routeResults.filter((route) => route.expectationFailed)

    const summary = {
        generatedAt: nowIso(),
        baseUrl,
        executablePath: executablePath || null,
        startup: startupInfo,
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
            detectedAgentflowId: agentflowV2?.flow_id || agentflowLegacy?.flow_id || null,
            detectedAgentflowV2Id: agentflowV2?.flow_id || null,
            detectedAgentflowLegacyId: agentflowLegacy?.flow_id || null,
            detectedMarketplaceChatTemplate: chatTemplate?.resource_id || null,
            detectedMarketplaceAgentTemplate: agentTemplate?.resource_id || null,
            detectedAssistantId: assistant?.id || null,
            detectedDocumentStoreId: docStore?.id || null,
            detectedDocumentStoreFileId: docFileId || null,
            detectedDatasetId: dataset?.id || null,
            detectedEvaluationId: evaluation?.id || null,
            detectedExecutionLogId: executionLog?.execution_log_id || null
        },
        metrics: {
            totalRoutes: routeResults.length,
            routesWithNavErrors: routeResults.filter((r) => r.status !== 'ok').length,
            routesWithPageErrors: routeResults.filter((r) => r.pageErrors.length > 0).length,
            routesWithConsoleErrors: routeResults.filter((r) => r.consoleEntries.some((e) => e.type === 'error' && !isOptionalNoise(e.message)))
                .length,
            routesWithHttp4xx5xx: routeResults.filter((r) => r.responses.some((resp) => resp.status !== 404 || !isOptionalNoise(resp.requestUrl)))
                .length,
            routeExpectationFailures: routeExpectationFailures.length,
            totalPageErrors: pageErrors.length,
            totalConsoleErrors: consoleErrors.length,
            totalConsoleWarnings: consoleWarnings.length,
            totalFailedRequests: failedRequests.length,
            total4xx5xxResponses: responses.length,
            optional404Count: optional404.length,
            nonOptional404Count: nonOptional404.length,
            actionFailures: actions.filter((action) => action.status !== 'passed').length,
            cleanupFailures: cleanupResults.filter((entry) => entry.status !== 'ok').length
        },
        routeResults,
        actions,
        cleanupResults,
        failures: {
            pageErrors,
            consoleErrors,
            optionalConsoleErrors,
            consoleWarnings,
            failedRequests,
            responses,
            optional404,
            nonOptional404,
            routeExpectationFailures
        },
        classifications: {
            crash: [...pageErrors, ...consoleErrors.filter((entry) => /uncaught|typeerror|referenceerror/i.test(entry.message))],
            blocking: [
                ...routeResults.filter((route) => route.status !== 'ok' || route.expectationFailed),
                ...actions.filter((action) => action.status !== 'passed'),
                ...nonOptional404,
                ...cleanupResults.filter((entry) => entry.status !== 'ok')
            ],
            nonBlockingWarning: [...consoleWarnings, ...optional404, ...optionalConsoleErrors]
        },
        notes: [
            'Enterprise RBAC routes are considered passing when they redirect to /unauthorized without console/page errors.',
            'Public-share routes are in scope and expected to degrade gracefully when resource sharing/public endpoints are unavailable.'
        ],
        artifacts: {
            screenshotDir
        }
    }

    console.log(JSON.stringify(summary, null, 2))
} finally {
    await authApi.dispose().catch(() => {})
    await browser.close().catch(() => {})
}
