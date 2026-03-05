import client from './client'

const toVetraiFlow = (row) => {
    const definition = row?.latest_definition || {}
    const flowData = {
        nodes: Array.isArray(definition?.nodes) ? definition.nodes : [],
        edges: Array.isArray(definition?.edges) ? definition.edges : []
    }

    return {
        id: row.flow_id,
        name: row.name,
        category: 'vetrai',
        deployed: Boolean(row.published_version),
        isPublic: false,
        updatedDate: row.created_at,
        flowData: JSON.stringify(flowData)
    }
}

const getAllChatflows = async (params = {}) => {
    const limit = params?.limit || 100
    const response = await client.get('/flows/list', { params: { limit } })
    const rows = response?.data?.items || []
    return {
        data: {
            data: rows.map(toVetraiFlow),
            total: response?.data?.count || rows.length
        }
    }
}

const getAllAgentflows = getAllChatflows

const getSpecificChatflow = async (id) => {
    const response = await client.get(`/flows/${id}`)
    const definition = response?.data?.json_definition || {}
    return {
        data: {
            id: response?.data?.flow_id,
            name: response?.data?.name,
            flowData: JSON.stringify({
                nodes: Array.isArray(definition?.nodes) ? definition.nodes : [],
                edges: Array.isArray(definition?.edges) ? definition.edges : []
            }),
            deployed: Boolean(response?.data?.published_version)
        }
    }
}

const getSpecificChatflowFromPublicEndpoint = getSpecificChatflow

const createNewChatflow = async (body) => {
    const definition = typeof body?.flowData === 'string' ? JSON.parse(body.flowData) : body?.flowData || {}
    const response = await client.post('/flows/create', {
        name: body?.name || 'Untitled Flow',
        json_definition: definition
    })
    return {
        data: {
            id: response?.data?.flow_id,
            flowId: response?.data?.flow_id,
            name: body?.name || 'Untitled Flow',
            flowData: JSON.stringify(definition)
        }
    }
}

const updateChatflow = async (id, body) => {
    const definition = typeof body?.flowData === 'string' ? JSON.parse(body.flowData) : body?.flowData || {}
    const response = await client.put(`/flows/${id}/draft`, {
        json_definition: definition
    })
    return {
        data: {
            id,
            version: response?.data?.version,
            flowData: JSON.stringify(definition)
        }
    }
}

const deleteChatflow = async (id) => {
    const response = await client.delete(`/flows/${id}`)
    return { data: response.data }
}

const getIsChatflowStreaming = async () => ({ data: { isStreaming: false } })

const getAllowChatflowUploads = async () => ({ data: { isUploadAllowed: true } })

const getHasChatflowChanged = async () => ({ data: { hasChanged: false } })

const generateAgentflow = async () => ({ data: { flowData: { nodes: [], edges: [] } } })

export default {
    getAllChatflows,
    getAllAgentflows,
    getSpecificChatflow,
    getSpecificChatflowFromPublicEndpoint,
    createNewChatflow,
    updateChatflow,
    deleteChatflow,
    getIsChatflowStreaming,
    getAllowChatflowUploads,
    getHasChatflowChanged,
    generateAgentflow
}
