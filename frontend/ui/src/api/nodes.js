const NODE_REGISTRY = [
    {
        name: 'ollamaChat',
        label: 'Ollama Chat',
        category: 'Chat Models',
        description: 'Run chat completions with Ollama.',
        baseClasses: ['ChatModel'],
        inputs: [
            { label: 'Model', name: 'model', type: 'string', default: 'llama3.2', optional: false },
            { label: 'Temperature', name: 'temperature', type: 'number', default: 0.7, optional: true }
        ],
        outputs: [{ label: 'Chat Model', name: 'chatModel', baseClasses: ['ChatModel'] }]
    },
    {
        name: 'promptTemplate',
        label: 'Prompt',
        category: 'Prompts',
        description: 'Compose prompts.',
        baseClasses: ['PromptTemplate'],
        inputs: [{ label: 'Template', name: 'template', type: 'string', default: '', optional: false }],
        outputs: [{ label: 'Prompt', name: 'prompt', baseClasses: ['PromptTemplate'] }]
    },
    {
        name: 'retrieverTool',
        label: 'Retriever Tool',
        category: 'Tools',
        description: 'Retriever as tool.',
        baseClasses: ['Tool'],
        inputs: [{ label: 'Name', name: 'name', type: 'string', default: 'retriever', optional: true }],
        outputs: [{ label: 'Tool', name: 'tool', baseClasses: ['Tool'] }]
    },
    {
        name: 'documentStoreVS',
        label: 'Document Store Retriever',
        category: 'Document Stores',
        description: 'Retrieve from document store.',
        baseClasses: ['Retriever'],
        inputs: [{ label: 'Store', name: 'selectedStore', type: 'string', default: '', optional: false }],
        outputs: [{ label: 'Retriever', name: 'retriever', baseClasses: ['Retriever'] }]
    },
    {
        name: 'recursiveCharacterTextSplitter',
        label: 'Recursive Character Text Splitter',
        category: 'Text Splitters',
        description: 'Split text into chunks.',
        baseClasses: ['TextSplitter'],
        inputs: [
            { label: 'Chunk Size', name: 'chunkSize', type: 'number', default: 1000, optional: true },
            { label: 'Chunk Overlap', name: 'chunkOverlap', type: 'number', default: 200, optional: true }
        ],
        outputs: [{ label: 'Splitter', name: 'textSplitter', baseClasses: ['TextSplitter'] }]
    },
    {
        name: 'customApiTool',
        label: 'API Tool',
        category: 'Tools',
        description: 'Call an external API.',
        baseClasses: ['Tool'],
        inputs: [
            { label: 'Endpoint', name: 'endpoint', type: 'string', default: '', optional: false },
            { label: 'Method', name: 'method', type: 'options', options: ['GET', 'POST'], default: 'GET', optional: true }
        ],
        outputs: [{ label: 'Tool', name: 'tool', baseClasses: ['Tool'] }]
    }
]

const getAllNodes = async () => ({ data: NODE_REGISTRY })

const getSpecificNode = async (name) => ({ data: NODE_REGISTRY.find((node) => node.name === name) || null })

const getNodesByCategory = async (name) => ({ data: NODE_REGISTRY.filter((node) => node.category === name) })

const executeCustomFunctionNode = async (body) => ({ data: { result: body } })

const executeNodeLoadMethod = async (_name, body) => {
    const model = body?.inputs?.model || 'llama3.2'
    return {
        data: [
            { label: model, name: model },
            { label: 'llama3.1', name: 'llama3.1' }
        ]
    }
}

export default {
    getAllNodes,
    getSpecificNode,
    executeCustomFunctionNode,
    getNodesByCategory,
    executeNodeLoadMethod
}
