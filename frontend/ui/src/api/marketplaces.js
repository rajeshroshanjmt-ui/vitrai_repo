import client from './client'
import { createResource, deleteResource, listResource, toResourceBody } from './vetraiResources'
import marketplaceTemplatesApi from './marketplaceTemplates'

const DEFAULT_CHAT_TEMPLATE_FLOW_DATA = JSON.stringify({
    __meta: { flowType: 'CHATFLOW', source: 'frontend-default' },
    nodes: [
        {
            id: 'promptTemplate_0',
            type: 'customNode',
            position: { x: 120, y: 160 },
            data: {
                id: 'promptTemplate_0',
                label: 'Prompt',
                name: 'promptTemplate',
                type: 'PromptTemplate',
                category: 'Prompts',
                description: 'Prompt template starter',
                inputParams: [
                    {
                        label: 'Template',
                        name: 'template',
                        type: 'string',
                        optional: false,
                        id: 'promptTemplate_0-input-template-string'
                    }
                ],
                inputAnchors: [],
                outputAnchors: [
                    {
                        id: 'promptTemplate_0-output-prompt-PromptTemplate',
                        name: 'prompt',
                        label: 'Prompt',
                        type: 'PromptTemplate'
                    }
                ],
                inputs: {
                    template: 'You are a helpful assistant. Ask clarifying questions when context is missing.'
                },
                outputs: {}
            }
        },
        {
            id: 'ollamaChat_0',
            type: 'customNode',
            position: { x: 500, y: 160 },
            data: {
                id: 'ollamaChat_0',
                label: 'Ollama Chat',
                name: 'ollamaChat',
                type: 'ChatModel',
                category: 'Chat Models',
                description: 'Chat model node',
                inputParams: [
                    { label: 'Model', name: 'model', type: 'string', optional: false, id: 'ollamaChat_0-input-model-string' },
                    {
                        label: 'Temperature',
                        name: 'temperature',
                        type: 'number',
                        optional: true,
                        id: 'ollamaChat_0-input-temperature-number'
                    }
                ],
                inputAnchors: [
                    {
                        id: 'ollamaChat_0-input-prompt-PromptTemplate',
                        label: 'Prompt',
                        name: 'prompt',
                        type: 'PromptTemplate'
                    }
                ],
                outputAnchors: [
                    {
                        id: 'ollamaChat_0-output-chatModel-ChatModel',
                        name: 'chatModel',
                        label: 'Chat Model',
                        type: 'ChatModel'
                    }
                ],
                inputs: { model: 'llama3.2', temperature: 0.7, prompt: '{{promptTemplate_0.data.instance}}' },
                outputs: {}
            }
        },
        {
            id: 'stringOutputParser_0',
            type: 'customNode',
            position: { x: 860, y: 160 },
            data: {
                id: 'stringOutputParser_0',
                label: 'String Output Parser',
                name: 'stringOutputParser',
                type: 'OutputParser',
                category: 'Output Parsers',
                description: 'Parse output as plain text',
                inputParams: [],
                inputAnchors: [
                    {
                        id: 'stringOutputParser_0-input-input-string',
                        label: 'Input',
                        name: 'input',
                        type: 'string'
                    }
                ],
                outputAnchors: [],
                inputs: { input: '{{ollamaChat_0.data.instance}}' },
                outputs: {}
            }
        }
    ],
    edges: [
        {
            source: 'promptTemplate_0',
            sourceHandle: 'promptTemplate_0-output-prompt-PromptTemplate',
            target: 'ollamaChat_0',
            targetHandle: 'ollamaChat_0-input-prompt-PromptTemplate',
            type: 'buttonedge',
            id: 'promptTemplate_0-promptTemplate_0-output-prompt-PromptTemplate-ollamaChat_0-ollamaChat_0-input-prompt-PromptTemplate'
        },
        {
            source: 'ollamaChat_0',
            sourceHandle: 'ollamaChat_0-output-chatModel-ChatModel',
            target: 'stringOutputParser_0',
            targetHandle: 'stringOutputParser_0-input-input-string',
            type: 'buttonedge',
            id: 'ollamaChat_0-ollamaChat_0-output-chatModel-ChatModel-stringOutputParser_0-stringOutputParser_0-input-input-string'
        }
    ]
})

