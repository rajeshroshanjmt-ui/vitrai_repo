import { createResource, deleteResource, listResource, toResourceBody } from './vetraiResources'

const getAllChatflowsMarketplaces = async () => {
    const flows = await listResource('marketplace', { limit: 500, offset: 0 })
    const items = (flows?.data?.data || []).filter((item) => item.payload?.type === 'Chatflow')
    return { data: items.map((item) => item.payload) }
}

const getAllToolsMarketplaces = async () => {
    const items = await listResource('tool', { limit: 200, offset: 0 })
    return {
        data: (items?.data?.data || []).map((tool) => ({
            id: tool.resource_id,
            templateName: tool.name,
            type: 'Tool',
            description: tool.payload?.description || '',
            badge: 'NEW',
            usecases: ['Automation'],
            framework: ['Langchain'],
            categories: ['Tool'],
            toolData: tool.payload || {}
        }))
    }
}

const getAllTemplatesFromMarketplaces = async () => {
    const flowsResp = await listResource('tool', { limit: 200, offset: 0 })
    const flowTemplates = [
        {
            id: 'starter-chatflow',
            templateName: 'Starter Chatflow',
            type: 'Chatflow',
            description: 'Basic LLM chat workflow starter template.',
            badge: 'POPULAR',
            framework: ['Langchain'],
            usecases: ['General Assistant'],
            categories: ['Starter'],
            flowData: JSON.stringify({ nodes: [], edges: [] })
        },
        {
            id: 'starter-agentflow',
            templateName: 'Starter Agentflow',
            type: 'AgentflowV2',
            description: 'Basic agent orchestration starter template.',
            badge: 'NEW',
            framework: ['Langgraph'],
            usecases: ['Automation'],
            categories: ['Starter'],
            flowData: JSON.stringify({ nodes: [], edges: [] })
        }
    ]

    const toolTemplates = (flowsResp?.data?.data || []).map((tool) => ({
        id: tool.resource_id,
        templateName: tool.name,
        type: 'Tool',
        description: tool.payload?.description || '',
        badge: 'NEW',
        framework: ['Langchain'],
        usecases: ['Automation'],
        categories: ['Tool'],
        toolData: tool.payload || {}
    }))

    return { data: [...flowTemplates, ...toolTemplates] }
}

const getAllCustomTemplates = async () => {
    const response = await listResource('marketplace', { limit: 500, offset: 0 })
    const items = (response?.data?.data || [])
        .filter((item) => item.payload?.isCustom)
        .map((item) => ({
            id: item.resource_id,
            templateName: item.name,
            type: item.payload?.type || 'Chatflow',
            description: item.payload?.description || '',
            badge: item.payload?.badge || 'NEW',
            framework: item.payload?.framework || ['Langgraph'],
            usecases: item.payload?.usecases || [],
            categories: item.payload?.categories || [],
            flowData: item.payload?.flowData,
            toolData: item.payload?.toolData
        }))

    return { data: items }
}

const saveAsCustomTemplate = async (body) => {
    const response = await createResource(
        'marketplace',
        toResourceBody(body?.templateName || body?.name || 'Custom Template', {
            isCustom: true,
            type: body?.type || 'Chatflow',
            description: body?.description || '',
            badge: body?.badge || 'NEW',
            framework: body?.framework || ['Langgraph'],
            usecases: body?.usecases || [],
            categories: body?.categories || [],
            flowData: body?.flowData,
            toolData: body?.toolData
        })
    )

    return {
        data: {
            id: response?.data?.resource_id
        }
    }
}

const deleteCustomTemplate = (id) => deleteResource('marketplace', id)

export default {
    getAllChatflowsMarketplaces,
    getAllToolsMarketplaces,
    getAllTemplatesFromMarketplaces,

    getAllCustomTemplates,
    saveAsCustomTemplate,
    deleteCustomTemplate
}
