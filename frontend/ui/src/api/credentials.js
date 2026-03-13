import { createResource, deleteResource, listResource, toResourceBody, updateResource } from './vetraiResources'

const COMPONENT_CREDENTIALS = [
    {
        name: 'openAIApi',
        label: 'OpenAI API Key',
        inputs: [
            {
                label: 'OpenAI API Key',
                name: 'openAIApiKey',
                type: 'password',
                optional: false
            }
        ]
    },
    {
        name: 'azureOpenAIApi',
        label: 'Azure OpenAI API',
        inputs: [
            {
                label: 'Azure OpenAI API Key',
                name: 'azureOpenAIApiKey',
                type: 'password',
                optional: false
            },
            {
                label: 'Azure OpenAI Endpoint',
                name: 'azureOpenAIApiEndpoint',
                type: 'string',
                optional: false
            }
        ]
    },
    {
        name: 'anthropicApi',
        label: 'Anthropic API Key',
        inputs: [
            {
                label: 'Anthropic API Key',
                name: 'anthropicApiKey',
                type: 'password',
                optional: false
            }
        ]
    },
    {
        name: 'perplexityApi',
        label: 'Perplexity API Key',
        inputs: [
            {
                label: 'Perplexity API Key',
                name: 'perplexityApiKey',
                type: 'password',
                optional: false
            }
        ]
    },
    {
        name: 'googleGenerativeAI',
        label: 'Google Generative AI API Key',
        inputs: [
            {
                label: 'Google Generative AI API Key',
                name: 'googleGenerativeAIApiKey',
                type: 'password',
                optional: false
            }
        ]
    },
    {
        name: 'genericApiKey',
        label: 'Generic API Key',
        inputs: [
            {
                label: 'API Key',
                name: 'apiKey',
                type: 'password',
                optional: false
            }
        ]
    }
]

const mapCredential = (row) => ({
    id: row.resource_id,
    name: row.name,
    credentialName: row.payload?.credentialName || 'genericApiKey',
    plainDataObj: row.payload?.plainDataObj || {},
    createdDate: row.created_at,
    updatedDate: row.updated_at,
    shared: false
})

const fetchAllCredentials = async () => {
    const result = await listResource('credential', { limit: 500, offset: 0 })
    return (result?.data?.data || []).map(mapCredential)
}

const getAllCredentials = async () => {
    const rows = await fetchAllCredentials()
    return { data: rows }
}

const getCredentialsByName = async (componentCredentialName) => {
    const rows = await fetchAllCredentials()
    return { data: rows.filter((row) => row.credentialName === componentCredentialName) }
}

const getAllComponentsCredentials = async () => {
    return { data: COMPONENT_CREDENTIALS }
}

const getSpecificCredential = async (id) => {
    const rows = await fetchAllCredentials()
    const item = rows.find((row) => row.id === id)
    return { data: item || null }
}

const getSpecificComponentCredential = async (name) => {
    const item = COMPONENT_CREDENTIALS.find((component) => component.name === name)
    return { data: item || COMPONENT_CREDENTIALS[0] }
}

const createCredential = async (body) => {
    const result = await createResource(
        'credential',
        toResourceBody(body?.name || 'Credential', {
            credentialName: body?.credentialName || 'genericApiKey',
            plainDataObj: body?.plainDataObj || {}
        })
    )

    return {
        data: {
            id: result?.data?.resource_id,
            name: result?.data?.name
        }
    }
}

const updateCredential = async (id, body) => {
    const current = await getSpecificCredential(id)
    const currentPayload = current?.data?.plainDataObj || {}
    const mergedPayload = {
        ...currentPayload,
        ...(body?.plainDataObj || {})
    }

    const result = await updateResource('credential', id, {
        name: body?.name,
        payload: {
            credentialName: body?.credentialName || current?.data?.credentialName || 'genericApiKey',
            plainDataObj: mergedPayload
        }
    })

    return {
        data: {
            id: result?.data?.resource_id,
            name: result?.data?.name
        }
    }
}

const deleteCredential = (id) => deleteResource('credential', id)

export default {
    getAllCredentials,
    getCredentialsByName,
    getAllComponentsCredentials,
    getSpecificCredential,
    getSpecificComponentCredential,
    createCredential,
    updateCredential,
    deleteCredential
}
