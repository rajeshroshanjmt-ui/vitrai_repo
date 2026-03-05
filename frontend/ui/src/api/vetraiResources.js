import client from './client'

export const listResource = async (resourceType, params = {}) => {
    const response = await client.get(`/resources/${resourceType}`, {
        params: {
            limit: params?.limit || 100,
            offset: params?.offset || 0,
            q: params?.q
        }
    })
    const items = response?.data?.items || []
    return {
        data: {
            data: items,
            total: response?.data?.total_count || items.length
        }
    }
}

export const createResource = async (resourceType, body) => {
    const response = await client.post(`/resources/${resourceType}`, body)
    return { data: response.data }
}

export const updateResource = async (resourceType, id, body) => {
    const response = await client.put(`/resources/${resourceType}/${id}`, body)
    return { data: response.data }
}

export const deleteResource = async (resourceType, id) => {
    const response = await client.delete(`/resources/${resourceType}/${id}`)
    return { data: response.data }
}

export const toResourceBody = (name, payload = {}) => ({
    name,
    payload
})