const DEFAULT_AGENT_TEMPLATE_FLOW_DATA = JSON.stringify({
    __meta: { flowType: 'AGENTFLOW', source: 'frontend-default' },
    nodes: [
        {
            id: 'startAgentflow_0',
            type: 'agentFlow',
            position: { x: 140, y: 180 },
            data: {
                id: 'startAgentflow_0',
                label: 'Start',
                name: 'startAgentflow',
                color: '#7EE787',
                inputParams: [],
                inputAnchors: [],
                outputAnchors: [{ id: 'startAgentflow_0-output-0', label: 'Start', name: 'startAgentflow' }],
                inputs: {},
                outputs: {}
            }
        },
        {
            id: 'llmAgentflow_0',
            type: 'agentFlow',
            position: { x: 460, y: 180 },
            data: {
                id: 'llmAgentflow_0',
                label: 'LLM',
                name: 'llmAgentflow',
                color: '#64B5F6',
                inputParams: [
                    {
                        label: 'Instruction',
                        name: 'instruction',
                        type: 'string',
                        optional: true,
                        id: 'llmAgentflow_0-input-instruction-string'
                    }
                ],
                inputAnchors: [],
                outputAnchors: [{ id: 'llmAgentflow_0-output-0', label: 'LLM', name: 'llmAgentflow' }],
                inputs: {
                    instruction: 'Summarize context, reason step-by-step, and produce an actionable response.'
                },
                outputs: {}
            }
        },
        {
            id: 'directReplyAgentflow_0',
            type: 'agentFlow',
            position: { x: 780, y: 180 },
            data: {
                id: 'directReplyAgentflow_0',
                label: 'Reply',
                name: 'directReplyAgentflow',
                color: '#4DDBBB',
                inputParams: [
                    {
                        label: 'Reply Template',
                        name: 'replyTemplate',
                        type: 'string',
                        optional: true,
                        id: 'directReplyAgentflow_0-input-replyTemplate-string'
                    }
                ],
                inputAnchors: [],
                outputAnchors: [],
                inputs: { replyTemplate: 'Return concise final answer with clear next steps.' },
                outputs: {}
            }
        }
    ],
    edges: [
        {
            source: 'startAgentflow_0',
            sourceHandle: 'startAgentflow_0-output-0',
            target: 'llmAgentflow_0',
            targetHandle: 'llmAgentflow_0',
            type: 'agentFlow',
            id: 'startAgentflow_0-startAgentflow_0-output-0-llmAgentflow_0-llmAgentflow_0',
            data: {
                sourceColor: '#7EE787',
                targetColor: '#64B5F6'
            }
        },
        {
            source: 'llmAgentflow_0',
            sourceHandle: 'llmAgentflow_0-output-0',
            target: 'directReplyAgentflow_0',
            targetHandle: 'directReplyAgentflow_0',
            type: 'agentFlow',
            id: 'llmAgentflow_0-llmAgentflow_0-output-0-directReplyAgentflow_0-directReplyAgentflow_0',
            data: {
                sourceColor: '#64B5F6',
                targetColor: '#4DDBBB'
            }
        }
    ]
})

const FLOW_TEMPLATE_TYPES = new Set(['Chatflow', 'Agentflow', 'AgentflowV2'])
const RESOURCE_PAGE_SIZE = 200

const DEFAULT_ASSISTANT_TEMPLATE_INSTRUCTION =
    'You are a practical assistant. Ask concise clarifying questions, provide actionable steps, and separate facts from assumptions.'

const getDefaultFlowDataByType = (type) => {
    if (type === 'Agentflow' || type === 'AgentflowV2') return DEFAULT_AGENT_TEMPLATE_FLOW_DATA
    if (type === 'Chatflow') return DEFAULT_CHAT_TEMPLATE_FLOW_DATA
    return undefined
}

const isFlowTemplateType = (type) => FLOW_TEMPLATE_TYPES.has(type || '')

const normalizeFlowData = (flowData, type) => {
    if (!isFlowTemplateType(type)) return undefined
    const fallback = getDefaultFlowDataByType(type)
    if (!flowData) return fallback || DEFAULT_CHAT_TEMPLATE_FLOW_DATA

    try {
        const parsed = typeof flowData === 'string' ? JSON.parse(flowData) : flowData
        const nodes = Array.isArray(parsed?.nodes) ? parsed.nodes : []
        const edges = Array.isArray(parsed?.edges) ? parsed.edges : []
        if (!nodes.length) return fallback || DEFAULT_CHAT_TEMPLATE_FLOW_DATA
        return JSON.stringify({
            ...(parsed && typeof parsed === 'object' ? parsed : {}),
            nodes,
            edges
        })
    } catch {
        return fallback || DEFAULT_CHAT_TEMPLATE_FLOW_DATA
    }
}

