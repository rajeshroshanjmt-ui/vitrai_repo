import client from './client'
import { unavailableObjectResponse, unavailableResponse } from './responseAdapter'

const DEFAULT_FLOW_TYPE = 'CHATFLOW'

const normalizeFlowType = (value) => {
    const flowType = String(value || DEFAULT_FLOW_TYPE).toUpperCase()
    if (flowType === 'AGENTFLOW' || flowType === 'MULTIAGENT' || flowType === 'CHATFLOW') return flowType
    return DEFAULT_FLOW_TYPE
}

const inferFlowTypeFromDefinition = (definition) => {
    const typed = normalizeFlowType(definition?.__meta?.flowType || definition?.flowType || definition?.type)
    if (typed !== DEFAULT_FLOW_TYPE) return typed

    const nodes = Array.isArray(definition?.nodes) ? definition.nodes : []
    const looksLikeAgentflow = nodes.some((node) => {
        const nodeName = String(node?.data?.name || '').toLowerCase()
        return nodeName.includes('agentflow') || nodeName.includes('agent')
    })
    return looksLikeAgentflow ? 'AGENTFLOW' : DEFAULT_FLOW_TYPE
}

const ensureFlowDefinition = (definition, requestedType) => {
    const flowType = normalizeFlowType(requestedType || inferFlowTypeFromDefinition(definition))
    return {
        ...(definition && typeof definition === 'object' ? definition : {}),
        __meta: {
            ...((definition && typeof definition === 'object' && definition.__meta) || {}),
            flowType
        }
    }
}

const parseListArgs = (arg1, arg2, defaultType = DEFAULT_FLOW_TYPE) => {
    const hasStringType = typeof arg1 === 'string'
    const requestedType = normalizeFlowType(hasStringType ? arg1 : defaultType)
    const params = (hasStringType ? arg2 : arg1) || {}

    return {
        requestedType,
        params
    }
}

const toVetraiFlow = (row, requestedType) => {
    const definition = ensureFlowDefinition(row?.latest_definition || {}, requestedType)
    const flowType = inferFlowTypeFromDefinition(definition)
    const flowData = {
        ...definition,
        nodes: Array.isArray(definition?.nodes) ? definition.nodes : [],
        edges: Array.isArray(definition?.edges) ? definition.edges : []
    }

    return {
        id: row.flow_id,
        name: row.name,
        type: flowType,
        category: flowType === 'CHATFLOW' ? 'chatflow' : 'agentflow',
        deployed: Boolean(row.published_version),
        isPublic: false,
        updatedDate: row.created_at,
        flowData: JSON.stringify(flowData)
    }
}

const getAllChatflows = async (arg1 = {}, arg2 = {}) => {
    const { requestedType, params } = parseListArgs(arg1, arg2, DEFAULT_FLOW_TYPE)
    const limit = params?.limit || 100
    const response = await client.get('/flows/list', { params: { limit } })
    const rows = response?.data?.items || []
    const mapped = rows.map((row) => toVetraiFlow(row, requestedType)).filter((flow) => flow.type === requestedType)

    return {
        data: {
            data: mapped,
            total: mapped.length
        }
    }
}

const getAllAgentflows = async (arg1 = 'AGENTFLOW', arg2 = {}) => {
    const flowType = typeof arg1 === 'string' ? arg1 : 'AGENTFLOW'
    const params = typeof arg1 === 'string' ? arg2 : arg1
    return getAllChatflows(flowType, params)
}

const getSpecificChatflow = async (id) => {
    const response = await client.get(`/flows/${id}`)
    const definition = ensureFlowDefinition(response?.data?.json_definition || {})
    const flowType = inferFlowTypeFromDefinition(definition)

    return {
        data: {
            id: response?.data?.flow_id,
            name: response?.data?.name,
            flowData: JSON.stringify({
                ...definition,
                nodes: Array.isArray(definition?.nodes) ? definition.nodes : [],
                edges: Array.isArray(definition?.edges) ? definition.edges : []
            }),
            type: flowType,
            deployed: Boolean(response?.data?.published_version)
        }
    }
}

