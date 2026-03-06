import client from './client'
import { unavailableResponse } from './responseAdapter'

const isNotFound = (error) => error?.response?.status === 404

const getAllDatasets = async (params) => {
    try {
        const hasPaging = params && Object.keys(params).length > 0
        const response = await client.get('/datasets', {
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

const getDataset = async (id, params = {}) => {
    try {
        const response = await client.get(`/datasets/set/${id}`, {
            params: {
                page: params?.page || 1,
                limit: params?.limit || 10
            }
        })
        return { data: response.data }
    } catch (error) {
        if (isNotFound(error)) {
            return unavailableResponse({ id, name: '', description: '', rows: [], total: 0 }, 404)
        }
        throw error
    }
}

const createDataset = async (body) => {
    const response = await client.post('/datasets/set', body)
    return { data: response.data }
}

const updateDataset = async (id, body) => {
    const response = await client.put(`/datasets/set/${id}`, body)
    return { data: response.data }
}

const deleteDataset = async (id) => {
    const response = await client.delete(`/datasets/set/${id}`)
    return { data: response.data }
}

const createDatasetRow = async (body) => {
    const response = await client.post('/datasets/rows', body)
    return { data: response.data }
}

const updateDatasetRow = async (id, body) => {
    const response = await client.put(`/datasets/rows/${id}`, body)
    return { data: response.data }
}

const deleteDatasetRow = async (id) => {
    const response = await client.delete(`/datasets/rows/${id}`)
    return { data: response.data }
}

const deleteDatasetItems = async (ids = []) => {
    const response = await client.patch('/datasets/rows', { ids })
    return { data: response.data }
}

const reorderDatasetRow = async (body) => {
    const response = await client.post('/datasets/reorder', body)
    return { data: response.data }
}

export default {
    getAllDatasets,
    getDataset,
    createDataset,
    updateDataset,
    deleteDataset,
    createDatasetRow,
    updateDatasetRow,
    deleteDatasetRow,
    deleteDatasetItems,
    reorderDatasetRow
}
