import client from './client'

const isNotFound = (error) => error?.response?.status === 404
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const normalizeErrorText = (error) => {
    const detail = error?.response?.data?.detail
    const message = error?.response?.data?.message
    if (typeof detail === 'string' && detail.trim()) return detail
    if (detail && typeof detail === 'object') {
        const nestedMessage = detail.message || detail.error || ''
        if (typeof nestedMessage === 'string' && nestedMessage.trim()) return nestedMessage
    }
    if (typeof message === 'string' && message.trim()) return message
    return String(error?.message || '').trim()
}

const mapExecutionLogToPrediction = (log, input = {}) => ({
    text: log?.response_text || '',
    chatMessageId: log?.execution_log_id,
    chatId: input?.chatId || log?.execution_log_id,
    sourceDocuments: [],
    usedTools: [],
    calledTools: [],
    agentReasoning: null,
    agentFlowExecutedData: null,
    action: null,
    artifacts: null
})

const pollExecutionResult = async (executionLogId, attempts = 45, intervalMs = 450) => {
    for (let i = 0; i < attempts; i += 1) {
        const logsResponse = await client.get('/flows/logs', { params: { limit: 100 } })
        const logs = Array.isArray(logsResponse?.data) ? logsResponse.data : []
        const execution = logs.find((item) => item.execution_log_id === executionLogId)
        if (!execution) {
            await sleep(intervalMs)
            continue
        }

        if (execution.status === 'completed') {
            return execution
        }

        if (execution.status === 'failed') {
            const error = new Error(execution.error_message || 'Flow execution failed')
            error.response = { data: { message: execution.error_message || 'Flow execution failed' } }
            throw error
        }

        await sleep(intervalMs)
    }

    const error = new Error('Execution timed out while waiting for response')
    error.response = { data: { message: 'Execution timed out while waiting for response' } }
    throw error
}

const executeViaFlowsApi = async (id, input) => {
    const payload = {
        input: {
            question: input?.question || input?.prompt || ''
        },
        enable_tools: true,
        wait_for_ingestion: false,
        llm_provider: input?.llmProvider || input?.llm_provider,
        llm_model: input?.llmModel || input?.llm_model
    }

    let executeResponse
    try {
        executeResponse = await client.post(`/flows/${id}/execute`, payload)
    } catch (error) {
        const status = error?.response?.status
        const errorText = normalizeErrorText(error).toLowerCase()
        if (status === 400 && errorText.includes('no published version')) {
            await client.post(`/flows/${id}/publish`, {})
            executeResponse = await client.post(`/flows/${id}/execute`, payload)
        } else {
            throw error
        }
    }

    const executionLogId = executeResponse?.data?.execution_log_id
    if (!executionLogId) {
        const error = new Error('Execution did not return execution_log_id')
        error.response = { data: { message: 'Execution did not return execution_log_id' } }
        throw error
    }

    const execution = await pollExecutionResult(executionLogId)
    return { data: mapExecutionLogToPrediction(execution, input) }
}

const sendMessageAndGetPrediction = async (id, input) => {
    try {
        return await executeViaFlowsApi(id, input)
    } catch (error) {
        if (isNotFound(error)) {
            return client.post(`/internal-prediction/${id}`, input)
        }
        throw error
    }
}

const sendMessageAndStreamPrediction = async (id, input) => {
    try {
        return await executeViaFlowsApi(id, input)
    } catch (error) {
        if (isNotFound(error)) {
            return client.post(`/internal-prediction/stream/${id}`, input)
        }
        throw error
    }
}

const sendMessageAndGetPredictionPublic = async (id, input) => {
    try {
        return await executeViaFlowsApi(id, input)
    } catch (error) {
        if (isNotFound(error)) {
            return client.post(`/prediction/${id}`, input)
        }
        throw error
    }
}

export default {
    sendMessageAndGetPrediction,
    sendMessageAndStreamPrediction,
    sendMessageAndGetPredictionPublic
}