const getSpecificChatflowFromPublicEndpoint = async (id) => {
    try {
        return await getSpecificChatflow(id)
    } catch (error) {
        const status = error?.response?.status
        if (status === 401 || status === 403 || status === 404 || status === 501 || status === 503) {
            return unavailableObjectResponse(status || 404)
        }
        throw error
    }
}

const getPublicChatbotCompatibility = async (id) => {
    try {
        const response = await client.get(`/v1/chatflows-streaming/${id}`)
        const payload = response?.data || {}
        const explicitlyUnsupported = payload?.supported === false || payload?.isUnavailable === true
        return {
            data: {
                ...payload,
                supported: response.status >= 200 && response.status < 300 && !explicitlyUnsupported,
                status: response.status
            },
            status: response.status
        }
    } catch (error) {
        const status = error?.response?.status
        if (status === 401 || status === 403 || status === 404 || status === 405 || status === 501 || status === 503) {
            return unavailableResponse(
                {
                    supported: false,
                    status: status || 404
                },
                status || 404
            )
        }
        throw error
    }
}

const createNewChatflow = async (body) => {
    const rawDefinition = typeof body?.flowData === 'string' ? JSON.parse(body.flowData) : body?.flowData || {}
    const definition = ensureFlowDefinition(rawDefinition, body?.type)
    const flowType = inferFlowTypeFromDefinition(definition)

    const response = await client.post('/flows/create', {
        name: body?.name || 'Untitled Flow',
        json_definition: definition
    })
    return {
        data: {
            id: response?.data?.flow_id,
            flowId: response?.data?.flow_id,
            name: body?.name || 'Untitled Flow',
            type: flowType,
            flowData: JSON.stringify(definition)
        }
    }
}

const updateChatflow = async (id, body) => {
    const rawDefinition = typeof body?.flowData === 'string' ? JSON.parse(body.flowData) : body?.flowData || {}
    const definition = ensureFlowDefinition(rawDefinition, body?.type)
    const flowType = inferFlowTypeFromDefinition(definition)
    const response = await client.put(`/flows/${id}/draft`, {
        json_definition: definition
    })
    return {
        data: {
            id,
            version: response?.data?.version,
            type: flowType,
            flowData: JSON.stringify(definition)
        }
    }
}

const deleteChatflow = async (id) => {
    const response = await client.delete(`/flows/${id}`)
    return { data: response.data }
}

const getIsChatflowStreaming = async () => ({ data: { isStreaming: false } })

const getAllowChatflowUploads = async () => ({
    data: {
        isUploadAllowed: true,
        isImageUploadAllowed: false,
        isRAGFileUploadAllowed: false,
        isSpeechToTextEnabled: false,
        imgUploadSizeAndTypes: [],
        fileUploadSizeAndTypes: []
    }
})

const getHasChatflowChanged = async () => ({ data: { hasChanged: false } })

const generateAgentflow = async (body = {}) => {
    const prompt = String(body?.prompt || body?.task || body?.question || '').trim()
    const response = await client.post('/assistants/generate/instruction', {
        prompt,
        task: prompt,
        question: prompt,
        selectedChatModel: body?.selectedChatModel || {}
    })

    const payload = response?.data || {}
    const flowData = payload?.flowData || {}
    const nodes = Array.isArray(payload?.nodes) ? payload.nodes : Array.isArray(flowData?.nodes) ? flowData.nodes : null
    const edges = Array.isArray(payload?.edges) ? payload.edges : Array.isArray(flowData?.edges) ? flowData.edges : null

    return {
        data: {
            ...payload,
            ...(nodes && edges ? { nodes, edges } : {})
        }
    }
}

export default {
    getAllChatflows,
    getAllAgentflows,
    getSpecificChatflow,
    getSpecificChatflowFromPublicEndpoint,
    getPublicChatbotCompatibility,
    createNewChatflow,
    updateChatflow,
    deleteChatflow,
    getIsChatflowStreaming,
    getAllowChatflowUploads,
    getHasChatflowChanged,
    generateAgentflow
}
