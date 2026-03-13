import { useState } from 'react'
import PropTypes from 'prop-types'
import { useSelector } from 'react-redux'
import moment from 'moment'
import { styled } from '@mui/material/styles'
import {
    Box,
    Paper,
    Skeleton,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TableSortLabel,
    useTheme,
    Checkbox,
    IconButton,
    Tooltip,
    Typography
} from '@mui/material'
import { tableCellClasses } from '@mui/material/TableCell'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import StopCircleIcon from '@mui/icons-material/StopCircle'
import ErrorIcon from '@mui/icons-material/Error'
import { IconLoader, IconCircleXFilled, IconExternalLink } from '@tabler/icons-react'

const StyledTableCell = styled(TableCell)(({ theme }) => ({
    borderColor: theme.palette.grey[900] + 25,

    [`&.${tableCellClasses.head}`]: {
        color: theme.palette.grey[900]
    },
    [`&.${tableCellClasses.body}`]: {
        fontSize: 14,
        height: 64
    }
}))

const StyledTableRow = styled(TableRow)(() => ({
    // hide last border
    '&:last-child td, &:last-child th': {
        border: 0
    }
}))

const getIconFromStatus = (state, theme) => {
    switch (state) {
        case 'FINISHED':
            return CheckCircleIcon
        case 'ERROR':
        case 'TIMEOUT':
            return ErrorIcon
        case 'TERMINATED':
            // eslint-disable-next-line react/display-name
            return (props) => {
                const IconWrapper = (props) => <IconCircleXFilled {...props} color={theme.palette.error.main} />
                IconWrapper.displayName = 'TerminatedIcon'
                return <IconWrapper {...props} />
            }
        case 'STOPPED':
            return StopCircleIcon
        case 'INPROGRESS':
            // eslint-disable-next-line react/display-name
            return (props) => {
                const IconWrapper = (props) => (
                    // eslint-disable-next-line
                    <IconLoader {...props} color={theme.palette.warning.dark} className={`spin-animation ${props.className || ''}`} />
                )
                IconWrapper.displayName = 'InProgressIcon'
                return <IconWrapper {...props} />
            }
    }
}

const getIconColor = (state) => {
    switch (state) {
        case 'FINISHED':
            return 'success.dark'
        case 'ERROR':
        case 'TIMEOUT':
            return 'error.main'
        case 'TERMINATED':
        case 'STOPPED':
            return 'error.main'
        case 'INPROGRESS':
            return 'warning.main'
    }
}

