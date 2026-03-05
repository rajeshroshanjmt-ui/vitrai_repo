import { createResource, deleteResource, listResource, toResourceBody, updateResource } from './vetraiResources'

const mapTool = (row) => ({
    id: row.resource_id,
    name: row.name,
    description: row.payload?.description || '',
    iconSrc: row.payload?.iconSrc || '',
    schema: row.payload?.schema || [],
    func: row.payload?.func || '',
    color: row.payload?.color || '#4f8df7',
    category: row.payload?.category || 'custom'
})

const getAllTools = async (params) => {
    const response = await listResource('tool', params)
    return {
        data: {
            data: (response.data.data || []).map(mapTool),
            total: response.data.total
        }
    }
}

const getSpecificTool = async (id) => {
    const list = await getAllTools({ limit: 200 })
    const found = (list.data.data || []).find((item) => item.id === id)
    return { data: found }
}

const createNewTool = async (body) => {
    const response = await createResource(
        'tool',
        toResourceBody(body?.name || 'Untitled Tool', {
            description: body?.description || '',
            schema: body?.schema || [],
            func: body?.func || '',
            color: body?.color,
            iconSrc: body?.iconSrc,
            category: body?.category
        })
    )
    return { data: mapTool(response.data) }
}

const updateTool = async (id, body) => {
    const response = await updateResource('tool', id, {
        name: body?.name,
        payload: {
            description: body?.description || '',
            schema: body?.schema || [],
            func: body?.func || '',
            color: body?.color,
            iconSrc: body?.iconSrc,
            category: body?.category
        }
    })
    return { data: mapTool(response.data) }
}

const deleteTool = async (id) => {
    return deleteResource('tool', id)
}

export default {
    getAllTools,
    getSpecificTool,
    createNewTool,
    updateTool,
    deleteTool
}
