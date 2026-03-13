import { useEffect, useMemo, useState } from 'react'
import moment from 'moment'
import { useNavigate } from 'react-router-dom'

import {
    Box,
    Button,
    Chip,
    Paper,
    Skeleton,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    Typography,
    useTheme
} from '@mui/material'
import {
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    Legend,
    Line,
    LineChart,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip as RechartsTooltip,
    XAxis,
    YAxis
} from 'recharts'

import MainCard from '@/ui-component/cards/MainCard'
import ViewHeader from '@/layout/MainLayout/ViewHeader'
import chatflowsApi from '@/api/chatflows'
import assistantsApi from '@/api/assistants'
import executionsApi from '@/api/executions'
import client from '@/api/client'
import ErrorBoundary from '@/ErrorBoundary'
import { useAuth } from '@/hooks/useAuth'

import {
    IconAlertTriangle,
    IconCircleCheck,
    IconClock,
    IconCoins,
    IconHierarchy,
    IconPlayerPlay,
    IconPlus,
    IconRobot,
    IconUpload
} from '@tabler/icons-react'

const SUCCESS_STATES = new Set(['FINISHED'])
const FAILURE_STATES = new Set(['ERROR', 'TIMEOUT', 'STOPPED', 'TERMINATED'])
const PIE_COLORS = ['#dc2626', '#d97706', '#2563eb', '#059669', '#7c3aed']

const normalizeStatusValue = (rawStatus) => {
    if (typeof rawStatus === 'boolean') return rawStatus ? 'ok' : 'error'

    const status = String(rawStatus || 'unknown').toLowerCase()
    if (status === 'ok' || status === 'healthy' || status === 'pass') return 'ok'
    if (status === 'degraded' || status === 'warn' || status === 'warning') return 'degraded'
    if (status === 'error' || status === 'failed' || status === 'down' || status === 'critical') return 'error'

    return 'unknown'
}

const getStatusChipColor = (status) => {
    if (status === 'ok') return 'success'
    if (status === 'degraded') return 'warning'
    if (status === 'error') return 'error'
    return 'default'
}

const getExecutionStateChipColor = (state) => {
    const normalized = String(state || '').toUpperCase()
    if (SUCCESS_STATES.has(normalized)) return 'success'
    if (FAILURE_STATES.has(normalized)) return 'error'
    if (normalized === 'INPROGRESS') return 'info'
    return 'default'
}

