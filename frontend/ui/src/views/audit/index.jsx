import React, { useEffect, useState } from 'react'
import { useSelector } from 'react-redux'
import moment from 'moment'

// material-ui
import {
    Box,
    Stack,
    Table,
    TableBody,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    useTheme,
    Chip,
    TextField,
    Grid,
    Skeleton,
    TablePagination
} from '@mui/material'

// project imports
import MainCard from '@/ui-component/cards/MainCard'
import ViewHeader from '@/layout/MainLayout/ViewHeader'
import ErrorBoundary from '@/ErrorBoundary'
import { StyledTableCell, StyledTableRow } from '@/ui-component/table/TableStyles'
import { useError } from '@/store/context/ErrorContext'

// API
import auditApi from '@/api/audit'

const getActionColor = (action) => {
    if (action?.includes('deleted')) return 'error'
    if (action?.includes('created') || action?.includes('invited')) return 'success'
    if (action?.includes('changed') || action?.includes('updated')) return 'info'
    if (action?.includes('login')) return 'warning'
    return 'default'
}

const AuditLog = () => {
    const theme = useTheme()
    const [logs, setLogs] = useState([])
    const [isLoading, setIsLoading] = useState(true)
    const [totalCount, setTotalCount] = useState(0)
    const [page, setPage] = useState(0)
    const [pageSize, setPageSize] = useState(10)
    const [filters, setFilters] = useState({
        action: '',
        actor_email: '',
        created_from: '',
        created_to: ''
    })

    const { setError } = useError()

    const fetchLogs = async () => {
        try {
            setIsLoading(true)
            const params = {
                limit: pageSize,
                offset: page * pageSize
            }

            if (filters.action) params.action = filters.action
            if (filters.actor_email) params.actor_email = filters.actor_email
            if (filters.created_from) params.created_from = filters.created_from
            if (filters.created_to) params.created_to = filters.created_to

            const response = await auditApi.getAuditLogs(params)
            setLogs(response?.data?.items || [])
            setTotalCount(response?.data?.total_count || 0)
        } catch (error) {
            setError(error.message)
            console.error('Failed to fetch audit logs:', error)
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        fetchLogs()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page, pageSize, filters.action, filters.actor_email, filters.created_from, filters.created_to])

    const handleFilterChange = (field, value) => {
        setFilters({ ...filters, [field]: value })
        setPage(0) // Reset to first page when filter changes
    }

    const handleApplyFilters = () => {
        setPage(0)
        fetchLogs()
    }

    const handlePageChange = (event, newPage) => {
        setPage(newPage)
    }

    const handlePageSizeChange = (event) => {
        setPageSize(parseInt(event.target.value, 10))
        setPage(0)
    }

    return (
        <>
            <MainCard>
                <Stack flexDirection='column' sx={{ gap: 3 }}>
                    <ViewHeader title='Audit Log' />

                    {/* Filters */}
                    <Grid container spacing={2}>
                        <Grid item xs={12} sm={6} md={3}>
                            <TextField
                                label='Action'
                                value={filters.action}
                                onChange={(e) => handleFilterChange('action', e.target.value)}
                                placeholder='e.g., user.invited'
                                fullWidth
                                size='small'
                            />
                        </Grid>
                        <Grid item xs={12} sm={6} md={3}>
                            <TextField
                                label='Actor Email'
                                value={filters.actor_email}
                                onChange={(e) => handleFilterChange('actor_email', e.target.value)}
                                placeholder='e.g., admin@example.com'
                                fullWidth
                                size='small'
                            />
                        </Grid>
                        <Grid item xs={12} sm={6} md={3}>
                            <TextField
                                label='From Date'
                                type='datetime-local'
                                value={filters.created_from}
                                onChange={(e) => handleFilterChange('created_from', e.target.value)}
                                fullWidth
                                size='small'
                                InputLabelProps={{ shrink: true }}
                            />
                        </Grid>
                        <Grid item xs={12} sm={6} md={3}>
                            <TextField
                                label='To Date'
                                type='datetime-local'
                                value={filters.created_to}
                                onChange={(e) => handleFilterChange('created_to', e.target.value)}
                                fullWidth
                                size='small'
                                InputLabelProps={{ shrink: true }}
                            />
                        </Grid>
                    </Grid>

                    {/* Table */}
                    <Box sx={{ border: 1, borderColor: theme.palette.grey[900] + 25, borderRadius: 2 }}>
                        <TableContainer component={Paper}>
                            <Table sx={{ minWidth: 800 }} aria-label='audit log table'>
                                <TableHead
                                    sx={{
                                        backgroundColor: theme.palette.grey[100],
                                        height: 56
                                    }}
                                >
                                    <TableRow>
                                        <StyledTableCell>Timestamp</StyledTableCell>
                                        <StyledTableCell>Action</StyledTableCell>
                                        <StyledTableCell>Actor</StyledTableCell>
                                        <StyledTableCell>Resource</StyledTableCell>
                                        <StyledTableCell>Details</StyledTableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {isLoading ? (
                                        <>
                                            {[...Array(5)].map((_, idx) => (
                                                <StyledTableRow key={idx}>
                                                    <StyledTableCell>
                                                        <Skeleton variant='text' />
                                                    </StyledTableCell>
                                                    <StyledTableCell>
                                                        <Skeleton variant='text' />
                                                    </StyledTableCell>
                                                    <StyledTableCell>
                                                        <Skeleton variant='text' />
                                                    </StyledTableCell>
                                                    <StyledTableCell>
                                                        <Skeleton variant='text' />
                                                    </StyledTableCell>
                                                    <StyledTableCell>
                                                        <Skeleton variant='text' />
                                                    </StyledTableCell>
                                                </StyledTableRow>
                                            ))}
                                        </>
                                    ) : logs.length === 0 ? (
                                        <StyledTableRow>
                                            <StyledTableCell colSpan={5} align='center' sx={{ py: 3 }}>
                                                No audit logs found
                                            </StyledTableCell>
                                        </StyledTableRow>
                                    ) : (
                                        logs.map((log) => (
                                            <StyledTableRow key={log.id} hover>
                                                <StyledTableCell sx={{ minWidth: 180 }}>
                                                    {moment(log.created_at).format('DD/MM/YYYY HH:mm:ss')}
                                                </StyledTableCell>
                                                <StyledTableCell sx={{ minWidth: 120 }}>
                                                    <Chip
                                                        label={log.action}
                                                        color={getActionColor(log.action)}
                                                        variant='outlined'
                                                        size='small'
                                                    />
                                                </StyledTableCell>
                                                <StyledTableCell sx={{ minWidth: 150 }}>
                                                    {log.actor_email || 'System'}
                                                </StyledTableCell>
                                                <StyledTableCell sx={{ minWidth: 150 }}>
                                                    {log.resource_type}: {log.resource_id ? log.resource_id.substring(0, 8) : 'N/A'}
                                                </StyledTableCell>
                                                <StyledTableCell sx={{ maxWidth: 300, overflow: 'auto' }}>
                                                    <code style={{ fontSize: '0.75rem' }}>
                                                        {JSON.stringify(log.details || {}, null, 1).substring(0, 100)}
                                                        {JSON.stringify(log.details || {}).length > 100 ? '...' : ''}
                                                    </code>
                                                </StyledTableCell>
                                            </StyledTableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </TableContainer>
                        <TablePagination
                            rowsPerPageOptions={[5, 10, 25, 50]}
                            component='div'
                            count={totalCount}
                            rowsPerPage={pageSize}
                            page={page}
                            onPageChange={handlePageChange}
                            onRowsPerPageChange={handlePageSizeChange}
                        />
                    </Box>
                </Stack>
            </MainCard>
        </>
    )
}

export default AuditLog
