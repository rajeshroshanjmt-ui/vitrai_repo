import client from './client'

// Roles
const getAllRoles = () => client.get('/roles')
const getRoleById = (id) => client.get(`/roles/${id}`)
const createRole = (body) => client.post('/roles', body)
const updateRole = (id, body) => client.put(`/roles/${id}`, body)
const deleteRole = (id) => client.delete(`/roles/${id}`)

// Permissions
const getAllPermissions = () => client.get('/permissions')
const createPermission = (body) => client.post('/permissions', body)

// Role Permissions
const getRolePermissions = (roleId) => client.get(`/roles/${roleId}/permissions`)
const assignPermissionsToRole = (roleId, body) => client.post(`/roles/${roleId}/permissions`, body)

export default {
    getAllRoles,
    getRoleById,
    createRole,
    updateRole,
    deleteRole,
    getAllPermissions,
    createPermission,
    getRolePermissions,
    assignPermissionsToRole
}
