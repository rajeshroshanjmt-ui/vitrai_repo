import fs from 'node:fs/promises'
import path from 'node:path'

const BASE_URL = process.env.BASE_URL || 'http://localhost/api'
const LANGGRAPH_URL = process.env.LANGGRAPH_URL || 'http://127.0.0.1:8001'
const ARTIFACT_PATH =
    process.env.ARTIFACT_PATH || 'frontend/ui/tmp/test-artifacts/smoke-summary.fullcycle.json'
const STRICT_SUMMARY_PATH =
    process.env.STRICT_SUMMARY_PATH || 'frontend/ui/tmp/test-artifacts/smoke-summary.strict2.json'
const EMAIL = process.env.LOGIN_EMAIL || 'admin@vetrai.com'
const TENANT_ID = process.env.TENANT_ID || '00000000-0000-0000-0000-000000000001'
const ROLE = process.env.ROLE || 'admin'
const OLLAMA_MODEL = process.env.OLLAMA_LLM_MODEL || 'llama3.2'
const POLL_MS = Number(process.env.POLL_MS || 1200)
const INGEST_TIMEOUT_MS = Number(process.env.INGEST_TIMEOUT_MS || 240000)
const EXEC_TIMEOUT_MS = Number(process.env.EXEC_TIMEOUT_MS || 300000)

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const nowIso = () => new Date().toISOString()

const ensureDir = async (filePath) => {
    const dir = path.dirname(filePath)
    await fs.mkdir(dir, { recursive: true })
}

const parseJson = (text) => {
    if (!text) return {}
    try {
        return JSON.parse(text)
    } catch {
        return { raw: text }
    }
}

const api = async (method, urlPath, { token, body } = {}) => {
    const response = await fetch(`${BASE_URL}${urlPath}`, {
        method,
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: body ? JSON.stringify(body) : undefined
    })
    const text = await response.text()
    return {
        status: response.status,
        ok: response.ok,
        data: parseJson(text)
    }
}

const httpJson = async (url) => {
    const response = await fetch(url)
    const text = await response.text()
    return {
        status: response.status,
        ok: response.ok,
        data: parseJson(text)
    }
}

const hasContract = (payload) =>
    payload &&
    typeof payload === 'object' &&
    Object.prototype.hasOwnProperty.call(payload, 'success') &&
    Object.prototype.hasOwnProperty.call(payload, 'data') &&
    Object.prototype.hasOwnProperty.call(payload, 'error')

const pollUntil = async (runner, timeoutMs, isDone) => {
    const started = Date.now()
    while (Date.now() - started <= timeoutMs) {
        const value = await runner()
        if (isDone(value)) return value
        await wait(POLL_MS)
    }
    return null
}

const readJsonIfExists = async (filePath) => {
    try {
        const raw = await fs.readFile(filePath, 'utf8')
        return JSON.parse(raw)
    } catch {
        return null
    }
}

const executionStatusTimeline = []

