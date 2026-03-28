import client from './client'

const CORE_NODE_REGISTRY = [
    {
        name: 'agentExecutor',
        label: 'Agent Executor',
        category: 'Agents',
        description: 'Execute an agent with model and tools.',
        baseClasses: ['AgentExecutor'],
        inputs: [
            { label: 'Model', name: 'model', type: 'ChatModel', optional: false },
            { label: 'Tools', name: 'tools', type: 'Tool', list: true, optional: true },
            {
                label: 'System Prompt',
                name: 'systemPrompt',
                type: 'string',
                default: 'You are a helpful assistant.',
                optional: true
            }
        ],
        outputs: [{ label: 'Agent', name: 'agent', baseClasses: ['AgentExecutor'] }]
    },
    {
        name: 'inMemoryCache',
        label: 'In-Memory Cache',
        category: 'Cache',
        description: 'Cache responses in process memory.',
        baseClasses: ['BaseCache'],
        inputs: [{ label: 'Max Entries', name: 'maxEntries', type: 'number', default: 1000, optional: true }],
        outputs: [{ label: 'Cache', name: 'cache', baseClasses: ['BaseCache'] }]
    },
    {
        name: 'redisCache',
        label: 'Redis Cache',
        category: 'Cache',
        description: 'Use Redis for cache storage.',
        baseClasses: ['BaseCache'],
        inputs: [{ label: 'Redis URL', name: 'url', type: 'string', default: '', optional: false }],
        outputs: [{ label: 'Cache', name: 'cache', baseClasses: ['BaseCache'] }]
    },
    {
        name: 'llmChain',
        label: 'LLM Chain',
        category: 'Chains',
        description: 'Run prompt + model as a chain.',
        baseClasses: ['Chain'],
        inputs: [
            { label: 'Model', name: 'model', type: 'ChatModel', optional: false },
            { label: 'Prompt', name: 'prompt', type: 'PromptTemplate', optional: false }
        ],
        outputs: [{ label: 'Chain', name: 'chain', baseClasses: ['Chain'] }]
    },
    {
        name: 'conversationalRetrievalChain',
        label: 'Conversational Retrieval Chain',
        category: 'Chains',
        description: 'Chat chain with retriever context.',
        baseClasses: ['Chain'],
        inputs: [
            { label: 'Model', name: 'model', type: 'ChatModel', optional: false },
            { label: 'Retriever', name: 'retriever', type: 'Retriever', optional: false }
        ],
        outputs: [{ label: 'Chain', name: 'chain', baseClasses: ['Chain'] }]
    },
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
        name: 'openAIChat',
        label: 'OpenAI Chat',
        category: 'Chat Models',
        description: 'Run chat completions with OpenAI.',
        baseClasses: ['ChatModel'],
        inputs: [
            { label: 'Model', name: 'model', type: 'string', default: 'gpt-4o-mini', optional: false },
            { label: 'Temperature', name: 'temperature', type: 'number', default: 0.7, optional: true }
        ],
        outputs: [{ label: 'Chat Model', name: 'chatModel', baseClasses: ['ChatModel'] }]
    },
    {
        name: 'anthropicChat',
        label: 'Anthropic Chat',
        category: 'Chat Models',
        description: 'Run chat completions with Anthropic models.',
        baseClasses: ['ChatModel'],
        inputs: [
            { label: 'Model', name: 'model', type: 'string', default: 'claude-3-5-sonnet-latest', optional: false },
            { label: 'Temperature', name: 'temperature', type: 'number', default: 0.7, optional: true }
        ],
        outputs: [{ label: 'Chat Model', name: 'chatModel', baseClasses: ['ChatModel'] }]
    },
    {
        name: 'textFileLoader',
        label: 'Text File Loader',
        category: 'Document Loaders',
        description: 'Load plain text files.',
        baseClasses: ['Document'],
        inputs: [{ label: 'Path', name: 'path', type: 'string', default: '', optional: false }],
        outputs: [{ label: 'Document', name: 'document', baseClasses: ['Document'] }]
    },
    {
        name: 'webLoader',
        label: 'Web Loader',
        category: 'Document Loaders',
        description: 'Load content from web pages.',
        baseClasses: ['Document'],
        inputs: [{ label: 'URL', name: 'url', type: 'string', default: '', optional: false }],
        outputs: [{ label: 'Document', name: 'document', baseClasses: ['Document'] }]
    },
    {
        name: 'pdfFileLoader',
        label: 'PDF Loader',
        category: 'Document Loaders',
        description: 'Load text from PDF files.',
        baseClasses: ['Document'],
        inputs: [{ label: 'Path', name: 'path', type: 'string', default: '', optional: false }],
        outputs: [{ label: 'Document', name: 'document', baseClasses: ['Document'] }]
    },
    {
        name: 'csvFileLoader',
        label: 'CSV File Loader',
        category: 'Document Loaders',
        description: 'Load and parse CSV files.',
        baseClasses: ['Document'],
        inputs: [
            { label: 'File Upload', name: 'fileUpload', type: 'file', fileType: '.csv', optional: true },
            { label: 'File Path', name: 'path', type: 'string', optional: true }
        ],
        outputs: [{ label: 'Document', name: 'document', baseClasses: ['Document'] }]
    },
    {
        name: 'jsonFileLoader',
        label: 'JSON File Loader',
        category: 'Document Loaders',
        description: 'Load and parse JSON files.',
        baseClasses: ['Document'],
        inputs: [
            { label: 'File Upload', name: 'fileUpload', type: 'file', fileType: '.json', optional: true },
            { label: 'File Path', name: 'path', type: 'string', optional: true }
        ],
        outputs: [{ label: 'Document', name: 'document', baseClasses: ['Document'] }]
    },
    {
        name: 'jsonLinesLoader',
        label: 'JSON Lines File Loader',
        category: 'Document Loaders',
        description: 'Load and parse JSONL (JSON Lines) files.',
        baseClasses: ['Document'],
        inputs: [
            { label: 'File Upload', name: 'fileUpload', type: 'file', fileType: '.jsonl,.ndjson', optional: true },
            { label: 'File Path', name: 'path', type: 'string', optional: true },
            { label: 'Text Key', name: 'textKey', type: 'string', default: 'text', optional: true }
        ],
        outputs: [{ label: 'Document', name: 'document', baseClasses: ['Document'] }]
    },
    {
        name: 'docxFileLoader',
        label: 'Docx File Loader',
        category: 'Document Loaders',
        description: 'Load text from DOCX (Word) files.',
        baseClasses: ['Document'],
        inputs: [
            { label: 'File Upload', name: 'fileUpload', type: 'file', fileType: '.docx', optional: true },
            { label: 'File Path', name: 'path', type: 'string', optional: true }
        ],
        outputs: [{ label: 'Document', name: 'document', baseClasses: ['Document'] }]
    },
    {
        name: 'excelFileLoader',
        label: 'Excel File Loader',
        category: 'Document Loaders',
        description: 'Load and parse Excel files.',
        baseClasses: ['Document'],
        inputs: [
            { label: 'File Upload', name: 'fileUpload', type: 'file', fileType: '.xlsx,.xls', optional: true },
            { label: 'File Path', name: 'path', type: 'string', optional: true },
            { label: 'Sheet Name', name: 'sheetName', type: 'string', optional: true }
        ],
        outputs: [{ label: 'Document', name: 'document', baseClasses: ['Document'] }]
    },
    {
        name: 'notionLoader',
        label: 'Notion',
        category: 'Document Loaders',
        description: 'Load content from Notion pages.',
        baseClasses: ['Document'],
        inputs: [
            { label: 'Notion Page ID', name: 'notionPageId', type: 'string', optional: false },
            { label: 'Notion API Key', name: 'credential', type: 'credential', credentialNames: ['notionApi'], optional: false }
        ],
        outputs: [{ label: 'Document', name: 'document', baseClasses: ['Document'] }]
    },
    {
        name: 'githubLoader',
        label: 'Github',
        category: 'Document Loaders',
        description: 'Load files from a GitHub repository.',
        baseClasses: ['Document'],
        inputs: [
            { label: 'Repo URL', name: 'repoLink', type: 'string', optional: false },
            { label: 'Branch', name: 'branch', type: 'string', default: 'main', optional: true },
            { label: 'File Extensions', name: 'fileExtensions', type: 'string', default: '.md,.txt,.py,.js,.ts', optional: true },
            { label: 'Recursive', name: 'recursive', type: 'boolean', default: true, optional: true },
            { label: 'GitHub Token', name: 'credential', type: 'credential', credentialNames: ['githubApi'], optional: true }
        ],
        outputs: [{ label: 'Document', name: 'document', baseClasses: ['Document'] }]
    },
    {
        name: 'confluenceLoader',
        label: 'Confluence',
        category: 'Document Loaders',
        description: 'Load pages from a Confluence space.',
        baseClasses: ['Document'],
        inputs: [
            { label: 'Base URL', name: 'baseUrl', type: 'string', optional: false },
            { label: 'Space Key', name: 'spaceKey', type: 'string', optional: false },
            { label: 'Username', name: 'confluenceUsername', type: 'string', optional: true },
            { label: 'API Token', name: 'credential', type: 'credential', credentialNames: ['confluenceApi'], optional: false }
        ],
        outputs: [{ label: 'Document', name: 'document', baseClasses: ['Document'] }]
    },
    {
        name: 's3FileLoader',
        label: 'S3 File Loader',
        category: 'Document Loaders',
        description: 'Load files from AWS S3 bucket.',
        baseClasses: ['Document'],
        inputs: [
            { label: 'Bucket Name', name: 'bucket', type: 'string', optional: false },
            { label: 'Key Prefix', name: 'keyPrefix', type: 'string', optional: true },
            { label: 'AWS Credentials', name: 'credential', type: 'credential', credentialNames: ['awsS3'], optional: false }
        ],
        outputs: [{ label: 'Document', name: 'document', baseClasses: ['Document'] }]
    },
    {
        name: 'cheerioWebScraper',
        label: 'Cheerio Web Scraper',
        category: 'Document Loaders',
        description: 'Scrape web content with CSS selectors.',
        baseClasses: ['Document'],
        inputs: [
            { label: 'URL', name: 'url', type: 'string', optional: false },
            { label: 'CSS Selector', name: 'selector', type: 'string', optional: true },
            { label: 'Follow Links', name: 'followLinks', type: 'boolean', default: false, optional: true },
            { label: 'Max Depth', name: 'maxDepth', type: 'number', default: 1, optional: true }
        ],
        outputs: [{ label: 'Document', name: 'document', baseClasses: ['Document'] }]
    },
    {
        name: 'airtableLoader',
        label: 'Airtable',
        category: 'Document Loaders',
        description: 'Load records from an Airtable table.',
        baseClasses: ['Document'],
        inputs: [
            { label: 'Base ID', name: 'baseId', type: 'string', optional: false },
            { label: 'Table ID', name: 'tableId', type: 'string', optional: false },
            { label: 'API Key', name: 'credential', type: 'credential', credentialNames: ['airtableApi'], optional: false }
        ],
        outputs: [{ label: 'Document', name: 'document', baseClasses: ['Document'] }]
    },
    {
        name: 'ollamaEmbeddings',
        label: 'Ollama Embeddings',
        category: 'Embeddings',
        description: 'Generate embeddings using Ollama.',
        baseClasses: ['Embeddings'],
        inputs: [{ label: 'Model', name: 'model', type: 'string', default: 'nomic-embed-text', optional: true }],
        outputs: [{ label: 'Embeddings', name: 'embeddings', baseClasses: ['Embeddings'] }]
    },
    {
        name: 'openAIEmbeddings',
        label: 'OpenAI Embeddings',
        category: 'Embeddings',
        description: 'Generate embeddings using OpenAI.',
        baseClasses: ['Embeddings'],
        inputs: [
            { label: 'Model', name: 'model', type: 'string', default: 'text-embedding-3-small', optional: true },
            { label: 'API Key', name: 'apiKey', type: 'password', optional: false }
        ],
        outputs: [{ label: 'Embeddings', name: 'embeddings', baseClasses: ['Embeddings'] }]
    },
    {
        name: 'cohereEmbeddings',
        label: 'Cohere Embeddings',
        category: 'Embeddings',
        description: 'Generate embeddings using Cohere.',
        baseClasses: ['Embeddings'],
        inputs: [
            { label: 'Model', name: 'model', type: 'string', default: 'embed-english-v3.0', optional: true },
            { label: 'API Key', name: 'apiKey', type: 'password', optional: false }
        ],
        outputs: [{ label: 'Embeddings', name: 'embeddings', baseClasses: ['Embeddings'] }]
    },
    {
        name: 'huggingFaceInferenceEmbeddings',
        label: 'HuggingFace Inference Embeddings',
        category: 'Embeddings',
        description: 'Generate embeddings using HuggingFace Inference API.',
        baseClasses: ['Embeddings'],
        inputs: [
            { label: 'Model ID', name: 'modelId', type: 'string', default: 'sentence-transformers/all-MiniLM-L6-v2', optional: true },
            { label: 'API Key', name: 'apiKey', type: 'password', optional: false }
        ],
        outputs: [{ label: 'Embeddings', name: 'embeddings', baseClasses: ['Embeddings'] }]
    },
    {
        name: 'neo4jGraph',
        label: 'Neo4j Graph',
        category: 'Graph',
        description: 'Connect to a Neo4j graph database.',
        baseClasses: ['GraphStore'],
        inputs: [{ label: 'Connection URI', name: 'uri', type: 'string', default: '', optional: false }],
        outputs: [{ label: 'Graph', name: 'graph', baseClasses: ['GraphStore'] }]
    },
    {
        name: 'graphCypherQAChain',
        label: 'Graph Cypher QA Chain',
        category: 'Graph',
        description: 'Question answering over graph data.',
        baseClasses: ['Chain'],
        inputs: [
            { label: 'Graph', name: 'graph', type: 'GraphStore', optional: false },
            { label: 'Model', name: 'model', type: 'ChatModel', optional: false }
        ],
        outputs: [{ label: 'Chain', name: 'chain', baseClasses: ['Chain'] }]
    },
    {
        name: 'ollamaLLM',
        label: 'Ollama LLM',
        category: 'LLMs',
        description: 'Text completion model via Ollama.',
        baseClasses: ['LLM'],
        inputs: [{ label: 'Model', name: 'model', type: 'string', default: 'llama3.2', optional: false }],
        outputs: [{ label: 'LLM', name: 'llm', baseClasses: ['LLM'] }]
    },
    {
        name: 'openAILLM',
        label: 'OpenAI LLM',
        category: 'LLMs',
        description: 'Text completion model via OpenAI.',
        baseClasses: ['LLM'],
        inputs: [{ label: 'Model', name: 'model', type: 'string', default: 'gpt-4o-mini', optional: false }],
        outputs: [{ label: 'LLM', name: 'llm', baseClasses: ['LLM'] }]
    },
    {
        name: 'bufferMemory',
        label: 'Buffer Memory',
        category: 'Memory',
        description: 'Store short-term conversation memory.',
        baseClasses: ['BaseChatMemory'],
        inputs: [{ label: 'Memory Key', name: 'memoryKey', type: 'string', default: 'chat_history', optional: true }],
        outputs: [{ label: 'Memory', name: 'memory', baseClasses: ['BaseChatMemory'] }]
    },
    {
        name: 'openAIModeration',
        label: 'OpenAI Moderation',
        category: 'Moderation',
        description: 'Moderate user or model text.',
        baseClasses: ['Moderation'],
        inputs: [{ label: 'Input', name: 'text', type: 'string', default: '', optional: false }],
        outputs: [{ label: 'Moderation', name: 'moderation', baseClasses: ['Moderation'] }]
    },
    {
        name: 'jsonOutputParser',
        label: 'JSON Output Parser',
        category: 'Output Parsers',
        description: 'Parse model output into JSON.',
        baseClasses: ['OutputParser'],
        inputs: [{ label: 'Schema', name: 'schema', type: 'json', default: '{}', optional: true }],
        outputs: [{ label: 'Parser', name: 'parser', baseClasses: ['OutputParser'] }]
    },
    {
        name: 'stringOutputParser',
        label: 'String Output Parser',
        category: 'Output Parsers',
        description: 'Parse output as plain text.',
        baseClasses: ['OutputParser'],
        inputs: [],
        outputs: [{ label: 'Parser', name: 'parser', baseClasses: ['OutputParser'] }]
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
        name: 'chatPromptTemplate',
        label: 'Chat Prompt Template',
        category: 'Prompts',
        description: 'Compose chat-style prompt templates.',
        baseClasses: ['PromptTemplate'],
        inputs: [{ label: 'Template', name: 'template', type: 'string', default: '', optional: false }],
        outputs: [{ label: 'Prompt', name: 'prompt', baseClasses: ['PromptTemplate'] }]
    },
    {
        name: 'sqliteRecordManager',
        label: 'SQLite Record Manager',
        category: 'Record Manager',
        description: 'Track upserted document records in SQLite.',
        baseClasses: ['RecordManager'],
        inputs: [{ label: 'Namespace', name: 'namespace', type: 'string', default: 'default', optional: true }],
        outputs: [{ label: 'Record Manager', name: 'recordManager', baseClasses: ['RecordManager'] }]
    },
    {
        name: 'documentStoreVS',
        label: 'Document Store Retriever',
        category: 'Retrievers',
        description: 'Retrieve from document store.',
        baseClasses: ['Retriever'],
        inputs: [{ label: 'Store', name: 'selectedStore', type: 'string', default: '', optional: false }],
        outputs: [{ label: 'Retriever', name: 'retriever', baseClasses: ['Retriever'] }]
    },
    {
        name: 'vectorStoreRetriever',
        label: 'Vector Store Retriever',
        category: 'Retrievers',
        description: 'Retrieve chunks from a vector store.',
        baseClasses: ['Retriever'],
        inputs: [{ label: 'Vector Store', name: 'vectorStore', type: 'VectorStore', optional: false }],
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
        name: 'tokenTextSplitter',
        label: 'Token Text Splitter',
        category: 'Text Splitters',
        description: 'Split text based on token count.',
        baseClasses: ['TextSplitter'],
        inputs: [{ label: 'Chunk Size', name: 'chunkSize', type: 'number', default: 500, optional: true }],
        outputs: [{ label: 'Splitter', name: 'textSplitter', baseClasses: ['TextSplitter'] }]
    },
    {
        name: 'retrieverTool',
        label: 'Retriever Tool',
        category: 'Tools',
        description: 'Retriever as tool.',
        baseClasses: ['Tool'],
        inputs: [
            { label: 'Retriever', name: 'retriever', type: 'Retriever', optional: false },
            { label: 'Name', name: 'name', type: 'string', default: 'retriever', optional: true }
        ],
        outputs: [{ label: 'Tool', name: 'tool', baseClasses: ['Tool'] }]
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
    },
    {
        name: 'calculatorTool',
        label: 'Calculator Tool',
        category: 'Tools',
        description: 'Perform arithmetic calculations.',
        baseClasses: ['Tool'],
        inputs: [],
        outputs: [{ label: 'Tool', name: 'tool', baseClasses: ['Tool'] }]
    },
    {
        name: 'qdrant',
        label: 'Qdrant',
        category: 'Vector Stores',
        description: 'Qdrant vector database provider.',
        baseClasses: ['VectorStore'],
        inputs: [
            { label: 'URL', name: 'url', type: 'string', default: '', optional: false },
            { label: 'Collection', name: 'collectionName', type: 'string', default: 'default', optional: false },
            { label: 'Embeddings', name: 'embeddings', type: 'Embeddings', optional: false }
        ],
        outputs: [{ label: 'Vector Store', name: 'vectorStore', baseClasses: ['VectorStore'] }]
    },
    {
        name: 'chroma',
        label: 'Chroma',
        category: 'Vector Stores',
        description: 'Chroma vector database provider.',
        baseClasses: ['VectorStore'],
        inputs: [
            { label: 'Host', name: 'host', type: 'string', default: 'localhost', optional: true },
            { label: 'Port', name: 'port', type: 'number', default: 8000, optional: true },
            { label: 'Collection Name', name: 'collectionName', type: 'string', default: 'documents', optional: true },
            { label: 'Embeddings', name: 'embeddings', type: 'Embeddings', optional: false }
        ],
        outputs: [{ label: 'Vector Store', name: 'vectorStore', baseClasses: ['VectorStore'] }]
    },
    {
        name: 'pinecone',
        label: 'Pinecone',
        category: 'Vector Stores',
        description: 'Pinecone vector database provider.',
        baseClasses: ['VectorStore'],
        inputs: [
            { label: 'Index Name', name: 'indexName', type: 'string', default: '', optional: false },
            { label: 'Namespace', name: 'namespace', type: 'string', default: '', optional: true },
            { label: 'API Key', name: 'apiKey', type: 'password', optional: false },
            { label: 'Embeddings', name: 'embeddings', type: 'Embeddings', optional: false }
        ],
        outputs: [{ label: 'Vector Store', name: 'vectorStore', baseClasses: ['VectorStore'] }]
    },
    {
        name: 'weaviate',
        label: 'Weaviate',
        category: 'Vector Stores',
        description: 'Weaviate vector database provider.',
        baseClasses: ['VectorStore'],
        inputs: [
            { label: 'Host', name: 'host', type: 'string', default: 'localhost', optional: true },
            { label: 'Port', name: 'port', type: 'number', default: 8080, optional: true },
            { label: 'Class Name', name: 'className', type: 'string', default: 'Document', optional: true },
            { label: 'API Key', name: 'apiKey', type: 'password', optional: true },
            { label: 'Embeddings', name: 'embeddings', type: 'Embeddings', optional: false }
        ],
        outputs: [{ label: 'Vector Store', name: 'vectorStore', baseClasses: ['VectorStore'] }]
    },
    {
        name: 'getVariable',
        label: 'Get Variable',
        category: 'Utilities',
        tags: ['Utilities'],
        description: 'Read a runtime variable.',
        baseClasses: ['Utilities'],
        inputs: [{ label: 'Variable Name', name: 'variableName', type: 'string', default: '', optional: false }],
        outputs: [{ label: 'Value', name: 'value', baseClasses: ['Utilities'] }]
    },
    {
        name: 'setVariable',
        label: 'Set Variable',
        category: 'Utilities',
        tags: ['Utilities'],
        description: 'Set a runtime variable.',
        baseClasses: ['Utilities'],
        inputs: [
            { label: 'Variable Name', name: 'variableName', type: 'string', default: '', optional: false },
            { label: 'Value', name: 'value', type: 'string', default: '', optional: true }
        ],
        outputs: [{ label: 'Value', name: 'value', baseClasses: ['Utilities'] }]
    },
    {
        name: 'stickyNote',
        label: 'Sticky Note',
        category: 'Utilities',
        tags: ['Utilities'],
        description: 'Add notes to your canvas.',
        baseClasses: ['Utilities'],
        type: 'StickyNote',
        hideOutput: true,
        inputs: [{ label: 'Text', name: 'text', type: 'string', default: '', optional: true }],
        outputs: []
    },
    {
        name: 'llamaIndexChat',
        label: 'LlamaIndex Chat',
        category: 'Chat Models',
        tags: ['LlamaIndex'],
        description: 'Chat model wrapper for LlamaIndex.',
        baseClasses: ['ChatModel'],
        inputs: [{ label: 'Model', name: 'model', type: 'string', default: 'llama3.2', optional: false }],
        outputs: [{ label: 'Chat Model', name: 'chatModel', baseClasses: ['ChatModel'] }]
    },
    {
        name: 'llamaIndexRetriever',
        label: 'LlamaIndex Retriever',
        category: 'Retrievers',
        tags: ['LlamaIndex'],
        description: 'Retriever integration for LlamaIndex.',
        baseClasses: ['Retriever'],
        inputs: [{ label: 'Top K', name: 'topK', type: 'number', default: 4, optional: true }],
        outputs: [{ label: 'Retriever', name: 'retriever', baseClasses: ['Retriever'] }]
    }
]

