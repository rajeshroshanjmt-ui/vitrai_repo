import client from './client'

const fetchLoginActivity = (body) => client.post(`/audit/login-activity`, body)

const getAuditLogs = async (params) => {
    try {
        const response = await client.get('/flows/audit', { params })
        return { data: response?.data }
    } catch (err) {
        console.error('Failed to fetch audit logs:', err.message)
        throw err
    }
}

export default {
    fetchLoginActivity,
    getAuditLogs
}
