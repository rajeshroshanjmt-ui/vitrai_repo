import client from './client'

const getAllEvaluators = async (params) => {
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
