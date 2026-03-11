import client from './client'

const WORKSPACE_STORAGE_KEY = 'vetrai_workspace_records_v1'
const WORKSPACE_SHARES_KEY = 'vetrai_workspace_shares_v1'

const safeParse = (value, fallback) => {
    if (!value) return fallback
    try {
        return JSON.parse(value)
    } catch {
        return fallback
    }
}

const getCurrentUser = () => {
    const tenantId = localStorage.getItem('vetrai_tenant_id') || '00000000-0000-0000-0000-000000000001'
    const email = localStorage.getItem('vetrai_email') || 'admin@vetrai.com'
    const role = localStorage.getItem('vetrai_role') || 'admin'
    return {
        id: tenantId,
        email,
        name: email,
        role,
        status: 'active',
        isSSO: false,
        isOrganizationAdmin: role === 'admin',
        activeOrganizationId: tenantId,
        activeWorkspaceId: tenantId,
        activeWorkspace: `tenant-${tenantId.slice(0, 8)}`,
        assignedWorkspaces: [{ id: tenantId, name: `tenant-${tenantId.slice(0, 8)}` }]
    }
}

const defaultWorkspaceName = (organizationId) => `tenant-${organizationId.slice(0, 8)}`

const loadWorkspaceState = () => safeParse(localStorage.getItem(WORKSPACE_STORAGE_KEY), {})

const saveWorkspaceState = (state) => {
    localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(state))
}

const normalizeWorkspace = (workspace, organizationId, user) => {
    const now = new Date().toISOString()
    return {
        id: workspace.id,
        organizationId,
        name: workspace.name || defaultWorkspaceName(organizationId),
        description: workspace.description || '',
        userCount: Number(workspace.userCount || 1),
        isOrgDefault: Boolean(workspace.isOrgDefault || workspace.id === organizationId),
        createdBy: workspace.createdBy || user.id,
        updatedBy: workspace.updatedBy || user.id,
        createdDate: workspace.createdDate || now,
        updatedDate: workspace.updatedDate || now
    }
}

const ensureWorkspacesForOrg = (organizationId, user) => {
    const state = loadWorkspaceState()
    const existing = Array.isArray(state[organizationId]) ? state[organizationId] : []

    if (!existing.length) {
        const defaultWorkspace = normalizeWorkspace(
            {
                id: organizationId,
                name: defaultWorkspaceName(organizationId),
                description: 'Default workspace',
                userCount: 1,
                isOrgDefault: true
            },
            organizationId,
            user
        )
        state[organizationId] = [defaultWorkspace]
        saveWorkspaceState(state)
        return state[organizationId]
    }

    state[organizationId] = existing.map((workspace) => normalizeWorkspace(workspace, organizationId, user))
    saveWorkspaceState(state)
    return state[organizationId]
}

const persistOrgWorkspaces = (organizationId, nextWorkspaces) => {
    const state = loadWorkspaceState()
    state[organizationId] = nextWorkspaces
    saveWorkspaceState(state)
}

const isWorkspaceEndpointUnavailable = (error) => {
    const status = Number(error?.response?.status || 0)
    return status === 404 || status === 405 || status === 501
}

const withFallback = async (backendCall, fallbackCall) => {
    try {
        return await backendCall()
    } catch (error) {
        if (isWorkspaceEndpointUnavailable(error)) {
            return fallbackCall()
        }
        throw error
    }
}

const getIdentityContext = () => {
    const user = getCurrentUser()
    const organizationId = user?.activeOrganizationId || localStorage.getItem('vetrai_tenant_id') || user?.id
    return {
        user,
        organizationId
    }
}

const buildSwitchWorkspacePayload = (user, organizationId, workspace, workspaceList) => {
    const permissions = safeParse(localStorage.getItem('permissions'), [])
    const features = safeParse(localStorage.getItem('features'), {})
    return {
        id: user.id,
        email: user.email,
        name: user.name || user.email,
        status: user.status || 'active',
        role: user.role || 'admin',
        isSSO: Boolean(user.isSSO),
        token: localStorage.getItem('vetrai_access_token'),
        permissions,
        features,
        isOrganizationAdmin: user.isOrganizationAdmin ?? user.role === 'admin',
        activeOrganizationId: organizationId,
        activeOrganizationSubscriptionId: user.activeOrganizationSubscriptionId || null,
        activeOrganizationCustomerId: user.activeOrganizationCustomerId || null,
        activeOrganizationProductId: user.activeOrganizationProductId || null,
        activeWorkspaceId: workspace.id,
        activeWorkspace: workspace.name,
        assignedWorkspaces: workspaceList.map((item) => ({
            id: item.id,
            name: item.name
        })),
        lastLogin: new Date().toISOString()
    }
}

const getAllWorkspacesByOrganizationId = async (organizationId) => {
    const targetOrgId = organizationId || getIdentityContext().organizationId
    return withFallback(
        () => client.get(`/workspace?organizationId=${targetOrgId}`),
        () => {
            const { user } = getIdentityContext()
            const workspaces = ensureWorkspacesForOrg(targetOrgId, user)
            return { data: workspaces, status: 200 }
        }
    )
}

