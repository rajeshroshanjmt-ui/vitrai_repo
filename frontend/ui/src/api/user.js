import client from './client'

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
const getAllUsersByOrganizationId = async () => ({ data: [] })
const getUserByUserIdOrganizationId = async () => ({ data: [] })
const getOrganizationsByUserId = async () => ({ data: [] })
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
const getAllUsersByWorkspaceId = async () => ({ data: [] })
const getUserByRoleId = async () => ({ data: [] })
const getUserByUserIdWorkspaceId = async () => ({ data: [] })
const getWorkspacesByUserId = async () => ({ data: [] })
const getWorkspacesByOrganizationIdUserId = async () => ({ data: [] })
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
