import client from './client'

const withCredential = (credential) => (credential ? { credential } : undefined)

const getAssistantObj = async (id, credential) => {
    const response = await client.get(`/openai-assistants/${id}`, {
        params: withCredential(credential)
    })
    return { data: response.data }
}

const getAllAvailableAssistants = async (credential) => {
    const response = await client.get('/openai-assistants', {
        params: withCredential(credential)
    })
    return { data: response.data }
}

const createNewAssistant = async (body) => {
    const response = await client.post('/assistants', body)
    return { data: response.data }
}

const getAllAssistants = async (type) => {
    const response = await client.get('/assistants', {
        params: type ? { type } : undefined
    })
    return { data: response.data }
}

const getSpecificAssistant = async (id) => {
    const response = await client.get(`/assistants/${id}`)
    return { data: response.data }
}

const updateAssistant = async (id, body) => {
    const response = await client.put(`/assistants/${id}`, body)
    return { data: response.data }
}

const deleteAssistant = async (id) => {
    const response = await client.delete(`/assistants/${id}`)
    return { data: response.data }
}

const getAssistantVectorStore = async (id, credential) => {
    const response = await client.get(`/openai-assistants-vector-store/${id}`, {
        params: withCredential(credential)
    })
    return { data: response.data }
}

const listAssistantVectorStore = async (credential) => {
    const response = await client.get('/openai-assistants-vector-store', {
        params: withCredential(credential)
    })
    return { data: response.data }
}

const createAssistantVectorStore = async (credentialId, body) => {
    const response = await client.post('/openai-assistants-vector-store', body, {
        params: withCredential(credentialId)
    })
    return { data: response.data }
}

const updateAssistantVectorStore = async (id, credentialId, body) => {
    const response = await client.put(`/openai-assistants-vector-store/${id}`, body, {
        params: withCredential(credentialId)
    })
    return { data: response.data }
}

const deleteAssistantVectorStore = async (id, credentialId) => {
    const response = await client.delete(`/openai-assistants-vector-store/${id}`, {
        params: withCredential(credentialId)
    })
    return { data: response.data }
}

const uploadFilesToAssistantVectorStore = async (id, credentialId, formData) => {
    const response = await client.post(`/openai-assistants-vector-store/${id}`, formData, {
        params: withCredential(credentialId),
        headers: {
            'Content-Type': 'multipart/form-data'
        }
    })
    return { data: response.data }
}

const deleteFilesFromAssistantVectorStore = async (id, credentialId, body) => {
    const response = await client.patch(`/openai-assistants-vector-store/${id}`, body, {
        params: withCredential(credentialId)
    })
    return { data: response.data }
}

const uploadFilesToAssistant = async (credentialId, formData) => {
    const response = await client.post('/openai-assistants-file/upload', formData, {
        params: withCredential(credentialId),
        headers: {
            'Content-Type': 'multipart/form-data'
        }
    })
    return { data: response.data }
}

const getChatModels = async () => {
    const response = await client.get('/assistants/components/chatmodels')
    return { data: response.data }
}

const getDocStores = async () => {
    const response = await client.get('/assistants/components/docstores')
    return { data: response.data }
}

const getTools = async () => {
    const response = await client.get('/assistants/components/tools')
    return { data: response.data }
}

const generateAssistantInstruction = async (body) => {
    const response = await client.post('/assistants/generate/instruction', body)
    return { data: response.data }
}

export default {
    getAllAssistants,
    getSpecificAssistant,
    getAssistantObj,
    getAllAvailableAssistants,
    createNewAssistant,
    updateAssistant,
    deleteAssistant,
    getAssistantVectorStore,
    listAssistantVectorStore,
    updateAssistantVectorStore,
    createAssistantVectorStore,
    uploadFilesToAssistant,
    uploadFilesToAssistantVectorStore,
    deleteFilesFromAssistantVectorStore,
    deleteAssistantVectorStore,
    getChatModels,
    getDocStores,
    getTools,
    generateAssistantInstruction
}
