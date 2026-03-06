import { createResource, deleteResource, listResource, toResourceBody } from './vetraiResources'

const EMPTY_FLOW_DATA = JSON.stringify({ nodes: [], edges: [] })

const INDUSTRIES = [
    'Healthcare',
    'Banking',
    'Insurance',
    'Retail',
    'Ecommerce',
    'Logistics',
    'Manufacturing',
    'Telecommunications',
    'Education',
    'Real Estate',
    'Hospitality',
    'Travel',
    'Energy',
    'Public Sector',
    'Legal',
    'Pharmaceutical',
    'Media',
    'Automotive',
    'Human Resources',
    'Cybersecurity'
]

const CHATFLOW_PATTERNS = [
    {
        title: 'Support Copilot',
        usecase: 'Customer Support',
        categories: ['Support', 'Q&A'],
        description: 'Assist support teams with faster, consistent, policy-aware responses.'
    },
    {
        title: 'Knowledge Assistant',
        usecase: 'Knowledge Retrieval',
        categories: ['RAG', 'Knowledge Base'],
        description: 'Answer user questions from approved company knowledge sources.'
    },
    {
        title: 'Onboarding Guide',
        usecase: 'User Onboarding',
        categories: ['Onboarding', 'Self-Service'],
        description: 'Guide users through setup, activation, and first-value milestones.'
    }
]

const AGENTFLOW_PATTERNS = [
    {
        title: 'Ticket Triage Orchestrator',
        usecase: 'Ticket Automation',
        categories: ['Routing', 'Automation'],
        description: 'Classify, prioritize, and route incoming requests across internal teams.'
    },
    {
        title: 'Compliance Workflow Agent',
        usecase: 'Compliance Operations',
        categories: ['Compliance', 'Review'],
        description: 'Collect evidence, validate policies, and escalate approval steps automatically.'
    },
    {
        title: 'Daily Operations Coordinator',
        usecase: 'Operations Automation',
        categories: ['Ops', 'Scheduling'],
        description: 'Run recurring checks, summarize status, and trigger downstream tasks.'
    }
]

const getBadge = (index) => {
    if (index % 11 === 0) return 'POPULAR'
    if (index % 3 === 0) return 'NEW'
    return undefined
}

const buildRealWorldTemplates = () => {
    const templates = []
    let index = 1

    INDUSTRIES.forEach((industry) => {
        CHATFLOW_PATTERNS.forEach((pattern) => {
            templates.push({
                id: `rw-chatflow-${String(index).padStart(3, '0')}`,
                templateName: `${industry} ${pattern.title}`,
                type: 'Chatflow',
                description: `${industry}: ${pattern.description}`,
                badge: getBadge(index),
                framework: ['Langchain'],
                usecases: [`${industry} ${pattern.usecase}`, pattern.usecase, industry],
                categories: ['Real World', industry, ...pattern.categories],
                flowData: EMPTY_FLOW_DATA
            })
            index += 1
        })
    })

    INDUSTRIES.forEach((industry) => {
        AGENTFLOW_PATTERNS.forEach((pattern) => {
            templates.push({
                id: `rw-agentflow-${String(index).padStart(3, '0')}`,
                templateName: `${industry} ${pattern.title}`,
                type: 'AgentflowV2',
                description: `${industry}: ${pattern.description}`,
                badge: getBadge(index),
                framework: ['Langgraph'],
                usecases: [`${industry} ${pattern.usecase}`, pattern.usecase, industry],
                categories: ['Real World', industry, ...pattern.categories],
                flowData: EMPTY_FLOW_DATA
            })
            index += 1
        })
    })

    return templates
}

const REAL_WORLD_TEMPLATES = buildRealWorldTemplates()

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
    const [toolsResp, marketplaceResp] = await Promise.all([
        listResource('tool', { limit: 200, offset: 0 }),
        listResource('marketplace', { limit: 800, offset: 0 })
    ])

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
            flowData: EMPTY_FLOW_DATA
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
            flowData: EMPTY_FLOW_DATA
        },
        ...REAL_WORLD_TEMPLATES
    ]

    const prebuiltTemplates = (marketplaceResp?.data?.data || [])
        .filter((item) => {
            const payload = item?.payload || {}
            if (payload?.isCustom) return false
            return payload?.isPrebuilt || payload?.flowData || payload?.toolData
        })
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

    const toolTemplates = (toolsResp?.data?.data || []).map((tool) => ({
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

    const merged = [...prebuiltTemplates, ...flowTemplates, ...toolTemplates]
    const deduped = Array.from(new Map(merged.map((item) => [`${item.type}:${item.templateName}`, item])).values())

    return { data: deduped }
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
