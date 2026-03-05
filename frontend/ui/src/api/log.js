import client from './client'

const getLogs = async (startDate, endDate) => {
    const response = await client.get('/flows/logs', { params: { limit: 200 } })
    const logs = Array.isArray(response?.data) ? response.data : []

    const start = startDate ? new Date(startDate).getTime() : null
    const end = endDate ? new Date(endDate).getTime() : null

    const filtered = logs.filter((log) => {
        const ts = new Date(log.created_at).getTime()
        if (start && ts < start) return false
        if (end && ts > end) return false
        return true
    })

    return {
        data: filtered.map((log) => ({
            id: log.execution_log_id,
            level: log.status === 'ERROR' ? 'error' : 'info',
            message: log.error_message || log.response_text || 'Execution event',
            timestamp: log.created_at,
            context: {
                flowId: log.flow_id,
                tokensUsed: log.tokens_used,
                latencyMs: log.execution_time_ms
            }
        }))
    }
}

export default {
    getLogs
}
