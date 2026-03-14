import client from './client'

const WORKSPACE_STORAGE_KEY = 'vetrai_workspace_records_v1'

const safeParse = (value, fallback) => {
    if (!value) return fallback
    try {
        return JSON.parse(value)
    } catch {
        return fallback
    }
}

const loadWorkspaceState = () => safeParse(localStorage.getItem(WORKSPACE_STORAGE_KEY), {})

const saveWorkspaceState = (state) => {
    localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(state))
}

const defaultWorkspaceName = (tenantId) => `tenant-${tenantId.slice(0, 8)}`

const ensureDefaultWorkspace = (tenantId, userId) => {
    const state = loadWorkspaceState()
    const current = Array.isArray(state[tenantId]) ? state[tenantId] : []
    if (current.length > 0) return current

    const now = new Date().toISOString()
    const fallback = [
        {
            id: tenantId,
            organizationId: tenantId,
            name: defaultWorkspaceName(tenantId),
            description: 'Default workspace',
            userCount: 1,
            isOrgDefault: true,
            createdBy: userId,
            updatedBy: userId,
            createdDate: now,
            updatedDate: now
        }
    ]
    state[tenantId] = fallback
    saveWorkspaceState(state)
    return fallback
}

const buildUserFromMe = async () => {
    const me = await client.get('/auth/me')
    const tenantId = me?.data?.tenant_id || localStorage.getItem('vetrai_tenant_id')
    const email = me?.data?.email || 'admin@vetrai.com'
    const id = me?.data?.user_id || tenantId
    return {
        id,
        name: email,
        email,
        role: me?.data?.role || 'admin',
        activeOrganizationId: tenantId,
        activeWorkspaceId: tenantId,
        activeWorkspace: defaultWorkspaceName(tenantId),
        activeOrganizationSubscriptionId: null,
        activeOrganizationCustomerId: null,
        activeOrganizationProductId: null
    }
}

// users
const getUserById = async () => {
    const user = await buildUserFromMe()
    return { data: user }
}

const updateUser = async (body) => {
    const current = await buildUserFromMe()
    return {
        data: {
            ...current,
            name: body?.name || current.name,
            email: body?.email || current.email
        }
    }
}

// organization users
const getAllUsersByOrganizationId = async () => {
    try {
        const response = await client.get('/users')
        const users = response?.data?.data || []
        return {
            data: users.map(u => ({
                id: u.id,
                userId: u.id,
                user: {
                    id: u.id,
                    name: u.email,
                    email: u.email,
                    status: u.status
                },
                role: { name: u.role },
                isOrgOwner: u.role === 'admin'
            }))
        }
    } catch (err) {
        console.error('Failed to fetch organization users:', err.message)
        return { data: [] }
    }
}
const getUserByUserIdOrganizationId = async () => ({ data: [] })
const getOrganizationsByUserId = async () => {
    const user = await buildUserFromMe()
    return {
        data: [
            {
                organizationId: user.activeOrganizationId,
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email
                }
            }
        ]
    }
}
const updateOrganizationUser = async (body) => {
    try {
        const userId = body?.id || body?.userId
        const response = await client.put(`/users/${userId}`, {
            role: body?.role?.name || body?.role || 'viewer'
        })
        return { data: response?.data }
    } catch (err) {
        console.error('Failed to update organization user:', err.message)
        return { data: { status: 'error' } }
    }
}
const deleteOrganizationUser = async (body) => {
    try {
        const userId = body?.id || body?.userId
        await client.delete(`/users/${userId}`)
        return { data: { status: 'ok' } }
    } catch (err) {
        console.error('Failed to delete organization user:', err.message)
        return { data: { status: 'error' } }
    }
}

const resendUserInvitation = async (userId) => {
    try {
        const response = await client.post(`/users/${userId}/resend-invitation`)
        return { data: response?.data }
    } catch (err) {
        console.error('Failed to resend invitation:', err.message)
        return { data: { status: 'error', error: err.message } }
    }
}