const dedupeByTypeAndName = (templates) => {
    const deduped = []
    const seen = new Set()

    templates.forEach((item) => {
        const name = item?.templateName || item?.name || item?.id
        const key = `${item?.type || 'Unknown'}:${name}`
        if (seen.has(key)) return
        seen.add(key)
        deduped.push(item)
    })

    return deduped
}

const fallbackId = () => `fallback-${Date.now()}-${Math.floor(Math.random() * 100000)}`

const fetchAllResourcePages = async (resourceType) => {
    const rows = []
    let offset = 0
    let hasMore = true

    while (hasMore) {
        const response = await listResource(resourceType, { limit: RESOURCE_PAGE_SIZE, offset })
        const items = response?.data?.data || []
        rows.push(...items)
        hasMore = items.length === RESOURCE_PAGE_SIZE
        offset += RESOURCE_PAGE_SIZE
    }

    return rows
}

const normalizeTemplateResource = (item) => {
    const payload = item?.payload || {}
    const type = payload?.type || 'Chatflow'
    const normalized = {
        id: item?.resource_id || fallbackId(),
        templateName: item?.name || payload?.templateName || 'Untitled Template',
        type,
        description: payload?.description || '',
        badge: payload?.badge || 'NEW',
        framework: payload?.framework || (type === 'Assistant' ? ['Assistant Runtime'] : ['Langgraph']),
        usecases: payload?.usecases || [],
        categories: payload?.categories || [],
        toolData: payload?.toolData,
        assistantData: payload?.assistantData
    }

    if (isFlowTemplateType(type)) {
        normalized.flowData = normalizeFlowData(payload?.flowData, type)
    }

    return normalized
}