export const ExecutionsListTable = ({ data, isLoading, onExecutionRowClick, onSelectionChange, onViewDetails }) => {
    const theme = useTheme()
    const customization = useSelector((state) => state.customization)

    const localStorageKeyOrder = 'executions_order'
    const localStorageKeyOrderBy = 'executions_orderBy'

    const [order, setOrder] = useState(localStorage.getItem(localStorageKeyOrder) || 'desc')
    const [orderBy, setOrderBy] = useState(localStorage.getItem(localStorageKeyOrderBy) || 'updatedDate')
    const [selected, setSelected] = useState([])

    const handleRequestSort = (property) => {
        const isAsc = orderBy === property && order === 'asc'
        const newOrder = isAsc ? 'desc' : 'asc'
        setOrder(newOrder)
        setOrderBy(property)
        localStorage.setItem(localStorageKeyOrder, newOrder)
        localStorage.setItem(localStorageKeyOrderBy, property)
    }

    const handleSelectAllClick = (event) => {
        if (event.target.checked) {
            const newSelected = data.map((n) => n.id)
            setSelected(newSelected)
            onSelectionChange && onSelectionChange(newSelected)
        } else {
            setSelected([])
            onSelectionChange && onSelectionChange([])
        }
    }

    const handleClick = (event, id) => {
        event.stopPropagation()
        const selectedIndex = selected.indexOf(id)
        let newSelected = []

        if (selectedIndex === -1) {
            newSelected = newSelected.concat(selected, id)
        } else if (selectedIndex === 0) {
            newSelected = newSelected.concat(selected.slice(1))
        } else if (selectedIndex === selected.length - 1) {
            newSelected = newSelected.concat(selected.slice(0, -1))
        } else if (selectedIndex > 0) {
            newSelected = newSelected.concat(selected.slice(0, selectedIndex), selected.slice(selectedIndex + 1))
        }

        setSelected(newSelected)
        onSelectionChange && onSelectionChange(newSelected)
    }

    const isSelected = (id) => selected.indexOf(id) !== -1

    const sortedData = data
        ? [...data].sort((a, b) => {
              if (orderBy === 'name') {
                  return order === 'asc' ? (a.name || '').localeCompare(b.name || '') : (b.name || '').localeCompare(a.name || '')
              } else if (orderBy === 'updatedDate') {
                  return order === 'asc'
                      ? new Date(a.updatedDate) - new Date(b.updatedDate)
                      : new Date(b.updatedDate) - new Date(a.updatedDate)
              } else if (orderBy === 'createdDate') {
                  return order === 'asc'
                      ? new Date(a.createdDate) - new Date(b.createdDate)
                      : new Date(b.createdDate) - new Date(a.createdDate)
              } else if (orderBy === 'tokensUsed') {
                  return order === 'asc'
                      ? (a?._metrics?.tokensUsed || 0) - (b?._metrics?.tokensUsed || 0)
                      : (b?._metrics?.tokensUsed || 0) - (a?._metrics?.tokensUsed || 0)
              } else if (orderBy === 'durationMs') {
                  return order === 'asc'
                      ? (a?._metrics?.durationMs || 0) - (b?._metrics?.durationMs || 0)
                      : (b?._metrics?.durationMs || 0) - (a?._metrics?.durationMs || 0)
              }
              return 0
          })
        : []

    return (
        <>
            <TableContainer sx={{ border: 1, borderColor: theme.palette.grey[900] + 25, borderRadius: 2 }} component={Paper}>
                <Table sx={{ minWidth: 650 }} size='small' aria-label='a dense table'>
                    <TableHead
                        sx={{
                            backgroundColor: customization.isDarkMode ? theme.palette.common.black : theme.palette.grey[100],
                            height: 56
                        }}
                    >
                        <TableRow>
                            <StyledTableCell padding='checkbox'>
                                <Checkbox
                                    color='primary'
                                    indeterminate={selected.length > 0 && selected.length < data.length}
                                    checked={data.length > 0 && selected.length === data.length}
                                    onChange={handleSelectAllClick}
                                    inputProps={{
                                        'aria-label': 'select all executions'
                                    }}
                                />
                            </StyledTableCell>
                            <StyledTableCell>Status</StyledTableCell>
                            <StyledTableCell>
                                <TableSortLabel
                                    active={orderBy === 'durationMs'}
                                    direction={order}
                                    onClick={() => handleRequestSort('durationMs')}
                                >
                                    Duration
                                </TableSortLabel>
                            </StyledTableCell>
                            <StyledTableCell>
                                <TableSortLabel
                                    active={orderBy === 'tokensUsed'}
                                    direction={order}
                                    onClick={() => handleRequestSort('tokensUsed')}
                                >
                                    Tokens
                                </TableSortLabel>
                            </StyledTableCell>
                            <StyledTableCell>
                                <TableSortLabel
                                    active={orderBy === 'updatedDate'}
                                    direction={order}
                                    onClick={() => handleRequestSort('updatedDate')}
                                >
                                    Last Updated
                                </TableSortLabel>
                            </StyledTableCell>
                            <StyledTableCell component='th' scope='row'>
                                <TableSortLabel active={orderBy === 'name'} direction={order} onClick={() => handleRequestSort('name')}>
                                    Agentflow
                                </TableSortLabel>
                            </StyledTableCell>
                            <StyledTableCell>Session</StyledTableCell>
                            <StyledTableCell>Error</StyledTableCell>
                            <StyledTableCell>
                                <TableSortLabel
                                    active={orderBy === 'createdDate'}
                                    direction={order}
                                    onClick={() => handleRequestSort('createdDate')}
                                >
                                    Created
                                </TableSortLabel>
                            </StyledTableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {isLoading ? (
                            <>
                                {[0, 1].map((skeletonRow) => (
                                    <StyledTableRow key={`skeleton-${skeletonRow}`}>
                                        {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((cell) => (
                                            <StyledTableCell key={`skeleton-${skeletonRow}-${cell}`} padding={cell === 0 ? 'checkbox' : undefined}>
                                                <Skeleton variant='text' />
                                            </StyledTableCell>
                                        ))}
                                    </StyledTableRow>
                                ))}
                            </>
                        ) : (
                            <>
                                {sortedData.map((row, index) => {
                                    const isItemSelected = isSelected(row.id)
                                    const labelId = `enhanced-table-checkbox-${index}`

                                    return (
                                        <StyledTableRow
                                            hover
                                            key={index}
                                            sx={{ cursor: 'pointer', '&:last-child td, &:last-child th': { border: 0 } }}
                                        >
                                            <StyledTableCell padding='checkbox'>
                                                <Checkbox
                                                    color='primary'
                                                    checked={isItemSelected}
                                                    onClick={(event) => handleClick(event, row.id)}
                                                    inputProps={{
                                                        'aria-labelledby': labelId
                                                    }}
                                                />
                                            </StyledTableCell>
                                            <StyledTableCell onClick={() => onExecutionRowClick(row)}>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                    <Box
                                                        component={getIconFromStatus(row.state, theme)}
                                                        className='labelIcon'
                                                        color={getIconColor(row.state)}
                                                    />
                                                    <Typography variant='body2'>{String(row.state || '').toUpperCase()}</Typography>
                                                </Box>
                                            </StyledTableCell>
                                            <StyledTableCell onClick={() => onExecutionRowClick(row)}>
                                                {(row?._metrics?.durationMs || 0).toLocaleString()} ms
                                            </StyledTableCell>
                                            <StyledTableCell onClick={() => onExecutionRowClick(row)}>
                                                {(row?._metrics?.tokensUsed || 0).toLocaleString()}
                                            </StyledTableCell>
                                            <StyledTableCell onClick={() => onExecutionRowClick(row)}>
                                                {moment(row.updatedDate).format('MMM D, YYYY h:mm A')}
                                            </StyledTableCell>
                                            <StyledTableCell onClick={() => onExecutionRowClick(row)}>
                                                {row.agentflow?.name}
                                            </StyledTableCell>
                                            <StyledTableCell onClick={() => onExecutionRowClick(row)}>{row.sessionId}</StyledTableCell>
                                            <StyledTableCell onClick={() => onExecutionRowClick(row)}>
                                                {row?._metrics?.firstError ? (
                                                    <Typography
                                                        variant='caption'
                                                        color='error.main'
                                                        sx={{
                                                            display: 'inline-block',
                                                            maxWidth: 220,
                                                            whiteSpace: 'nowrap',
                                                            overflow: 'hidden',
                                                            textOverflow: 'ellipsis'
                                                        }}
                                                        title={row._metrics.firstError}
                                                    >
                                                        {row._metrics.firstError}
                                                    </Typography>
                                                ) : (
                                                    '-'
                                                )}
                                            </StyledTableCell>
                                            <StyledTableCell onClick={() => onExecutionRowClick(row)}>
                                                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                                                    <Typography variant='body2'>{moment(row.createdDate).format('MMM D, YYYY h:mm A')}</Typography>
                                                    {onViewDetails && (
                                                        <Tooltip title='Open detail page'>
                                                            <IconButton
                                                                size='small'
                                                                onClick={(event) => {
                                                                    event.stopPropagation()
                                                                    onViewDetails(row)
                                                                }}
                                                            >
                                                                <IconExternalLink size={15} />
                                                            </IconButton>
                                                        </Tooltip>
                                                    )}
                                                </Box>
                                            </StyledTableCell>
                                        </StyledTableRow>
                                    )
                                })}
                            </>
                        )}
                    </TableBody>
                </Table>
            </TableContainer>
        </>
    )
}

ExecutionsListTable.propTypes = {
    data: PropTypes.array,
    isLoading: PropTypes.bool,
    onExecutionRowClick: PropTypes.func,
    onSelectionChange: PropTypes.func,
    onViewDetails: PropTypes.func,
    className: PropTypes.string
}

ExecutionsListTable.displayName = 'ExecutionsListTable'
