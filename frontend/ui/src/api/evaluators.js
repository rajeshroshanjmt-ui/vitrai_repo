import client from './client'
import { unavailableResponse } from './responseAdapter'

const isNotFound = (error) => error?.response?.status === 404

const getAllEvaluators = async (params) => {
    try {
        const hasPaging = params && Object.keys(params).length > 0
        const response = await client.get('/evaluators', {
            params: hasPaging
                ? {
                      page: params?.page || 1,
                      limit: params?.limit || 10
                  }
                : undefined
        })
        return { data: response.data }
    } catch (error) {
        if (isNotFound(error)) {
            return unavailableResponse({ data: [], total: 0 }, 404)
        }
        throw error
    }
}

const createEvaluator = async (body) => {
    const response = await client.post('/evaluators', body)
    return { data: response.data }
}

const getEvaluator = async (id) => {
    const response = await client.get(`/evaluators/${id}`)
    return { data: response.data }
}

const updateEvaluator = async (id, body) => {
    const response = await client.put(`/evaluators/${id}`, body)
    return { data: response.data }
}

const deleteEvaluator = async (id) => {
    const response = await client.delete(`/evaluators/${id}`)
    return { data: response.data }
}

export default {
    getAllEvaluators,
    createEvaluator,
    getEvaluator,
    updateEvaluator,
    deleteEvaluator
}
