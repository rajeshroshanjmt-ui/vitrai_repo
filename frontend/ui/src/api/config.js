import client from './client'
import { successResponse, unavailableListResponse } from './responseAdapter'

const isNotFound = (error) => error?.response?.status === 404

const getConfig = async (id) => {
    try {
        const response = await client.get(`/flow-config/${id}`)
        return successResponse(Array.isArray(response?.data) ? response.data : [], response?.status || 200)
    } catch (error) {
        if (isNotFound(error)) {
            return unavailableListResponse(404)
        }
        throw error
    }
}

const getNodeConfig = async (body) => {
    try {
        const response = await client.post(`/node-config`, body)
        return successResponse(Array.isArray(response?.data) ? response.data : [], response?.status || 200)
    } catch (error) {
        if (isNotFound(error)) {
            return unavailableListResponse(404)
        }
        throw error
    }
}

export default {
    getConfig,
    getNodeConfig
}