const CATEGORY_MAP = {
    chatmodels: 'Chat Models',
    loaders: 'Document Loaders',
    embeddings: 'Embeddings',
    recordmanager: 'Record Manager',
    vectorstore: 'Vector Stores',
    tools: 'Tools'
}

const BASE_CLASS_MAP = {
    chatmodels: ['ChatModel'],
    loaders: ['Document'],
    embeddings: ['Embeddings'],
    recordmanager: ['RecordManager'],
    vectorstore: ['VectorStore'],
    tools: ['Tool']
}

const OUTPUT_MAP = {
    chatmodels: [{ label: 'Chat Model', name: 'chatModel', baseClasses: ['ChatModel'] }],
    loaders: [{ label: 'Document', name: 'document', baseClasses: ['Document'] }],
    embeddings: [{ label: 'Embeddings', name: 'embeddings', baseClasses: ['Embeddings'] }],
    recordmanager: [{ label: 'Record Manager', name: 'recordManager', baseClasses: ['RecordManager'] }],
    vectorstore: [{ label: 'Vector Store', name: 'vectorStore', baseClasses: ['VectorStore'] }],
    tools: [{ label: 'Tool', name: 'tool', baseClasses: ['Tool'] }]
}

const clone = (value) => JSON.parse(JSON.stringify(value))