const parseExecutionData = (executionData) => {
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

const extractExecutionMetrics = (execution) => {
    const nodes = parseExecutionData(execution?.executionData)
    let executionTimeMs = 0
    let tokensUsed = 0

    nodes.forEach((node) => {
        const metrics = node?.data?.metrics || {}
        const usageMetadata = node?.data?.output?.usageMetadata || {}

        const nodeDuration = Number(metrics.execution_time_ms || metrics.executionTimeMs || 0)
        const nodeTokens = Number(metrics.tokens_used || metrics.total_tokens || usageMetadata.total_tokens || 0)

        executionTimeMs += Number.isFinite(nodeDuration) ? nodeDuration : 0
        tokensUsed += Number.isFinite(nodeTokens) ? nodeTokens : 0
    })

    return {
        executionTimeMs,
        tokensUsed
    }
}

const findServiceStatus = (checks, candidates) => {
    const entries = Object.entries(checks || {})

    for (const candidate of candidates) {
        const match = entries.find(([name]) => {
            const normalizedName = String(name || '').toLowerCase()
            return normalizedName === candidate || normalizedName.includes(candidate)
        })

        if (match) {
            const rawValue = match[1]
            if (typeof rawValue === 'object' && rawValue !== null) {
                return normalizeStatusValue(rawValue.status)
            }
            return normalizeStatusValue(rawValue)
        }
    }

    return 'unknown'
}

const formatNumber = (value) => new Intl.NumberFormat().format(Number(value || 0))

const MetricCard = ({ title, value, subtitle, icon: Icon, iconColor, accentColor }) => {
    const theme = useTheme()
    const finalAccentColor = accentColor || iconColor || theme.palette.primary.main

    return (
        <Paper
            sx={{
                borderRadius: 2,
                border: `1px solid ${theme.palette.divider}`,
                borderLeft: `3px solid ${finalAccentColor}`,
                p: 2.5,
                height: '100%'
            }}
        >
            <Stack direction='row' alignItems='center' justifyContent='space-between'>
                <Typography variant='caption' color='text.secondary'>
                    {title}
                </Typography>
                {Icon && (
                    <Box sx={{
                        backgroundColor: `rgba(${finalAccentColor}, 0.08)`,
                        borderRadius: '6px',
                        p: 0.75,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        lineHeight: 0,
                        color: finalAccentColor
                    }}>
                        <Icon size={18} />
                    </Box>
                )}
            </Stack>
            <Typography variant='h3' sx={{ mt: 0.5 }}>
                {value}
            </Typography>
            <Typography variant='body2' color='text.secondary' sx={{ mt: 0.5 }}>
                {subtitle}
            </Typography>
        </Paper>
    )
}

const ChartCard = ({ title, children }) => (
    <Paper sx={{ borderRadius: 2, p: 3, minHeight: 320 }}>
        <Typography variant='h4' sx={{ mb: 2 }}>
            {title}
        </Typography>
        {children}
    </Paper>
)

const Dashboard = () => {
    const theme = useTheme()
    const navigate = useNavigate()
    const { hasPermission } = useAuth()

    const [isLoading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [metrics, setMetrics] = useState({
        totalAgents: 0,
        totalWorkflows: 0,
        executionsToday: 0,
        successRate: 0,
        tokenUsage: 0,
        errorRate: 0
    })
    const [recentExecutions, setRecentExecutions] = useState([])
    const [dailyUsage, setDailyUsage] = useState([])
    const [topAgents, setTopAgents] = useState([])
    const [failureDistribution, setFailureDistribution] = useState([])
    const [health, setHealth] = useState({
        status: 'unknown',
        checks: {}
    })

    useEffect(() => {
        const load = async () => {
            setLoading(true)
            setError(null)

            try {
                const [chatflowsResp, agentflowsResp, assistantsResp, executionsResp, usageResp, readyResp] = await Promise.all([
                    chatflowsApi.getAllChatflows({ limit: 500 }),
                    chatflowsApi.getAllAgentflows('AGENTFLOW', { limit: 500 }),
                    assistantsApi.getAllAssistants('CUSTOM'),
                    executionsApi.getAllExecutions({ page: 1, limit: 200 }),
                    client.get('/flows/usage', { params: { days: 30 } }),
                    client
                        .get('/health/ready')
                        .catch((readyError) => {
                            if (readyError?.response?.data?.detail) {
                                return { data: readyError.response.data.detail }
                            }
                            return client.get('/health').catch(() => ({ data: { status: 'unknown', checks: {} } }))
                        })
                ])

                const chatflows = Array.isArray(chatflowsResp?.data?.data) ? chatflowsResp.data.data : []
                const agentflows = Array.isArray(agentflowsResp?.data?.data) ? agentflowsResp.data.data : []
                const assistants = Array.isArray(assistantsResp?.data) ? assistantsResp.data : []
                const executionRows = Array.isArray(executionsResp?.data?.data) ? executionsResp.data.data : []
                const usageData = usageResp?.data || {}

                const flowNameById = new Map([...chatflows, ...agentflows].map((flow) => [flow.id, flow.name]))

                const normalizedExecutions = executionRows
                    .map((execution) => {
                        const metrics = extractExecutionMetrics(execution)
                        const flowId = execution?.agentflow?.id
                        return {
                            ...execution,
                            _metrics: metrics,
                            _flowName: flowNameById.get(flowId) || execution?.agentflow?.name || '-'
                        }
                    })
                    .sort((a, b) => new Date(b.createdDate).getTime() - new Date(a.createdDate).getTime())

                const successful = normalizedExecutions.filter((row) => SUCCESS_STATES.has(String(row.state || row.status || '').toUpperCase())).length
                const failed = normalizedExecutions.filter((row) => FAILURE_STATES.has(String(row.state || row.status || '').toUpperCase())).length
                const concluded = successful + failed

                setMetrics({
                    totalAgents: assistants.length,
                    totalWorkflows: Number(usageData.total_flows || chatflows.length + agentflows.length),
                    executionsToday: Number(usageData.executions_today || 0),
                    successRate: concluded > 0 ? Math.round((successful / concluded) * 100) : 0,
                    tokenUsage: Number(usageData.monthly_tokens_used || 0),
                    errorRate: concluded > 0 ? Math.round((failed / concluded) * 100) : 0
                })

                setRecentExecutions(normalizedExecutions.slice(0, 10))

                const usageRows = Array.isArray(usageData.daily_usage) ? usageData.daily_usage : []
                const usageChartRows = usageRows.map((row) => ({
                    date: row.date,
                    label: moment(row.date).format('MMM D'),
                    executions: Number(row.executions || 0),
                    tokens: Number(row.tokens_used || 0)
                }))
                setDailyUsage(usageChartRows)

                const failureMap = normalizedExecutions.reduce((acc, row) => {
                    const state = String(row.state || row.status || 'UNKNOWN').toUpperCase()
                    if (!FAILURE_STATES.has(state)) return acc
                    acc[state] = (acc[state] || 0) + 1
                    return acc
                }, {})
                const failureRows = Object.entries(failureMap).map(([name, value]) => ({ name, value }))
                setFailureDistribution(failureRows)

                const agentMap = normalizedExecutions.reduce((acc, row) => {
                    const name = row._flowName || '-'
                    acc[name] = (acc[name] || 0) + 1
                    return acc
                }, {})
                const topAgentRows = Object.entries(agentMap)
                    .map(([name, runs]) => ({ name, runs }))
                    .sort((a, b) => b.runs - a.runs)
                    .slice(0, 5)
                setTopAgents(topAgentRows)

                const readyData = readyResp?.data || {}
                setHealth({
                    status: normalizeStatusValue(readyData.status),
                    checks: readyData.checks || {}
                })
            } catch (e) {
                setError(e)
            } finally {
                setLoading(false)
            }
        }

        load()
    }, [])

    const healthServices = useMemo(
        () => [
            { name: 'Database', status: findServiceStatus(health.checks, ['database', 'db', 'postgres', 'postgresql']) },
            { name: 'Redis', status: findServiceStatus(health.checks, ['redis']) },
            { name: 'Vector Database', status: findServiceStatus(health.checks, ['vector_db', 'vector', 'qdrant', 'pinecone', 'weaviate']) },
            { name: 'LLM Provider', status: findServiceStatus(health.checks, ['llm_provider', 'llm', 'openai', 'anthropic', 'azure']) },
            { name: 'Worker Service', status: findServiceStatus(health.checks, ['worker', 'workers', 'queue_worker', 'execution_worker']) }
        ],
        [health.checks]
    )

    const quickActions = useMemo(
        () => [
            {
                label: 'Create Agent',
                description: 'Open assistants workspace',
                icon: IconPlus,
                route: '/assistants',
                permission: 'assistants:create'
            },
            {
                label: 'Create Workflow',
                description: 'Open flow builder',
                icon: IconHierarchy,
                route: '/agentflows',
                permission: 'agentflows:create,chatflows:create'
            },
            {
                label: 'Upload Document',
                description: 'Manage document stores',
                icon: IconUpload,
                route: '/document-stores',
                permission: 'documentStores:create'
            },
            {
                label: 'Run Agent',
                description: 'Open executions monitor',
                icon: IconPlayerPlay,
                route: '/executions',
                permission: 'executions:view'
            }
        ],
        []
    )

    if (error) {
        return (
            <MainCard>
                <ErrorBoundary error={error} />
            </MainCard>
        )
    }

    return (
        <MainCard>
            <Stack sx={{ gap: 3 }}>
                <ViewHeader title='Dashboard' description='System overview, trends, quick actions, and service health' />

                <Box
                    sx={{
                        display: 'grid',
                        gridTemplateColumns: {
                            xs: '1fr',
                            sm: 'repeat(2, minmax(0, 1fr))',
                            lg: 'repeat(6, minmax(0, 1fr))'
                        },
                        gap: 2
                    }}
                >
                    <MetricCard
                        title='Total Agents'
                        value={isLoading ? <Skeleton width={72} /> : formatNumber(metrics.totalAgents)}
                        subtitle='Configured assistants'
                        icon={IconRobot}
                    />
                    <MetricCard
                        title='Total Workflows'
                        value={isLoading ? <Skeleton width={72} /> : formatNumber(metrics.totalWorkflows)}
                        subtitle='Chatflows + agentflows'
                        icon={IconHierarchy}
                    />
                    <MetricCard
                        title='Executions Today'
                        value={isLoading ? <Skeleton width={72} /> : formatNumber(metrics.executionsToday)}
                        subtitle='Runs started today'
                        icon={IconClock}
                    />
                    <MetricCard
                        title='Success Rate'
                        value={isLoading ? <Skeleton width={72} /> : `${metrics.successRate}%`}
                        subtitle='Based on recent completed runs'
                        icon={IconCircleCheck}
                        iconColor={theme.palette.success.main}
                    />
                    <MetricCard
                        title='Token Usage'
                        value={isLoading ? <Skeleton width={72} /> : formatNumber(metrics.tokenUsage)}
                        subtitle='Monthly token consumption'
                        icon={IconCoins}
                    />
                    <MetricCard
                        title='Error Rate'
                        value={isLoading ? <Skeleton width={72} /> : `${metrics.errorRate}%`}
                        subtitle='Recent failed runs'
                        icon={IconAlertTriangle}
                        iconColor={theme.palette.error.main}
                    />
                </Box>

                <Box
                    sx={{
                        display: 'grid',
                        gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, minmax(0, 1fr))' },
                        gap: 2
                    }}
                >
                    <ChartCard title='Execution Trend'>
                        {isLoading ? (
                            <Skeleton variant='rectangular' height={240} />
                        ) : dailyUsage.length === 0 ? (
                            <Typography variant='body2' color='text.secondary'>
                                No execution trend data available.
                            </Typography>
                        ) : (
                            <ResponsiveContainer width='100%' height={240}>
                                <LineChart data={dailyUsage}>
                                    <CartesianGrid stroke={theme.palette.divider} vertical={false} />
                                    <XAxis dataKey='label' axisLine={false} tickLine={false} />
                                    <YAxis allowDecimals={false} axisLine={false} tickLine={false} />
                                    <RechartsTooltip />
                                    <Legend />
                                    <Line type='monotone' dataKey='executions' stroke={theme.palette.primary.main} strokeWidth={2} dot={false} />
                                </LineChart>
                            </ResponsiveContainer>
                        )}
                    </ChartCard>

                    <ChartCard title='Token Usage'>
                        {isLoading ? (
                            <Skeleton variant='rectangular' height={240} />
                        ) : dailyUsage.length === 0 ? (
                            <Typography variant='body2' color='text.secondary'>
                                No token usage data available.
                            </Typography>
                        ) : (
                            <ResponsiveContainer width='100%' height={240}>
                                <BarChart data={dailyUsage}>
                                    <CartesianGrid stroke={theme.palette.divider} vertical={false} />
                                    <XAxis dataKey='label' axisLine={false} tickLine={false} />
                                    <YAxis allowDecimals={false} axisLine={false} tickLine={false} />
                                    <RechartsTooltip />
                                    <Legend />
                                    <Bar dataKey='tokens' fill={theme.palette.secondary.main} radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                    </ChartCard>

                    <ChartCard title='Failure Distribution'>
                        {isLoading ? (
                            <Skeleton variant='rectangular' height={240} />
                        ) : failureDistribution.length === 0 ? (
                            <Typography variant='body2' color='text.secondary'>
                                No failed executions found in the current window.
                            </Typography>
                        ) : (
                            <ResponsiveContainer width='100%' height={240}>
                                <PieChart>
                                    <Pie data={failureDistribution} dataKey='value' nameKey='name' cx='50%' cy='50%' outerRadius={82} label>
                                        {failureDistribution.map((item, index) => (
                                            <Cell key={item.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Legend />
                                    <RechartsTooltip />
                                </PieChart>
                            </ResponsiveContainer>
                        )}
                    </ChartCard>

                    <ChartCard title='Top Agents'>
                        {isLoading ? (
                            <Skeleton variant='rectangular' height={240} />
                        ) : topAgents.length === 0 ? (
                            <Typography variant='body2' color='text.secondary'>
                                No execution data available for agent ranking.
                            </Typography>
                        ) : (
                            <ResponsiveContainer width='100%' height={240}>
                                <BarChart data={topAgents} layout='vertical' margin={{ left: 30 }}>
                                    <CartesianGrid stroke={theme.palette.divider} vertical={false} />
                                    <XAxis type='number' allowDecimals={false} axisLine={false} tickLine={false} />
                                    <YAxis type='category' dataKey='name' width={160} axisLine={false} tickLine={false} />
                                    <RechartsTooltip />
                                    <Legend />
                                    <Bar dataKey='runs' fill={theme.palette.primary.main} radius={[4, 4, 4, 4]} />
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                    </ChartCard>
                </Box>

                <Paper sx={{ borderRadius: 2, p: 2 }}>
                    <Typography variant='h4' sx={{ mb: 1.5 }}>
                        Quick Actions
                    </Typography>
                    <Box
                        sx={{
                            display: 'grid',
                            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(4, minmax(0, 1fr))' },
                            gap: 1.5
                        }}
                    >
                        {quickActions.map((action) => {
                            const ActionIcon = action.icon
                            const allowed = hasPermission(action.permission)

                            return (
                                <Button
                                    key={action.label}
                                    variant='outlined'
                                    startIcon={<ActionIcon size={16} />}
                                    onClick={() => {
                                        navigate(action.route)
                                    }}
                                    disabled={!allowed}
                                    sx={{ justifyContent: 'flex-start', py: 2, borderColor: theme.palette.divider }}
                                >
                                    <Stack alignItems='flex-start' spacing={0.2}>
                                        <Typography variant='body2' sx={{ fontWeight: 600 }}>
                                            {action.label}
                                        </Typography>
                                        <Typography variant='caption' color='text.secondary'>
                                            {action.description}
                                        </Typography>
                                    </Stack>
                                </Button>
                            )
                        })}
                    </Box>
                </Paper>

                <Paper sx={{ borderRadius: 2, p: 2 }}>
                    <Stack direction='row' alignItems='center' justifyContent='space-between' sx={{ mb: 1.5 }}>
                        <Typography variant='h4'>System Health</Typography>
                        <Chip label={String(health.status || 'unknown').toUpperCase()} color={getStatusChipColor(health.status)} size='small' />
                    </Stack>
                    <Box
                        sx={{
                            display: 'grid',
                            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(5, minmax(0, 1fr))' },
                            gap: 1
                        }}
                    >
                        {healthServices.map((service) => (
                            <Paper key={service.name} variant='outlined' sx={{ p: 1.25, borderRadius: 1.5 }}>
                                <Stack direction='row' justifyContent='space-between' alignItems='center'>
                                    <Typography variant='caption' color='text.secondary'>
                                        {service.name}
                                    </Typography>
                                    <Chip
                                        size='small'
                                        label={service.status.toUpperCase()}
                                        color={getStatusChipColor(service.status)}
                                        variant='filled'
                                    />
                                </Stack>
                            </Paper>
                        ))}
                    </Box>
                </Paper>

                <Paper sx={{ borderRadius: 2, p: 2 }}>
                    <Typography variant='h4' sx={{ mb: 1.5 }}>
                        Recent Executions
                    </Typography>
                    <Table size='small'>
                        <TableHead>
                            <TableRow>
                                <TableCell>Run ID</TableCell>
                                <TableCell>Flow/Agent Name</TableCell>
                                <TableCell>Status</TableCell>
                                <TableCell>Duration</TableCell>
                                <TableCell>Token Usage</TableCell>
                                <TableCell>Timestamp</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {isLoading ? (
                                [...Array(4)].map((_, index) => (
                                    <TableRow key={`loading-row-${index}`}>
                                        {[...Array(6)].map((__, cellIndex) => (
                                            <TableCell key={`loading-cell-${cellIndex}`}>
                                                <Skeleton width='90%' />
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                ))
                            ) : recentExecutions.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6}>No recent executions</TableCell>
                                </TableRow>
                            ) : (
                                recentExecutions.map((execution) => (
                                    <TableRow key={execution.id}>
                                        <TableCell>{execution.id}</TableCell>
                                        <TableCell>{execution._flowName}</TableCell>
                                        <TableCell>
                                            <Chip size='small' label={String(execution.state || '-').toUpperCase()} color={getExecutionStateChipColor(execution.state)} />
                                        </TableCell>
                                        <TableCell>{formatNumber(execution._metrics.executionTimeMs)} ms</TableCell>
                                        <TableCell>{formatNumber(execution._metrics.tokensUsed)}</TableCell>
                                        <TableCell>{moment(execution.createdDate).format('MMM D, YYYY h:mm A')}</TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </Paper>
            </Stack>
        </MainCard>
    )
}

export default Dashboard
