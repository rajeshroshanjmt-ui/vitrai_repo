import client from './client'

const VISIBILITY_STORAGE_KEY = 'vetrai_execution_visibility'

const loadVisibilityMap = () => {
    try {
        return JSON.parse(localStorage.getItem(VISIBILITY_STORAGE_KEY) || '{}')
    } catch {
        return {}
    }
}

const saveVisibilityMap = (map) => {
    localStorage.setItem(VISIBILITY_STORAGE_KEY, JSON.stringify(map))
}

const toExecutionData = (log) => {
    const status = log?.status || 'FINISHED'
    return JSON.stringify([
        {
            nodeId: 'llm_response',
            nodeLabel: 'LLM Response',
            status,
            data: {
                name: 'llm_response',
                input: null,
                output: log?.response_text || '',
                error: log?.error_message || null,
                metrics: {
                    tokens_used: Number(log?.tokens_used || 0),
                    execution_time_ms: Number(log?.execution_time_ms || 0)
                }
            }
        }
    ])
}

const toExecutionRow = (log) => {
    const visibilityMap = loadVisibilityMap()
    const id = log?.execution_log_id

    return {
        id,
        state: log?.status || 'FINISHED',
        status: log?.status || 'FINISHED',
        updatedDate: log?.created_at,
        createdDate: log?.created_at,
        runDate: log?.created_at,
        sessionId: log?.flow_version ? `v${log.flow_version}` : 'v1',
        isPublic: Boolean(visibilityMap[id]),
        agentflow: {
            id: log?.flow_id,
            name: `Flow ${String(log?.flow_id || '').slice(0, 8)}`
        },
        executionData: toExecutionData(log)
    }
}

const getAllExecutions = async (params = {}) => {
    const page = Math.max(1, Number(params?.page || 1))
    const limit = Math.max(1, Number(params?.limit || 10))
    const fetchLimit = Math.max(limit * page, 200)

    const response = await client.get('/flows/logs', {
        params: {
            limit: fetchLimit
        }
    })

    let rows = (response?.data || []).map(toExecutionRow)

    if (params?.state) {
        rows = rows.filter((row) => row.state === params.state)
    }

    if (params?.startDate) {
        const startDate = new Date(params.startDate).getTime()
        rows = rows.filter((row) => new Date(row.createdDate).getTime() >= startDate)
    }

    if (params?.endDate) {
        const endDate = new Date(params.endDate).getTime()
        rows = rows.filter((row) => new Date(row.createdDate).getTime() <= endDate)
    }

    if (params?.agentflowName) {
        const q = String(params.agentflowName).toLowerCase()
        rows = rows.filter((row) => String(row.agentflow?.name || '').toLowerCase().includes(q))
    }

    if (params?.sessionId) {
        const q = String(params.sessionId).toLowerCase()
        rows = rows.filter((row) => String(row.sessionId || '').toLowerCase().includes(q))
    }

    const start = (page - 1) * limit

    return {
        data: {
            data: rows.slice(start, start + limit),
            total: rows.length
        }
    }
}

const fetchExecutionById = async (executionId) => {
    const response = await client.get('/flows/logs', { params: { limit: 500 } })
    const logs = response?.data || []
    const found = logs.find((log) => log.execution_log_id === executionId)
    return found ? toExecutionRow(found) : null
}

const getExecutionById = async (executionId) => {
    const found = await fetchExecutionById(executionId)
    return { data: found }
}

const getExecutionByIdPublic = async (executionId) => {
    const found = await fetchExecutionById(executionId)
    const visibilityMap = loadVisibilityMap()
    if (!found || !visibilityMap[executionId]) {
        throw new Error('Execution not shared publicly')
    }
    return { data: found }
}

const deleteExecutions = async () => {
    return {
        data: {
            status: 'ok'
        }
    }
}

const updateExecution = async (executionId, body) => {
    const visibilityMap = loadVisibilityMap()
    visibilityMap[executionId] = Boolean(body?.isPublic)
    saveVisibilityMap(visibilityMap)

    return {
        data: {
            id: executionId,
            isPublic: Boolean(body?.isPublic)
        }
    }
}

export default {
    getAllExecutions,
    deleteExecutions,
    getExecutionById,
    getExecutionByIdPublic,
    updateExecution
}
