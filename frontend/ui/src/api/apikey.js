import { createResource, deleteResource, listResource, toResourceBody, updateResource } from './vetraiResources'

const STORAGE_KEY = 'vetrai_generated_api_keys'

const loadGeneratedKeys = () => {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    } catch {
        return {}
    }
}

const saveGeneratedKeys = (data) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

const randomApiKey = () => {
    const rand = Math.random().toString(36).slice(2)
    return `vtr_${Date.now().toString(36)}_${rand}${Math.random().toString(36).slice(2)}`
}

const mapApiKey = (row) => {
    const generated = loadGeneratedKeys()
    const key = row.payload?.apiKey || generated[row.resource_id] || randomApiKey()
    if (!generated[row.resource_id]) {
        generated[row.resource_id] = key
        saveGeneratedKeys(generated)
    }

    return {
        id: row.resource_id,
        keyName: row.payload?.keyName || row.name,
        apiKey: key,
        permissions: Array.isArray(row.payload?.permissions) ? row.payload.permissions : [],
        chatFlows: Array.isArray(row.payload?.chatFlows) ? row.payload.chatFlows : [],
        createdAt: row.created_at,
        updatedAt: row.updated_at
    }
}

const normalizePage = (params = {}) => {
    const page = Math.max(1, Number(params?.page || 1))
    const limit = Math.max(1, Number(params?.limit || 10))
    return { page, limit }
}

const getAllAPIKeys = async (params = {}) => {
    const { page, limit } = normalizePage(params)
    const offset = (page - 1) * limit
    const result = await listResource('api_key', { limit, offset })
    const rows = (result?.data?.data || []).map(mapApiKey)

    return {
        data: {
            data: rows,
            total: result?.data?.total || rows.length
        }
    }
}

const createNewAPI = async (body) => {
    const created = await createResource(
        'api_key',
        toResourceBody(body?.keyName || 'API Key', {
            keyName: body?.keyName || 'API Key',
            permissions: Array.isArray(body?.permissions) ? body.permissions : []
        })
    )

    const generated = loadGeneratedKeys()
    const apiKey = randomApiKey()
    generated[created?.data?.resource_id] = apiKey
    saveGeneratedKeys(generated)

    await updateResource('api_key', created?.data?.resource_id, {
        payload: {
            keyName: body?.keyName || 'API Key',
            permissions: Array.isArray(body?.permissions) ? body.permissions : [],
            apiKey,
            chatFlows: []
        }
    })

    return {
        data: {
            id: created?.data?.resource_id,
            apiKey
        }
    }
}

const updateAPI = async (id, body) => {
    const generated = loadGeneratedKeys()
    const existingKey = generated[id] || randomApiKey()
    generated[id] = existingKey
    saveGeneratedKeys(generated)

    const result = await updateResource('api_key', id, {
        name: body?.keyName,
        payload: {
            keyName: body?.keyName,
            permissions: Array.isArray(body?.permissions) ? body.permissions : [],
            apiKey: existingKey,
            chatFlows: body?.chatFlows || []
        }
    })

    return {
        data: {
            id: result?.data?.resource_id,
            keyName: result?.data?.name
        }
    }
}

const deleteAPI = async (id) => {
    const generated = loadGeneratedKeys()
    delete generated[id]
    saveGeneratedKeys(generated)
    return deleteResource('api_key', id)
}

export default {
    getAllAPIKeys,
    createNewAPI,
    updateAPI,
    deleteAPI
}
