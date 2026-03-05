import { createResource, deleteResource, listResource, toResourceBody, updateResource } from './vetraiResources'

const mapVariable = (row) => ({
    id: row.resource_id,
    name: row.name,
    value: row.payload?.value ?? '',
    type: row.payload?.type || 'static',
    createdDate: row.created_at,
    updatedDate: row.updated_at
})

const normalizePage = (params = {}) => {
    const page = Math.max(1, Number(params?.page || 1))
    const limit = Math.max(1, Number(params?.limit || 10))
    return { page, limit }
}

const getAllVariables = async (params = {}) => {
    const { page, limit } = normalizePage(params)
    const offset = (page - 1) * limit
    const result = await listResource('variable', { limit, offset, q: params?.q })
    const rows = (result?.data?.data || []).map(mapVariable)
    return {
        data: {
            data: rows,
            total: result?.data?.total || rows.length
        }
    }
}

const createVariable = async (body) => {
    const result = await createResource(
        'variable',
        toResourceBody(body?.name || 'New Variable', {
            value: body?.value ?? '',
            type: body?.type || 'static'
        })
    )
    return {
        data: {
            id: result?.data?.resource_id,
            name: result?.data?.name
        }
    }
}

const updateVariable = async (id, body) => {
    const result = await updateResource('variable', id, {
        name: body?.name,
        payload: {
            value: body?.value ?? '',
            type: body?.type || 'static'
        }
    })
    return {
        data: {
            id: result?.data?.resource_id,
            name: result?.data?.name
        }
    }
}

const deleteVariable = (id) => deleteResource('variable', id)

export default {
    getAllVariables,
    createVariable,
    updateVariable,
    deleteVariable
}
