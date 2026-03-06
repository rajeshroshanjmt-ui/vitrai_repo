import client from './client'
import { successResponse, unavailableListResponse } from './responseAdapter'

const isNotFound = (error) => error?.response?.status === 404

const checkValidation = async (id) => {
    try {
        const response = await client.get(`/validation/${id}`)
        return successResponse(Array.isArray(response?.data) ? response.data : [], response?.status || 200)
    } catch (error) {
        if (isNotFound(error)) {
            return unavailableListResponse(404)
        }
        throw error
    }
}

export default {
    checkValidation
}