const run = async () => {
    const summary = {
        generatedAt: nowIso(),
        baseUrl: BASE_URL,
        langgraphUrl: LANGGRAPH_URL,
        objective: 'Flowise UI -> Backend -> LangGraph -> Tools/Models -> Storage integration QA',
        checks: {
            architecture: [],
            flowiseUiBackend: [],
            backendLanggraph: [],
            tools: [],
            models: [],
            rag: [],
            monitoring: [],
            frontendHandling: [],
            apiContract: [],
            endToEndScenario: []
        },
        evidence: {},
        metrics: {},
        gaps: [],
        status: 'failed'
    }

    const addCheck = (section, name, passed, details = {}) => {
        summary.checks[section].push({ name, passed, details })
        if (!passed) summary.gaps.push({ section, name, details })
    }

    let createdFlowId = null
    let token = null

    try {
        const backendReady = await pollUntil(
            () => httpJson(`${BASE_URL}/health/ready`),
            120000,
            (r) => r?.status === 200 && r?.data?.status === 'ok'
        )
        addCheck('architecture', 'backend_ready', Boolean(backendReady), backendReady || { error: 'timeout' })

        const langgraphReady = await pollUntil(
            () => httpJson(`${LANGGRAPH_URL}/health/ready`),
            120000,
            (r) => r?.status === 200 && r?.data?.status === 'ok'
        )
        addCheck('architecture', 'langgraph_ready', Boolean(langgraphReady), langgraphReady || { error: 'timeout' })
        addCheck('models', 'ollama_runtime_ready', langgraphReady?.data?.checks?.ollama === 'ok', langgraphReady || {})

        const workerSource = await fs.readFile('langgraph/worker.py', 'utf8').catch(() => '')
        const providerBranchesPresent =
            workerSource.includes("provider_name == \"openai\"") &&
            workerSource.includes("provider_name == \"anthropic\"") &&
            workerSource.includes("provider_name == \"azure_openai\"")
        addCheck('models', 'provider_branches_present', providerBranchesPresent, {
            checkedFile: 'langgraph/worker.py'
        })

        const tokenResp = await api('POST', '/auth/token', {
            body: { email: EMAIL, tenant_id: TENANT_ID, role: ROLE }
        })
        token = tokenResp.data?.access_token || null
        addCheck('architecture', 'auth_token_issued', tokenResp.status === 200 && Boolean(token), tokenResp)

        const meResp = await api('GET', '/auth/me', { token })
        addCheck('architecture', 'auth_me_resolves_identity', meResp.status === 200, meResp)
        summary.evidence.auth = { tokenStatus: tokenResp.status, meStatus: meResp.status, me: meResp.data }

        const flowName = `QA-FullCycle-${Date.now()}`
        const createResp = await api('POST', '/flows/create', {
            token,
            body: {
                name: flowName,
                json_definition: {
                    __meta: { flowType: 'CHATFLOW' },
                    nodes: ['rag', 'tools', 'llm']
                }
            }
        })
        createdFlowId = createResp.data?.flow_id || null
        addCheck(
            'flowiseUiBackend',
            'create_chatflow_endpoint',
            createResp.status === 200 && Boolean(createdFlowId),
            createResp
        )
        addCheck('apiContract', 'create_chatflow_contract', hasContract(createResp.data), createResp.data)

        const publishResp = await api('POST', `/flows/${createdFlowId}/publish`, { token, body: {} })
        addCheck('flowiseUiBackend', 'publish_chatflow_endpoint', publishResp.status === 200, publishResp)
        addCheck('apiContract', 'publish_chatflow_contract', hasContract(publishResp.data), publishResp.data)

        const getFlowResp = await api('GET', `/flows/${createdFlowId}`, { token })
        const persisted = getFlowResp.status === 200 && getFlowResp.data?.flow_id === createdFlowId
        addCheck('flowiseUiBackend', 'chatflow_persisted_and_reloadable', persisted, getFlowResp)
        addCheck('apiContract', 'get_flow_contract', hasContract(getFlowResp.data), getFlowResp.data)

        const listResp = await api('GET', '/flows/list?limit=100', { token })
        const foundInList = Array.isArray(listResp.data?.items) && listResp.data.items.some((f) => f.flow_id === createdFlowId)
        addCheck('flowiseUiBackend', 'chatflow_visible_in_list', listResp.status === 200 && foundInList, listResp)
        addCheck('apiContract', 'list_flows_contract', hasContract(listResp.data), listResp.data)

        const toolStateGet = await api('GET', '/flows/tools/state', { token })
        const toolStatePut = await api('PUT', '/flows/tools/state', {
            token,
            body: { states: { calculator: true, sql_tool: true, retriever: true, http_fetch: false } }
        })
        addCheck('tools', 'tool_state_read', toolStateGet.status === 200, toolStateGet)
        addCheck('tools', 'tool_state_write', toolStatePut.status === 200, toolStatePut)
        addCheck('apiContract', 'tool_state_get_contract', hasContract(toolStateGet.data), toolStateGet.data)
        addCheck('apiContract', 'tool_state_put_contract', hasContract(toolStatePut.data), toolStatePut.data)

        const ingestResp = await api('POST', `/flows/${createdFlowId}/documents`, {
            token,
            body: {
                documents: [
                    {
                        text: 'Refunds are allowed within 30 days for unused subscriptions.',
                        source: 'qa-fullcycle',
                        metadata: { topic: 'refund-policy' }
                    },
                    {
                        text: 'The free trial lasts 14 days and billing starts after trial expiry.',
                        source: 'qa-fullcycle',
                        metadata: { topic: 'trial-policy' }
                    }
                ]
            }
        })
        addCheck('rag', 'document_ingestion_queued', ingestResp.status === 200, ingestResp)
        addCheck('apiContract', 'document_ingest_contract', hasContract(ingestResp.data), ingestResp.data)

        const blockedExecute = await api('POST', `/flows/${createdFlowId}/execute`, {
            token,
            body: {
                input: { question: 'What is the refund window?' },
                enable_tools: true,
                wait_for_ingestion: true
            }
        })
        addCheck(
            'backendLanggraph',
            'execute_blocked_during_ingestion',
            blockedExecute.status === 409 && blockedExecute.data?.detail?.status,
            blockedExecute
        )

        const ingestionResult = await pollUntil(
            async () => {
                const ing = await api('GET', `/flows/${createdFlowId}/ingestions?limit=10`, { token })
                const latest = Array.isArray(ing.data) ? ing.data[0] : null
                return { response: ing, latest }
            },
            INGEST_TIMEOUT_MS,
            (payload) => Boolean(payload?.latest && ['completed', 'failed'].includes(payload.latest.status))
        )
        const ingestionCompleted = ingestionResult?.latest?.status === 'completed'
        addCheck('rag', 'document_ingestion_completed', ingestionCompleted, ingestionResult || { error: 'timeout' })

        const executeResp = await api('POST', `/flows/${createdFlowId}/execute`, {
            token,
            body: {
                input: { question: 'What is the refund window?' },
                enable_tools: true,
                wait_for_ingestion: true,
                llm_provider: 'ollama',
                llm_model: OLLAMA_MODEL
            }
        })
        const executionLogId = executeResp.data?.execution_log_id || null
        addCheck('backendLanggraph', 'execute_enqueued', executeResp.status === 200 && Boolean(executionLogId), executeResp)
        addCheck('apiContract', 'execute_contract', hasContract(executeResp.data), executeResp.data)

        const finalExecution = await pollUntil(
            async () => {
                const logsResp = await api('GET', '/flows/logs?limit=300', { token })
                const logs = Array.isArray(logsResp.data) ? logsResp.data : []
                const row = logs.find((x) => x.execution_log_id === executionLogId) || null
                if (row?.status) executionStatusTimeline.push({ at: nowIso(), status: row.status })
                return { logsResp, row }
            },
            EXEC_TIMEOUT_MS,
            (payload) => Boolean(payload?.row && ['completed', 'failed'].includes(payload.row.status))
        )
        const completed = finalExecution?.row?.status === 'completed'
        addCheck('backendLanggraph', 'langgraph_execution_completed', completed, finalExecution || { error: 'timeout' })

        const seenStatuses = [...new Set(executionStatusTimeline.map((x) => x.status))]
        addCheck(
            'monitoring',
            'execution_status_transitions_recorded',
            seenStatuses.includes('queued') || seenStatuses.includes('running') || seenStatuses.includes('completed'),
            { seenStatuses }
        )
        addCheck('monitoring', 'execution_log_available', Boolean(finalExecution?.row), finalExecution?.row || {})

        const answerText = String(finalExecution?.row?.response_text || '')
        const hasExpectedAnswer = answerText.length > 0 && /30\s*day/i.test(answerText)
        addCheck('rag', 'retrieval_response_contains_expected_fact', hasExpectedAnswer, { answerText })
        addCheck('models', 'model_invocation_returns_response', completed && answerText.length > 0, {
            provider: 'ollama',
            status: finalExecution?.row?.status,
            answerText
        })

        const usageResp = await api('GET', '/flows/usage', { token })
        addCheck('monitoring', 'usage_metrics_available', usageResp.status === 200, usageResp)
        addCheck('apiContract', 'usage_contract', hasContract(usageResp.data), usageResp.data)

        const strictSummary = await readJsonIfExists(STRICT_SUMMARY_PATH)
        if (strictSummary?.metrics) {
            const uiClean =
                strictSummary.metrics.totalPageErrors === 0 &&
                strictSummary.metrics.totalConsoleErrors === 0 &&
                strictSummary.metrics.routesWithNavErrors === 0 &&
                strictSummary.metrics.nonOptional404Count === 0 &&
                strictSummary.metrics.actionFailures === 0
            addCheck('flowiseUiBackend', 'ui_routes_and_actions_clean', uiClean, strictSummary.metrics)
            summary.evidence.uiSmoke = { source: STRICT_SUMMARY_PATH, metrics: strictSummary.metrics }

            const routeResults = Array.isArray(strictSummary.routeResults) ? strictSummary.routeResults : []
            const actions = Array.isArray(strictSummary.actions) ? strictSummary.actions : []
            const findRoute = (name) => routeResults.find((route) => route?.name === name)
            const routeHasNoErrors = (route) =>
                Boolean(route) &&
                route.status === 'ok' &&
                !route.expectationFailed &&
                Array.isArray(route.pageErrors) &&
                route.pageErrors.length === 0 &&
                Array.isArray(route.consoleEntries) &&
                route.consoleEntries.filter((entry) => entry?.type === 'error').length === 0

            const evalDialogAction = actions.find((action) => action?.name === 'evaluations_new_dialog')
            addCheck('frontendHandling', 'evaluations_dialog_action_clean', evalDialogAction?.status === 'passed', evalDialogAction || {})

            const resetPasswordRoute = findRoute('auth_reset_password')
            addCheck('frontendHandling', 'reset_password_route_clean', routeHasNoErrors(resetPasswordRoute), resetPasswordRoute || {})

            const canvasRoute = findRoute('chatflow_canvas')
            const canvasOptional404 = (canvasRoute?.responses || []).filter((resp) => resp?.status === 404).length
            addCheck('frontendHandling', 'canvas_chat_popup_no_optional_404_noise', routeHasNoErrors(canvasRoute) && canvasOptional404 === 0, {
                route: canvasRoute?.name,
                optional404Count: canvasOptional404
            })

            const publicExecutionRoute = findRoute('public_execution')
            addCheck('frontendHandling', 'public_execution_route_clean', routeHasNoErrors(publicExecutionRoute), publicExecutionRoute || {})

            const publicChatbotRoute = findRoute('public_chatbot')
            addCheck('frontendHandling', 'public_chatbot_route_clean', routeHasNoErrors(publicChatbotRoute), publicChatbotRoute || {})

            const rbacRoutes = ['users', 'roles', 'login_activity', 'workspaces', 'sso_config', 'workspace_users'].map(findRoute)
            const rbacClean = rbacRoutes.every((route) => routeHasNoErrors(route) && route?.finalPath === '/unauthorized')
            addCheck('frontendHandling', 'rbac_routes_redirect_cleanly', rbacClean, {
                routes: rbacRoutes.map((route) => ({
                    name: route?.name,
                    finalPath: route?.finalPath,
                    status: route?.status,
                    expectationFailed: route?.expectationFailed
                }))
            })
        } else {
            addCheck('flowiseUiBackend', 'ui_routes_and_actions_clean', false, {
                reason: 'Strict UI smoke summary missing',
                path: STRICT_SUMMARY_PATH
            })
        }

        const endToEndPassed =
            summary.gaps.length === 0 &&
            completed &&
            ingestionCompleted &&
            Boolean(finalExecution?.row?.response_text)
        addCheck('endToEndScenario', 'full_pipeline_scenario', endToEndPassed, {
            flowId: createdFlowId,
            ingestionStatus: ingestionResult?.latest?.status,
            executionStatus: finalExecution?.row?.status
        })

        summary.evidence.execution = {
            flowId: createdFlowId,
            ingestion: ingestionResult?.latest || null,
            executeResponse: executeResp.data,
            finalExecution: finalExecution?.row || null,
            statusTimeline: seenStatuses
        }

        summary.metrics = {
            totalChecks: Object.values(summary.checks).reduce((sum, arr) => sum + arr.length, 0),
            failedChecks: summary.gaps.length,
            passedChecks:
                Object.values(summary.checks).reduce((sum, arr) => sum + arr.length, 0) - summary.gaps.length
        }
    } catch (error) {
        summary.gaps.push({
            section: 'runtime',
            name: 'unexpected_exception',
            details: { message: String(error?.stack || error?.message || error) }
        })
    } finally {
        if (createdFlowId && token) {
            const deleted = await api('DELETE', `/flows/${createdFlowId}`, { token })
            summary.evidence.cleanup = deleted
        }
    }

    summary.status = summary.gaps.length === 0 ? 'passed' : 'failed'
    await ensureDir(ARTIFACT_PATH)
    await fs.writeFile(ARTIFACT_PATH, `${JSON.stringify(summary, null, 2)}\n`, 'utf8')
    console.log(JSON.stringify(summary, null, 2))
    if (summary.status !== 'passed') process.exitCode = 1
}

await run()
