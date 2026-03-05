import client from './client'

const getAllDocumentStores = async (params = {}) => {
    const response = await client.get('/document-store/store', {
        params: {
            page: params?.page || 1,
            limit: params?.limit || 10
        }
    })
    return { data: response.data }
}

const getDocumentLoaders = async () => {
    const response = await client.get('/document-store/components/loaders')
    return { data: response.data }
}

const getSpecificDocumentStore = async (id) => {
    const response = await client.get(`/document-store/store/${id}`)
    return { data: response.data }
}

const createDocumentStore = async (body) => {
    const response = await client.post('/document-store/store', body)
    return { data: response.data }
}

const updateDocumentStore = async (id, body) => {
    const response = await client.put(`/document-store/store/${id}`, body)
    return { data: response.data }
}

const deleteDocumentStore = async (id) => {
    const response = await client.delete(`/document-store/store/${id}`)
    return { data: response.data }
}

const getDocumentStoreConfig = async (storeId, loaderId) => {
    const response = await client.get(`/document-store/store-configs/${storeId}/${loaderId}`)
    return { data: response.data }
}

const deleteLoaderFromStore = async (id, fileId) => {
    const response = await client.delete(`/document-store/loader/${id}/${fileId}`)
    return { data: response.data }
}

const deleteChunkFromStore = async (storeId, loaderId, chunkId) => {
    const response = await client.delete(`/document-store/chunks/${storeId}/${loaderId}/${chunkId}`)
    return { data: response.data }
}

const editChunkFromStore = async (storeId, loaderId, chunkId, body) => {
    const response = await client.put(`/document-store/chunks/${storeId}/${loaderId}/${chunkId}`, body)
    return { data: response.data }
}

const getFileChunks = async (storeId, fileId, pageNo = 1) => {
    const response = await client.get(`/document-store/chunks/${storeId}/${fileId}/${pageNo}`)
    return { data: response.data }
}

const previewChunks = async (body) => {
    const response = await client.post('/document-store/loader/preview', body)
    return { data: response.data }
}

const processLoader = async (body, loaderId) => {
    const response = await client.post(`/document-store/loader/process/${loaderId}`, body)
    return { data: response.data }
}

const saveProcessingLoader = async (body) => {
    const response = await client.post('/document-store/loader/save', body)
    return { data: response.data }
}

const refreshLoader = async (storeId) => {
    const response = await client.post(`/document-store/refresh/${storeId}`)
    return { data: response.data }
}

const insertIntoVectorStore = async (body) => {
    const response = await client.post('/document-store/vectorstore/insert', body)
    return { data: response.data }
}

const saveVectorStoreConfig = async (body) => {
    const response = await client.post('/document-store/vectorstore/save', body)
    return { data: response.data }
}

const updateVectorStoreConfig = async (body) => {
    const response = await client.post('/document-store/vectorstore/update', body)
    return { data: response.data }
}

const deleteVectorStoreDataFromStore = async (storeId, docId) => {
    const response = await client.delete(`/document-store/vectorstore/${storeId}`, {
        params: docId ? { docId } : undefined
    })
    return { data: response.data }
}

const queryVectorStore = async (body) => {
    const response = await client.post('/document-store/vectorstore/query', body)
    return { data: response.data }
}

const getVectorStoreProviders = async () => {
    const response = await client.get('/document-store/components/vectorstore')
    return { data: response.data }
}

const getEmbeddingProviders = async () => {
    const response = await client.get('/document-store/components/embeddings')
    return { data: response.data }
}

const getRecordManagerProviders = async () => {
    const response = await client.get('/document-store/components/recordmanager')
    return { data: response.data }
}

const generateDocStoreToolDesc = async (storeId, body = {}) => {
    const response = await client.post(`/document-store/generate-tool-desc/${storeId}`, body)
    return { data: response.data }
}

export default {
    getAllDocumentStores,
    getSpecificDocumentStore,
    createDocumentStore,
    deleteLoaderFromStore,
    getFileChunks,
    updateDocumentStore,
    previewChunks,
    processLoader,
    getDocumentLoaders,
    deleteChunkFromStore,
    editChunkFromStore,
    deleteDocumentStore,
    insertIntoVectorStore,
    getVectorStoreProviders,
    getEmbeddingProviders,
    getRecordManagerProviders,
    saveVectorStoreConfig,
    queryVectorStore,
    deleteVectorStoreDataFromStore,
    updateVectorStoreConfig,
    saveProcessingLoader,
    refreshLoader,
    generateDocStoreToolDesc,
    getDocumentStoreConfig
}