const buildAssistantDetails = (template) => {
    const assistantConfig = template?.assistantData || {}
    const templateName = template?.templateName || template?.name || 'Marketplace Assistant'
    return {
        name: templateName,
        instruction: assistantConfig?.instruction || DEFAULT_ASSISTANT_TEMPLATE_INSTRUCTION,
        profileId: assistantConfig?.profileId || `marketplace_${templateName.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
        profileLabel: assistantConfig?.profileLabel || templateName,
        qualityPreset: assistantConfig?.qualityPreset || 'marketplace_regenerated_v1',
        sourceTemplate: {
            templateName,
            categories: template?.categories || [],
            usecases: template?.usecases || []
        }
    }
}

const importAssistantTemplate = async (template) => {
    const credential = globalThis?.crypto?.randomUUID?.() || `assistant-${Date.now()}-${Math.floor(Math.random() * 100000)}`
    const response = await client.post('/assistants', {
        details: JSON.stringify(buildAssistantDetails(template)),
        credential,
        type: 'CUSTOM'
    })
    return { data: response?.data }
}

const getAllChatflowsMarketplaces = async () => {
    const templates = await fetchAllResourcePages('marketplace')
    const items = templates.filter((item) => item?.payload?.type === 'Chatflow')
    return {
        data: items.map((item) => normalizeTemplateResource(item))
    }
}

const getAllToolsMarketplaces = async () => {
    const items = await fetchAllResourcePages('tool')
    return {
        data: items.map((tool) => ({
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

const convertPrebuiltTemplateToNormalized = (template) => {
    // Convert 1000+ marketplace templates to existing marketplace format
    const typeMap = {
        'Chatflow': 'Chatflow',
        'Agentflow': 'AgentflowV2',
        'Assistant': 'Assistant'
    }

    return {
        id: template.id,
        templateName: template.name,
        type: typeMap[template.type] || template.type,
        description: template.description || template.preview || '',
        badge: template.tags?.includes('popular') ? 'POPULAR' : template.tags?.includes('new') ? 'NEW' : '',
        framework: [template.framework] || ['Langchain'],
        usecases: template.usecases || [],
        categories: [template.category] || [],
        difficulty: template.difficulty,
        tags: template.tags || [],
        thumbnail: template.thumbnail,
        isPrebuiltLibrary: true,
        // Use empty flow data - actual templates load from backend
        flowData: null,
        assistantData: null
    }
}

const getAllTemplatesFromMarketplaces = async () => {
    const [toolsResp, marketplaceResp, newTemplatesResp] = await Promise.all([
        fetchAllResourcePages('tool'),
        fetchAllResourcePages('marketplace'),
        marketplaceTemplatesApi.getAllTemplates({ limit: 1000 }).catch((err) => {
            console.warn('Failed to load marketplace templates:', err)
            return { data: [] }
        })
    ])

    const backendTemplates = (marketplaceResp || [])
        .filter((item) => {
            const payload = item?.payload || {}
            if (payload?.isCustom) return false
            return payload?.isPrebuilt || payload?.flowData || payload?.toolData || payload?.assistantData
        })
        .map((item) => normalizeTemplateResource(item))

    // Convert and integrate 1000+ prebuilt templates
    const templateData = newTemplatesResp?.data || []
    const prebuiltLibraryTemplates = (Array.isArray(templateData) ? templateData : []).map(convertPrebuiltTemplateToNormalized).filter(t => t)

    const hasChatflowTemplate = backendTemplates.some((template) => template.type === 'Chatflow') || prebuiltLibraryTemplates.some((t) => t.type === 'Chatflow')
    const hasAgentflowTemplate = backendTemplates.some((template) => template.type === 'AgentflowV2' || template.type === 'Agentflow') || prebuiltLibraryTemplates.some((t) => t.type === 'AgentflowV2')
    const hasAssistantTemplate = backendTemplates.some((template) => template.type === 'Assistant') || prebuiltLibraryTemplates.some((t) => t.type === 'Assistant')

    const fallbackStarterTemplates = [
        {
            id: 'starter-chatflow',
            templateName: 'Starter Chatflow',
            type: 'Chatflow',
            description: 'Basic LLM chat workflow starter template.',
            badge: 'POPULAR',
            framework: ['Langchain'],
            usecases: ['General Assistant'],
            categories: ['Starter'],
            flowData: getDefaultFlowDataByType('Chatflow')
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
            flowData: getDefaultFlowDataByType('AgentflowV2')
        },
        {
            id: 'starter-assistant',
            templateName: 'Starter Assistant',
            type: 'Assistant',
            description: 'Basic custom assistant starter template.',
            badge: 'NEW',
            framework: ['Assistant Runtime'],
            usecases: ['General Assistant'],
            categories: ['Starter'],
            assistantData: {
                profileId: 'starter_assistant',
                profileLabel: 'Starter Assistant',
                qualityPreset: 'marketplace_regenerated_v1',
                instruction: DEFAULT_ASSISTANT_TEMPLATE_INSTRUCTION
            }
        }
    ]

    const localTemplates = fallbackStarterTemplates.filter((template) => {
        if (template.type === 'Chatflow') return !hasChatflowTemplate
        if (template.type === 'AgentflowV2' || template.type === 'Agentflow') return !hasAgentflowTemplate
        if (template.type === 'Assistant') return !hasAssistantTemplate
        return true
    })

    const toolTemplates = (toolsResp || []).map((tool) => ({
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

    // Merge all templates: backend + prebuilt library + local + tools
    const merged = [...backendTemplates, ...prebuiltLibraryTemplates, ...localTemplates, ...toolTemplates]
    const deduped = dedupeByTypeAndName(merged)

    return { data: deduped }
}

const getAllCustomTemplates = async () => {
    const response = await fetchAllResourcePages('marketplace')
    const items = (response || []).filter((item) => item?.payload?.isCustom).map((item) => normalizeTemplateResource(item))

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
            toolData: body?.toolData,
            assistantData: body?.assistantData
        })
    )

    return {
        data: {
            id: response?.data?.resource_id
        }
    }
}

const deleteCustomTemplate = (id) => deleteResource('marketplace', id)

const useTemplate = async (templateId, options = {}) => {
    const response = await client.post(`/marketplace/templates/${templateId}/use`, options)
    return { data: response?.data }
}

export default {
    getAllChatflowsMarketplaces,
    getAllToolsMarketplaces,
    getAllTemplatesFromMarketplaces,
    importAssistantTemplate,

    getAllCustomTemplates,
    saveAsCustomTemplate,
    deleteCustomTemplate,
    useTemplate
}