const getAdditionalSeatsQuantity = async () => ({
    data: {
        includedSeats: 1,
        quantity: 0,
        totalOrgUsers: 1
    }
})
const getCustomerDefaultSource = async () => ({ data: null })
const getAdditionalSeatsProration = async () => ({ data: null })
const updateAdditionalSeats = async () => ({ data: { status: 'ok' } })
const getPlanProration = async () => ({ data: null })
const updateSubscriptionPlan = async () => ({ data: { status: 'ok' } })
const getCurrentUsage = async () => ({
    data: {
        predictions: {
            usage: 0,
            limit: 1000
        },
        storage: {
            usage: 0,
            limit: 1024
        }
    }
})

// workspace users
const getAllUsersByWorkspaceId = async (workspaceId) => {
    try {
        // For now, return all users assigned to the workspace
        // This will be updated when workspace-user association is implemented
        const response = await client.get(`/workspace/${workspaceId}/users`)
        const users = response?.data?.data || []
        return {
            data: users.map(u => ({
                id: u.id,
                userId: u.id,
                workspaceId,
                user: {
                    id: u.id,
                    name: u.email,
                    email: u.email,
                    status: u.status
                },
                role: { name: u.role },
                isOrgOwner: u.role === 'admin',
                status: u.status
            }))
        }
    } catch (err) {
        // Fallback: return current user if endpoint not available
        const user = await buildUserFromMe()
        return {
            data: [
                {
                    id: user.id,
                    userId: user.id,
                    workspaceId,
                    user: {
                        id: user.id,
                        name: user.name,
                        email: user.email,
                        status: 'active'
                    },
                    role: { name: user.role || 'admin' },
                    isOrgOwner: true,
                    status: 'active'
                }
            ]
        }
    }
}
const getUserByRoleId = async () => ({ data: [] })
const getUserByUserIdWorkspaceId = async () => ({ data: [] })
const getWorkspacesByUserId = async () => {
    const user = await buildUserFromMe()
    const workspaces = ensureDefaultWorkspace(user.activeOrganizationId, user.id)
    return {
        data: workspaces.map((workspace) => ({
            workspaceId: workspace.id,
            workspace: {
                id: workspace.id,
                name: workspace.name,
                organizationId: workspace.organizationId || user.activeOrganizationId,
                description: workspace.description || ''
            }
        }))
    }
}
const getWorkspacesByOrganizationIdUserId = async (organizationId) => {
    const user = await buildUserFromMe()
    const targetOrgId = organizationId || user.activeOrganizationId
    const workspaces = ensureDefaultWorkspace(targetOrgId, user.id)
    return {
        data: workspaces.map((workspace) => ({
            workspaceId: workspace.id,
            workspace: {
                id: workspace.id,
                name: workspace.name,
                organizationId: workspace.organizationId || targetOrgId,
                description: workspace.description || ''
            }
        }))
    }
}
const deleteWorkspaceUser = async (body) => {
    try {
        const workspaceId = body?.workspaceId
        const userId = body?.userId || body?.id
        await client.delete(`/workspace/${workspaceId}/users/${userId}`)
        return { data: { status: 'ok' } }
    } catch (err) {
        console.error('Failed to delete workspace user:', err.message)
        return { data: { status: 'error' } }
    }
}

export default {
    getUserById,
    updateUser,
    getAllUsersByOrganizationId,
    getUserByUserIdOrganizationId,
    getOrganizationsByUserId,
    getAllUsersByWorkspaceId,
    getUserByRoleId,
    getUserByUserIdWorkspaceId,
    getWorkspacesByUserId,
    getWorkspacesByOrganizationIdUserId,
    updateOrganizationUser,
    deleteWorkspaceUser,
    getAdditionalSeatsQuantity,
    getCustomerDefaultSource,
    getAdditionalSeatsProration,
    updateAdditionalSeats,
    getPlanProration,
    updateSubscriptionPlan,
    getCurrentUsage,
    deleteOrganizationUser,
    resendUserInvitation
}
