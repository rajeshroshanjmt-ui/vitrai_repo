const FAILURE_STATES = new Set(['ERROR', 'TIMEOUT', 'STOPPED', 'TERMINATED'])

export const parseExecutionData = (executionData) => {
    if (!executionData) return []
    if (Array.isArray(executionData)) return executionData

    if (typeof executionData === 'string') {
        try {
            const parsed = JSON.parse(executionData)
            if (Array.isArray(parsed)) return parsed
            if (parsed && typeof parsed === 'object') return [parsed]
            return []
        } catch {
            return []
        }
    }

    if (typeof executionData === 'object') return [executionData]
    return []
}

const toFiniteNumber = (value) => {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
}

const readNodeError = (node) => {
    if (!node || typeof node !== 'object') return ''

    const rawError = node?.data?.error || node?.error || node?.data?.output?.error || node?.data?.output?.errorMessage
    if (!rawError) return ''

    if (typeof rawError === 'string') return rawError
    if (rawError?.message) return String(rawError.message)

    try {
        return JSON.stringify(rawError)
    } catch {
        return 'Execution error'
    }
}

const readNodeMetrics = (node) => {
    const metrics = node?.data?.metrics || {}
    const outputUsage = node?.data?.output?.usageMetadata || {}
    const outputTime = node?.data?.output?.timeMetadata || {}

    const durationMs =
        toFiniteNumber(metrics.execution_time_ms) ||
        toFiniteNumber(metrics.executionTimeMs) ||
        toFiniteNumber(outputTime.delta) ||
        toFiniteNumber(node?.execution_time_ms)

    const tokensUsed =
        toFiniteNumber(metrics.tokens_used) ||
        toFiniteNumber(metrics.total_tokens) ||
        toFiniteNumber(outputUsage.total_tokens) ||
        toFiniteNumber(node?.tokens_used)

    return {
        durationMs,
        tokensUsed
    }
}

export const getExecutionMetrics = (executionData) => {
    const nodes = parseExecutionData(executionData)

    let durationMs = 0
    let tokensUsed = 0
    let errorCount = 0
    let firstError = ''

    nodes.forEach((node) => {
        const nodeMetrics = readNodeMetrics(node)
        const errorMessage = readNodeError(node)

        durationMs += nodeMetrics.durationMs
        tokensUsed += nodeMetrics.tokensUsed

        if (errorMessage) {
            errorCount += 1
            if (!firstError) firstError = errorMessage
        }
    })

    return {
        durationMs,
        tokensUsed,
        errorCount,
        firstError
    }
}

export const buildExecutionLogs = (executionData) => {
    const nodes = parseExecutionData(executionData)

    return nodes.map((node, index) => {
        const nodeMetrics = readNodeMetrics(node)
        const status = String(node?.status || '').toUpperCase() || 'UNKNOWN'
        const errorMessage = readNodeError(node)

        return {
            id: `${node?.nodeId || 'node'}_${index}`,
            nodeId: node?.nodeId,
            nodeLabel: node?.nodeLabel || node?.data?.name || node?.nodeId || `Node ${index + 1}`,
            status,
            durationMs: nodeMetrics.durationMs,
            tokensUsed: nodeMetrics.tokensUsed,
            errorMessage,
            hasError: Boolean(errorMessage) || FAILURE_STATES.has(status)
        }
    })
}

export const enrichExecutionRow = (row) => {
    const metrics = getExecutionMetrics(row?.executionData)
    return {
        ...row,
        _metrics: metrics
    }
}

export const summarizeExecutions = (rows = []) => {
    const summary = {
        total: rows.length,
        inProgress: 0,
        failed: 0,
        finished: 0,
        totalTokens: 0,
        avgDurationMs: 0
    }

    if (!Array.isArray(rows) || rows.length === 0) return summary

    let durationAccumulator = 0

    rows.forEach((row) => {
        const state = String(row?.state || row?.status || '').toUpperCase()
        const metrics = row?._metrics || getExecutionMetrics(row?.executionData)

        summary.totalTokens += toFiniteNumber(metrics.tokensUsed)
        durationAccumulator += toFiniteNumber(metrics.durationMs)

        if (state === 'INPROGRESS') summary.inProgress += 1
        else if (state === 'FINISHED') summary.finished += 1
        else if (FAILURE_STATES.has(state)) summary.failed += 1
    })

    summary.avgDurationMs = rows.length ? Math.round(durationAccumulator / rows.length) : 0

    return summary
}
