import client from './client'

const getAllEvaluations = async (params = {}) => {
    const response = await client.get('/evaluations', {
        params: {
            page: params?.page || 1,
            limit: params?.limit || 10
        }
    })
    return { data: response.data }
}

const getIsOutdated = async (id) => {
    const response = await client.get(`/evaluations/is-outdated/${id}`)
    return { data: response.data }
}

const getEvaluation = async (id) => {
    const response = await client.get(`/evaluations/${id}`)
    return { data: response.data }
}

const createEvaluation = async (body) => {
    const response = await client.post('/evaluations', body)
    return { data: response.data }
}

const deleteEvaluation = async (id) => {
    const response = await client.delete(`/evaluations/${id}`)
    return { data: response.data }
}

const runAgain = async (id) => {
    const response = await client.post(`/evaluations/run-again/${id}`)
    return { data: response.data }
}

const getVersions = async (id) => {
    const response = await client.get(`/evaluations/versions/${id}`)
    return { data: response.data }
}

const deleteEvaluations = async (ids = [], isDeleteAllVersion = false) => {
    const response = await client.patch('/evaluations', {
        ids,
        isDeleteAllVersion
    })
    return { data: response.data }
}

export default {
    createEvaluation,
    deleteEvaluation,
    getAllEvaluations,
    getEvaluation,
    getIsOutdated,
    runAgain,
    getVersions,
    deleteEvaluations
}
