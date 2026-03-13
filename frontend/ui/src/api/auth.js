import axios from 'axios'
import { baseURL } from '@/store/constant'

const DEFAULT_FEATURES = {
    'feat:datasets': true,
    'feat:evaluators': true,
    'feat:evaluations': true,
    'feat:logs': true,
    'feat:files': false,
    'feat:account': true,
    'feat:sso-config': false,
    'feat:roles': false,
    'feat:users': true,
    'feat:workspaces': true,
    'feat:login-activity': false
}

const DEFAULT_PERMISSIONS = [
    'chatflows:view',
    'chatflows:create',
    'chatflows:edit',
    'chatflows:delete',
    'chatflows:export',
    'chatflows:import',
    'chatflows:duplicate',
    'chatflows:config',
    'agentflows:view',
    'agentflows:create',
    'agentflows:edit',
    'agentflows:delete',
    'executions:view',
    'assistants:view',
    'assistants:create',
    'assistants:edit',
    'assistants:delete',
    'templates:marketplace',
    'templates:custom',
    'templates:custom-share',
    'templates:flowexport',
    'tools:view',
    'tools:create',
    'tools:edit',
    'tools:delete',
    'credentials:view',
    'credentials:create',
    'credentials:edit',
    'credentials:share',
    'credentials:delete',
    'variables:view',
    'variables:create',
    'variables:update',
    'variables:delete',
    'apikeys:view',
    'apikeys:create',
    'apikeys:update',
    'apikeys:delete',
    'documentStores:view',
    'documentStores:create',
    'documentStores:edit',
    'documentStores:delete',
    'datasets:view',
    'datasets:create',
    'datasets:update',
    'datasets:delete',
    'evaluators:view',
    'evaluators:create',
    'evaluators:update',
    'evaluators:delete',
    'evaluations:view',
    'evaluations:create',
    'evaluations:update',
    'evaluations:delete',
    'logs:view',
    'users:manage',
    'workspace:view',
    'workspace:create',
    'workspace:update',
    'workspace:delete',
    'workspace:add-user',
    'workspace:unlink-user',
    'workspace:export',
    'workspace:import'
]

const makePerm = (key, value) => ({
    key,
    value,
    isOpenSource: true,
    isEnterprise: true,
    isCloud: true
})

const PERMISSIONS_BY_CATEGORY = {
    chatflows: [
        makePerm('chatflows:view', 'View'),
        makePerm('chatflows:create', 'Create'),
        makePerm('chatflows:edit', 'Edit'),
        makePerm('chatflows:delete', 'Delete'),
        makePerm('chatflows:export', 'Export'),
        makePerm('chatflows:import', 'Import'),
        makePerm('chatflows:duplicate', 'Duplicate'),
        makePerm('chatflows:config', 'Configure')
    ],
    agentflows: [makePerm('agentflows:view', 'View'), makePerm('agentflows:create', 'Create'), makePerm('agentflows:edit', 'Edit')],
    assistants: [makePerm('assistants:view', 'View'), makePerm('assistants:create', 'Create'), makePerm('assistants:edit', 'Edit')],
    executions: [makePerm('executions:view', 'View')],
    tools: [makePerm('tools:view', 'View'), makePerm('tools:create', 'Create'), makePerm('tools:edit', 'Edit')],
    documentStores: [
        makePerm('documentStores:view', 'View'),
        makePerm('documentStores:create', 'Create'),
        makePerm('documentStores:edit', 'Edit')
    ],
    datasets: [makePerm('datasets:view', 'View'), makePerm('datasets:create', 'Create'), makePerm('datasets:update', 'Update')],
    evaluators: [
        makePerm('evaluators:view', 'View'),
        makePerm('evaluators:create', 'Create'),
        makePerm('evaluators:update', 'Update')
    ],
    evaluations: [
        makePerm('evaluations:view', 'View'),
        makePerm('evaluations:create', 'Create'),
        makePerm('evaluations:update', 'Update')
    ],
    credentials: [
        makePerm('credentials:view', 'View'),
        makePerm('credentials:create', 'Create'),
        makePerm('credentials:edit', 'Edit')
    ],
    variables: [
        makePerm('variables:view', 'View'),
        makePerm('variables:create', 'Create'),
        makePerm('variables:update', 'Update')
    ],
    apikeys: [makePerm('apikeys:view', 'View'), makePerm('apikeys:create', 'Create'), makePerm('apikeys:update', 'Update')],
    templates: [
        makePerm('templates:marketplace', 'Marketplace Access'),
        makePerm('templates:custom', 'Custom Templates'),
        makePerm('templates:custom-share', 'Share Custom Templates'),
        makePerm('templates:flowexport', 'Save As Template')
    ],
    workspace: [
        makePerm('workspace:view', 'View'),
        makePerm('workspace:create', 'Create'),
        makePerm('workspace:update', 'Update'),
        makePerm('workspace:delete', 'Delete'),
        makePerm('workspace:add-user', 'Add User'),
        makePerm('workspace:unlink-user', 'Remove User'),
        makePerm('workspace:export', 'Export'),
        makePerm('workspace:import', 'Import')
    ],
    logs: [makePerm('logs:view', 'View')]
}

const resolveLogin = async () => {
    // `/login` is the resolver route; it must send users to the actual sign-in page.
    return { data: { redirectUrl: '/signin' } }
}

const buildLoginPayload = (token, meData, tenantId) => {
    const role = meData?.role || 'admin'
    const userEmail = meData?.email || 'admin@vetrai.com'
    const userId = meData?.user_id || meData?.id || tenantId

    return {
        id: userId,
        email: userEmail,
        name: userEmail,
        status: 'active',
        role,
        isSSO: false,
        token,
        permissions: DEFAULT_PERMISSIONS,
        features: DEFAULT_FEATURES,
        isOrganizationAdmin: role === 'admin',
        activeOrganizationId: tenantId,
        activeOrganizationSubscriptionId: null,
        activeOrganizationCustomerId: null,
        activeOrganizationProductId: null,
        activeWorkspaceId: tenantId,
        activeWorkspace: `tenant-${tenantId.slice(0, 8)}`,
        assignedWorkspaces: [
            {
                id: tenantId,
                name: `tenant-${tenantId.slice(0, 8)}`
            }
        ],
        lastLogin: new Date().toISOString()
    }
}

const login = async (body) => {
    const tenant_id = body?.tenant_id || localStorage.getItem('vetrai_tenant_id') || '00000000-0000-0000-0000-000000000001'
    const email = body?.email || body?.username || 'admin@vetrai.com'
    const password = body?.password

    const tokenResponse = await axios.post(`${baseURL}/api/auth/token`, {
        email,
        password,
        tenant_id
    })

    const token = tokenResponse?.data?.access_token

    const meResponse = await axios.get(`${baseURL}/api/auth/me`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
    })

    const role = meResponse?.data?.role || 'admin'
    if (token) {
        localStorage.setItem('vetrai_access_token', token)
        localStorage.setItem('vetrai_tenant_id', tenant_id)
        localStorage.setItem('vetrai_email', email)
        localStorage.setItem('vetrai_role', role)
    }

    return {
        data: buildLoginPayload(token, meResponse?.data, tenant_id)
    }
}

const getAllPermissions = async () => {
    return {
        data: PERMISSIONS_BY_CATEGORY
    }
}

const ssoSuccess = async () => {
    return {
        data: {
            redirectUrl: '/chatflows'
        }
    }
}

export default {
    resolveLogin,
    login,
    getAllPermissions,
    ssoSuccess
}
