import client from './client'

const withCredential = (credential) => (credential ? { credential } : undefined)
const resolveProviderPath = (providerType = 'OPENAI') => (providerType === 'AZURE' ? 'azure-assistants' : 'openai-assistants')
const resolveVectorStorePath = (providerType = 'OPENAI') =>
    providerType === 'AZURE' ? 'azure-assistants-vector-store' : 'openai-assistants-vector-store'
const resolveFileUploadPath = (providerType = 'OPENAI') =>
    providerType === 'AZURE' ? 'azure-assistants-file/upload' : 'openai-assistants-file/upload'

const getAssistantObj = async (id, credential, providerType = 'OPENAI') => {
    const response = await client.get(`/${resolveProviderPath(providerType)}/${id}`, {
        params: withCredential(credential)
    })
    return { data: response.data }
}

const getAllAvailableAssistants = async (credential, providerType = 'OPENAI') => {
    const response = await client.get(`/${resolveProviderPath(providerType)}`, {
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

const getAssistantVectorStore = async (id, credential, providerType = 'OPENAI') => {
    const response = await client.get(`/${resolveVectorStorePath(providerType)}/${id}`, {
        params: withCredential(credential)
    })
    return { data: response.data }
}

const listAssistantVectorStore = async (credential, providerType = 'OPENAI') => {
    const response = await client.get(`/${resolveVectorStorePath(providerType)}`, {
        params: withCredential(credential)
    })
    return { data: response.data }
}

const createAssistantVectorStore = async (credentialId, body, providerType = 'OPENAI') => {
    const response = await client.post(`/${resolveVectorStorePath(providerType)}`, body, {
        params: withCredential(credentialId)
    })
    return { data: response.data }
}

const updateAssistantVectorStore = async (id, credentialId, body, providerType = 'OPENAI') => {
    const response = await client.put(`/${resolveVectorStorePath(providerType)}/${id}`, body, {
        params: withCredential(credentialId)
    })
    return { data: response.data }
}

const deleteAssistantVectorStore = async (id, credentialId, providerType = 'OPENAI') => {
    const response = await client.delete(`/${resolveVectorStorePath(providerType)}/${id}`, {
        params: withCredential(credentialId)
    })
    return { data: response.data }
}

const uploadFilesToAssistantVectorStore = async (id, credentialId, formData, providerType = 'OPENAI') => {
    const response = await client.post(`/${resolveVectorStorePath(providerType)}/${id}`, formData, {
        params: withCredential(credentialId),
        headers: {
            'Content-Type': 'multipart/form-data'
        }
    })
    return { data: response.data }
}

const deleteFilesFromAssistantVectorStore = async (id, credentialId, body, providerType = 'OPENAI') => {
    const response = await client.patch(`/${resolveVectorStorePath(providerType)}/${id}`, body, {
        params: withCredential(credentialId)
    })
    return { data: response.data }
}

const uploadFilesToAssistant = async (credentialId, formData, providerType = 'OPENAI') => {
    const response = await client.post(`/${resolveFileUploadPath(providerType)}`, formData, {
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

const getAzureAssistantObj = async (id, credential) => getAssistantObj(id, credential, 'AZURE')
const getAllAvailableAzureAssistants = async (credential) => getAllAvailableAssistants(credential, 'AZURE')
const getAzureAssistantVectorStore = async (id, credential) => getAssistantVectorStore(id, credential, 'AZURE')
const listAzureAssistantVectorStore = async (credential) => listAssistantVectorStore(credential, 'AZURE')
const createAzureAssistantVectorStore = async (credentialId, body) => createAssistantVectorStore(credentialId, body, 'AZURE')
const updateAzureAssistantVectorStore = async (id, credentialId, body) => updateAssistantVectorStore(id, credentialId, body, 'AZURE')
const deleteAzureAssistantVectorStore = async (id, credentialId) => deleteAssistantVectorStore(id, credentialId, 'AZURE')
const uploadFilesToAzureAssistantVectorStore = async (id, credentialId, formData) =>
    uploadFilesToAssistantVectorStore(id, credentialId, formData, 'AZURE')
const deleteFilesFromAzureAssistantVectorStore = async (id, credentialId, body) =>
    deleteFilesFromAssistantVectorStore(id, credentialId, body, 'AZURE')
const uploadFilesToAzureAssistant = async (credentialId, formData) => uploadFilesToAssistant(credentialId, formData, 'AZURE')

export default {
    getAllAssistants,
    getSpecificAssistant,
    getAssistantObj,
    getAzureAssistantObj,
    getAllAvailableAssistants,
    getAllAvailableAzureAssistants,
    createNewAssistant,
    updateAssistant,
    deleteAssistant,
    getAssistantVectorStore,
    getAzureAssistantVectorStore,
    listAssistantVectorStore,
    listAzureAssistantVectorStore,
    updateAssistantVectorStore,
    updateAzureAssistantVectorStore,
    createAssistantVectorStore,
    createAzureAssistantVectorStore,
    uploadFilesToAssistant,
    uploadFilesToAzureAssistant,
    uploadFilesToAssistantVectorStore,
    uploadFilesToAzureAssistantVectorStore,
    deleteFilesFromAssistantVectorStore,
    deleteFilesFromAzureAssistantVectorStore,
    deleteAssistantVectorStore,
    deleteAzureAssistantVectorStore,
    getChatModels,
    getDocStores,
    getTools,
    generateAssistantInstruction
}