const mergeByName = (base, incoming) => {
    const mergedMap = new Map(base.map((node) => [node.name, node]))

    incoming.forEach((node) => {
        if (!node?.name) return

        const existing = mergedMap.get(node.name) || {}
        const merged = { ...existing }

        Object.keys(node).forEach((key) => {
            const nextValue = node[key]
            const previousValue = existing[key]

            if (Array.isArray(nextValue)) {
                merged[key] = nextValue.length ? nextValue : previousValue || nextValue
                return
            }

            if (typeof nextValue === 'string') {
                merged[key] = nextValue.trim() ? nextValue : previousValue || nextValue
                return
            }

            if (nextValue === undefined || nextValue === null) {
                merged[key] = previousValue ?? nextValue
                return
            }

            merged[key] = nextValue
        })

        mergedMap.set(node.name, merged)
    })

    return Array.from(mergedMap.values())
}

const normalizeRemoteNode = (node, source) => {
    const name = node?.name
    if (!name) return null

    return {
        name,
        label: node?.label || name,
        category: node?.category || CATEGORY_MAP[source] || 'Utilities',
        description: node?.description,
        tags: node?.tags,
        baseClasses: Array.isArray(node?.baseClasses) && node.baseClasses.length ? node.baseClasses : BASE_CLASS_MAP[source] || ['Utilities'],
        inputs: Array.isArray(node?.inputs) ? node.inputs : [],
        outputs: Array.isArray(node?.outputs) && node.outputs.length ? node.outputs : OUTPUT_MAP[source] || []
    }
}

