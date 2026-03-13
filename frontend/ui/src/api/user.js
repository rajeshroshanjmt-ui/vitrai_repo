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
    const user = await buildUserFromMe()
    return {
        data: [
            {
                id: user.id,
                userId: user.id,
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    status: 'active'
                },
                role: { name: user.role || 'admin' },
                isOrgOwner: true
            }
        ]
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
const updateOrganizationUser = async () => ({ data: { status: 'ok' } })
const deleteOrganizationUser = async () => ({ data: { status: 'ok' } })

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
const deleteWorkspaceUser = async () => ({ data: { status: 'ok' } })

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
    deleteOrganizationUser
}
