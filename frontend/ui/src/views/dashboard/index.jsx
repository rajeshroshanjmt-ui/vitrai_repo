import { useEffect, useState } from 'react'
import moment from 'moment'

import { Box, Chip, Paper, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography, useTheme } from '@mui/material'

import MainCard from '@/ui-component/cards/MainCard'
import ViewHeader from '@/layout/MainLayout/ViewHeader'
import chatflowsApi from '@/api/chatflows'
import assistantsApi from '@/api/assistants'
import executionsApi from '@/api/executions'
import client from '@/api/client'
import ErrorBoundary from '@/ErrorBoundary'

const MetricCard = ({ title, value, subtitle }) => {
    const theme = useTheme()

    return (
        <Paper
            sx={{
                borderRadius: 2,
                border: 1,
                borderColor: theme.palette.grey[900] + 25,
                p: 2
            }}
        >
            <Typography variant='caption' color='text.secondary'>
                {title}
            </Typography>
            <Typography variant='h3' sx={{ mt: 0.5 }}>
                {value}
            </Typography>
            <Typography variant='body2' color='text.secondary' sx={{ mt: 0.5 }}>
                {subtitle}
            </Typography>
        </Paper>
    )
}

const Dashboard = () => {
    const [error, setError] = useState(null)
    const [metrics, setMetrics] = useState({
        chatflows: 0,
        agents: 0,
        executionsToday: 0,
        tokenUsage: 0,
        errorRate: 0
    })
    const [recentExecutions, setRecentExecutions] = useState([])
    const [health, setHealth] = useState({
        status: 'unknown',
        checks: {}
    })

    useEffect(() => {
        const load = async () => {
            try {
                const [flows, assistants, executions, usage, ready] = await Promise.all([
                    chatflowsApi.getAllChatflows({ limit: 200 }),
                    assistantsApi.getAllAssistants('CUSTOM'),
                    executionsApi.getAllExecutions({ page: 1, limit: 8 }),
                    client.get('/flows/usage', { params: { days: 7 } }),
                    client.get('/health/ready').catch(() => client.get('/health'))
                ])

                const executionRows = executions?.data?.data || []
                const errorCount = executionRows.filter((row) => row.state === 'ERROR').length

                setMetrics({
                    chatflows: (flows?.data?.data || []).length,
                    agents: (assistants?.data || []).length,
                    executionsToday: Number(usage?.data?.executions_today || executionRows.length),
                    tokenUsage: Number(usage?.data?.monthly_tokens_used || 0),
                    errorRate: executionRows.length ? Math.round((errorCount / executionRows.length) * 100) : 0
                })

                setRecentExecutions(executionRows)

                setHealth({
                    status: ready?.data?.status || 'ok',
                    checks: ready?.data?.checks || { api: 'ok' }
                })
            } catch (e) {
                setError(e)
            }
        }

        load()
    }, [])

    const healthColor = health.status === 'ok' ? 'success' : health.status === 'degraded' ? 'warning' : 'default'

    return (
        <MainCard>
            {error ? (
                <ErrorBoundary error={error} />
            ) : (
                <Stack sx={{ gap: 3 }}>
                    <ViewHeader
                        title='Dashboard'
                        description='System overview, recent executions, token usage, and service health'
                    />

                    <Box
                        sx={{
                            display: 'grid',
                            gridTemplateColumns: {
                                xs: '1fr',
                                sm: 'repeat(2, minmax(0, 1fr))',
                                lg: 'repeat(5, minmax(0, 1fr))'
                            },
                            gap: 2
                        }}
                    >
                        <MetricCard title='Active Chatflows' value={metrics.chatflows} subtitle='Published or draft flows' />
                        <MetricCard title='Active Agents' value={metrics.agents} subtitle='Configured assistants/agents' />
                        <MetricCard title='Executions Today' value={metrics.executionsToday} subtitle='Runs in the current day' />
                        <MetricCard title='Token Usage' value={metrics.tokenUsage} subtitle='Monthly token consumption' />
                        <MetricCard title='Error Rate' value={`${metrics.errorRate}%`} subtitle='Recent execution failures' />
                    </Box>

                    <Paper sx={{ borderRadius: 2, p: 2 }}>
                        <Stack direction='row' alignItems='center' justifyContent='space-between' sx={{ mb: 1.5 }}>
                            <Typography variant='h4'>System Health</Typography>
                            <Chip label={health.status.toUpperCase()} color={healthColor} size='small' />
                        </Stack>
                        <Stack direction='row' spacing={1} flexWrap='wrap'>
                            {Object.keys(health.checks || {}).length === 0 ? (
                                <Typography variant='body2' color='text.secondary'>
                                    No checks available
                                </Typography>
                            ) : (
                                Object.entries(health.checks).map(([name, status]) => (
                                    <Chip
                                        key={name}
                                        size='small'
                                        label={`${name}: ${String(status).toUpperCase()}`}
                                        color={status === 'ok' ? 'success' : 'warning'}
                                        variant='outlined'
                                    />
                                ))
                            )}
                        </Stack>
                    </Paper>

                    <Paper sx={{ borderRadius: 2, p: 2 }}>
                        <Typography variant='h4' sx={{ mb: 1.5 }}>
                            Recent Executions
                        </Typography>
                        <Table size='small'>
                            <TableHead>
                                <TableRow>
                                    <TableCell>Run ID</TableCell>
                                    <TableCell>Flow</TableCell>
                                    <TableCell>Status</TableCell>
                                    <TableCell>Duration</TableCell>
                                    <TableCell>Timestamp</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {recentExecutions.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5}>No recent executions</TableCell>
                                    </TableRow>
                                ) : (
                                    recentExecutions.map((execution) => (
                                        <TableRow key={execution.id}>
                                            <TableCell>{execution.id}</TableCell>
                                            <TableCell>{execution.agentflow?.name || '-'}</TableCell>
                                            <TableCell>{execution.state}</TableCell>
                                            <TableCell>
                                                {execution.executionData
                                                    ? `${JSON.parse(execution.executionData)[0]?.data?.metrics?.execution_time_ms || 0} ms`
                                                    : '-'}
                                            </TableCell>
                                            <TableCell>{moment(execution.createdDate).format('MMM D, YYYY h:mm A')}</TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </Paper>
                </Stack>
            )}
        </MainCard>
    )
}

export default Dashboard