let registryCache = null
let registryLoadedAt = 0
const REGISTRY_CACHE_TTL_MS = 30_000

const fetchRemoteNodes = async () => {
    const endpoints = {
        chatmodels: '/assistants/components/chatmodels',
        loaders: '/document-store/components/loaders',
        embeddings: '/document-store/components/embeddings',
        recordmanager: '/document-store/components/recordmanager',
        vectorstore: '/document-store/components/vectorstore',
        tools: '/assistants/components/tools'
    }

    const entries = Object.entries(endpoints)
    const responses = await Promise.allSettled(entries.map(([, endpoint]) => client.get(endpoint)))

    const nodes = []
    responses.forEach((result, index) => {
        if (result.status !== 'fulfilled') return
        const source = entries[index][0]
        const payload = Array.isArray(result.value?.data) ? result.value.data : []

        payload.forEach((node) => {
            const normalized = normalizeRemoteNode(node, source)
            if (normalized) {
                nodes.push(normalized)
            }
        })
    })

    return nodes
}

const getRegistry = async () => {
    const now = Date.now()
    if (registryCache && now - registryLoadedAt < REGISTRY_CACHE_TTL_MS) {
        return clone(registryCache)
    }

    const baseNodes = clone(CORE_NODE_REGISTRY)
    try {
        const remoteNodes = await fetchRemoteNodes()
        registryCache = mergeByName(baseNodes, remoteNodes)
    } catch (error) {
        registryCache = baseNodes
    }

    registryLoadedAt = Date.now()
    return clone(registryCache)
}