const getWorkspaceById = async (id) => {
    return withFallback(
        () => client.get(`/workspace?id=${id}`),
        () => {
            const { user, organizationId } = getIdentityContext()
            const workspaces = ensureWorkspacesForOrg(organizationId, user)
            const workspace = workspaces.find((item) => item.id === id) || workspaces[0]
            return { data: workspace, status: 200 }
        }
    )
}

const unlinkUsers = async (id, body) => {
    return withFallback(
        () => client.post(`/workspace/unlink-users/${id}`, body),
        () => ({ data: { status: 'ok', workspaceId: id }, status: 200 })
    )
}

const linkUsers = async (id, body) => {
    return withFallback(
        () => client.post(`/workspace/link-users/${id}`, body),
        () => ({ data: { status: 'ok', workspaceId: id }, status: 200 })
    )
}

const switchWorkspace = async (id) => {
    return withFallback(
        () => client.post(`/workspace/switch?id=${id}`),
        () => {
            const { user, organizationId } = getIdentityContext()
            const workspaces = ensureWorkspacesForOrg(organizationId, user)
            const selected = workspaces.find((workspace) => workspace.id === id) || workspaces[0]
            const payload = buildSwitchWorkspacePayload(user, organizationId, selected, workspaces)
            return { data: payload, status: 200 }
        }
    )
}

const createWorkspace = async (body = {}) => {
    return withFallback(
        () => client.post('/workspace', body),
        () => {
            const { user } = getIdentityContext()
            const organizationId = body.organizationId || user.activeOrganizationId
            const workspaces = ensureWorkspacesForOrg(organizationId, user)

            const id = globalThis?.crypto?.randomUUID?.() || `ws_${Date.now()}`
            const nextWorkspace = normalizeWorkspace(
                {
                    id,
                    name: body.name || `Workspace ${workspaces.length + 1}`,
                    description: body.description || '',
                    userCount: 1,
                    isOrgDefault: false,
                    createdBy: body.createdBy || user.id,
                    updatedBy: body.createdBy || user.id
                },
                organizationId,
                user
            )
            const nextWorkspaces = [...workspaces, nextWorkspace]
            persistOrgWorkspaces(organizationId, nextWorkspaces)
            return { data: nextWorkspace, status: 200 }
        }
    )
}

const updateWorkspace = async (body = {}) => {
    return withFallback(
        () => client.put('/workspace', body),
        () => {
            const { user, organizationId } = getIdentityContext()
            const workspaces = ensureWorkspacesForOrg(organizationId, user)
            const nextWorkspaces = workspaces.map((workspace) =>
                workspace.id === body.id
                    ? {
                          ...workspace,
                          name: body.name || workspace.name,
                          description: body.description ?? workspace.description,
                          updatedBy: body.updatedBy || user.id,
                          updatedDate: new Date().toISOString()
                      }
                    : workspace
            )
            persistOrgWorkspaces(organizationId, nextWorkspaces)
            const updated = nextWorkspaces.find((workspace) => workspace.id === body.id)
            return { data: updated || {}, status: 200 }
        }
    )
}

const deleteWorkspace = async (id) => {
    return withFallback(
        () => client.delete(`/workspace/${id}`),
        () => {
            const { user, organizationId } = getIdentityContext()
            const workspaces = ensureWorkspacesForOrg(organizationId, user)
            const nextWorkspaces = workspaces.filter((workspace) => workspace.id !== id)
            persistOrgWorkspaces(organizationId, nextWorkspaces)
            return { data: { status: 'deleted', id }, status: 200 }
        }
    )
}

const getSharedWorkspacesForItem = async (id) => {
    return withFallback(
        () => client.get(`/workspace/shared/${id}`),
        () => {
            const shared = safeParse(localStorage.getItem(WORKSPACE_SHARES_KEY), {})
            const workspaceIds = Array.isArray(shared[id]) ? shared[id] : []
            return {
                data: workspaceIds.map((workspaceId) => ({ workspaceId })),
                status: 200
            }
        }
    )
}

const setSharedWorkspacesForItem = async (id, body = {}) => {
    return withFallback(
        () => client.post(`/workspace/shared/${id}`, body),
        () => {
            const shared = safeParse(localStorage.getItem(WORKSPACE_SHARES_KEY), {})
            const workspaceIds = Array.isArray(body.workspaceIds) ? body.workspaceIds : []
            shared[id] = workspaceIds
            localStorage.setItem(WORKSPACE_SHARES_KEY, JSON.stringify(shared))
            return {
                data: {
                    status: 'ok',
                    itemId: id,
                    workspaceIds
                },
                status: 200
            }
        }
    )
}

const updateWorkspaceUserRole = async (body = {}) => {
    return withFallback(
        () => client.put('/workspaceuser', body),
        () => ({
            data: {
                status: 'ok',
                ...body
            },
            status: 200
        })
    )
}

export default {
    getAllWorkspacesByOrganizationId,
    getWorkspaceById,
    createWorkspace,
    updateWorkspace,
    deleteWorkspace,
    unlinkUsers,
    linkUsers,
    switchWorkspace,
    getSharedWorkspacesForItem,
    setSharedWorkspacesForItem,
    updateWorkspaceUserRole
}