const getAllNodes = async () => {
    const data = await getRegistry()
    return { data }
}

const getSpecificNode = async (name) => {
    const nodes = await getRegistry()
    return { data: nodes.find((node) => node.name === name) || null }
}

const getNodesByCategory = async (name) => {
    const nodes = await getRegistry()
    return { data: nodes.filter((node) => node.category === name) }
}

const executeCustomFunctionNode = async (body) => ({ data: { result: body } })

const executeNodeLoadMethod = async (name, body) => {
    const selectedModel = body?.inputs?.model || 'llama3.2'

    if (name === 'openAIChat' || name === 'openAILLM') {
        return {
            data: [
                { label: 'gpt-4o-mini', name: 'gpt-4o-mini' },
                { label: 'gpt-4.1-mini', name: 'gpt-4.1-mini' }
            ]
        }
    }

    if (name === 'anthropicChat') {
        return {
            data: [
                { label: 'claude-3-5-sonnet-latest', name: 'claude-3-5-sonnet-latest' },
                { label: 'claude-3-5-haiku-latest', name: 'claude-3-5-haiku-latest' }
            ]
        }
    }

    return {
        data: [
            { label: selectedModel, name: selectedModel },
            { label: 'llama3.1', name: 'llama3.1' },
            { label: 'llama3.2', name: 'llama3.2' }
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
