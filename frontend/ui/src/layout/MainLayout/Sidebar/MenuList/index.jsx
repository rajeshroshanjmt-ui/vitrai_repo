import PropTypes from 'prop-types'
import { useEffect, useMemo, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'

// material-ui
import { Box, IconButton, InputAdornment, OutlinedInput, Tooltip, Typography, useMediaQuery } from '@mui/material'
import { useTheme } from '@mui/material/styles'

// project imports
import NavGroup from './NavGroup'
import { menuItems } from '@/menu-items'
import { getMenuChildren } from './menuUtils'
import { SET_SIDEBAR_COLLAPSED } from '@/store/actions'

// APIs
import apiKeyApi from '@/api/apikey'
import assistantsApi from '@/api/assistants'
import chatflowsApi from '@/api/chatflows'
import credentialsApi from '@/api/credentials'
import datasetApi from '@/api/dataset'
import documentstoreApi from '@/api/documentstore'
import executionsApi from '@/api/executions'
import toolsApi from '@/api/tools'
import variablesApi from '@/api/variables'

// icons
import { IconChevronsLeft, IconChevronsRight, IconSearch, IconX } from '@tabler/icons-react'

const toCount = (response) => {
    if (!response) return 0
    const payload = response.data

    if (typeof payload?.total === 'number') return payload.total
    if (Array.isArray(payload?.data)) return payload.data.length
    if (Array.isArray(payload)) return payload.length

    return 0
}

const getSettledCount = (result) => {
    if (result?.status !== 'fulfilled') return 0
    return toCount(result.value)
}

const loadMenuBadgeCounts = async () => {
    const requests = await Promise.allSettled([
        chatflowsApi.getAllChatflows({ limit: 500 }),
        chatflowsApi.getAllAgentflows('AGENTFLOW', { limit: 500 }),
        assistantsApi.getAllAssistants('CUSTOM'),
        executionsApi.getAllExecutions({ page: 1, limit: 1 }),
        toolsApi.getAllTools({ page: 1, limit: 1 }),
        documentstoreApi.getAllDocumentStores({ page: 1, limit: 1 }),
        datasetApi.getAllDatasets({ page: 1, limit: 1 }),
        credentialsApi.getAllCredentials(),
        variablesApi.getAllVariables({ page: 1, limit: 1 }),
        apiKeyApi.getAllAPIKeys({ page: 1, limit: 1 })
    ])

    return {
        chatflows: getSettledCount(requests[0]),
        agentflows: getSettledCount(requests[1]),
        assistants: getSettledCount(requests[2]),
        executions: getSettledCount(requests[3]),
        tools: getSettledCount(requests[4]),
        'document-stores': getSettledCount(requests[5]),
        datasets: getSettledCount(requests[6]),
        credentials: getSettledCount(requests[7]),
        variables: getSettledCount(requests[8]),
        apikey: getSettledCount(requests[9])
    }
}

const applyBadgeCounts = (node, badgeCounts) => {
    if (!node) return null
    const children = getMenuChildren(node).map((child) => applyBadgeCounts(child, badgeCounts))
    const badgeCount = Number(badgeCounts[node.id])

    return {
        ...node,
        ...(Number.isFinite(badgeCount) && badgeCount > 0 ? { badgeCount } : {}),
        ...(children.length > 0 ? { children } : {})
    }
}

const filterMenuTree = (node, normalizedQuery) => {
    if (!node) return null
    if (!normalizedQuery) return node

    const title = String(node.title || '').toLowerCase()
    const titleMatch = title.includes(normalizedQuery)
    const children = getMenuChildren(node)
        .map((child) => filterMenuTree(child, normalizedQuery))
        .filter(Boolean)

    if (node.type === 'item') {
        return titleMatch ? node : null
    }

    if (children.length > 0 || titleMatch) {
        return { ...node, children }
    }

    return null
}

// ==============================|| SIDEBAR MENU LIST ||============================== //

const MenuList = ({ isCollapsed = false }) => {
    const theme = useTheme()
    const dispatch = useDispatch()
    const isDesktop = useMediaQuery(theme.breakpoints.up('md'))
    const isAuthenticated = useSelector((state) => state.auth.isAuthenticated)
    const isSidebarCollapsed = useSelector((state) => state.customization.isSidebarCollapsed)
    const [searchValue, setSearchValue] = useState('')
    const [badgeCounts, setBadgeCounts] = useState({})
    const normalizedSearch = searchValue.trim().toLowerCase()

    useEffect(() => {
        if (isCollapsed && searchValue) {
            setSearchValue('')
        }
    }, [isCollapsed, searchValue])

    useEffect(() => {
        let isMounted = true
        if (!isAuthenticated) return () => {}

        const loadCounts = async () => {
            const counts = await loadMenuBadgeCounts()
            if (isMounted) setBadgeCounts(counts)
        }

        loadCounts()
        const intervalId = window.setInterval(loadCounts, 60000)

        return () => {
            isMounted = false
            window.clearInterval(intervalId)
        }
    }, [isAuthenticated])

    const itemsWithBadges = useMemo(() => menuItems.items.map((item) => applyBadgeCounts(item, badgeCounts)), [badgeCounts])

    const filteredItems = useMemo(
        () => itemsWithBadges.map((item) => filterMenuTree(item, normalizedSearch)).filter(Boolean),
        [itemsWithBadges, normalizedSearch]
    )

    const navItems = filteredItems.map((item) => {
        switch (item.type) {
            case 'group':
                return <NavGroup key={item.id} item={item} isCollapsed={isCollapsed} />
            default:
                return (
                    <Typography key={item.id} variant='h6' color='error' align='center'>
                        Menu Items Error
                    </Typography>
                )
        }
    })

    const handleToggleSidebarCollapsed = () => {
        if (!isDesktop) return
        const nextCollapsed = !isSidebarCollapsed
        localStorage.setItem('isSidebarCollapsed', String(nextCollapsed))
        dispatch({ type: SET_SIDEBAR_COLLAPSED, isSidebarCollapsed: nextCollapsed })
    }

    return (
        <Box>
            <Box sx={{ px: isCollapsed ? 1 : 2, pt: 2, pb: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, justifyContent: isCollapsed ? 'center' : 'space-between' }}>
                    {!isCollapsed && (
                        <OutlinedInput
                            fullWidth
                            size='small'
                            value={searchValue}
                            onChange={(event) => setSearchValue(event.target.value)}
                            placeholder='Search menu'
                            startAdornment={
                                <InputAdornment position='start'>
                                    <IconSearch size={16} />
                                </InputAdornment>
                            }
                            endAdornment={
                                searchValue ? (
                                    <InputAdornment position='end'>
                                        <IconX size={16} style={{ cursor: 'pointer' }} onClick={() => setSearchValue('')} />
                                    </InputAdornment>
                                ) : null
                            }
                        />
                    )}
                    {isDesktop && (
                        <Tooltip title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'} placement='right'>
                            <IconButton size='small' onClick={handleToggleSidebarCollapsed}>
                                {isCollapsed ? <IconChevronsRight size={16} /> : <IconChevronsLeft size={16} />}
                            </IconButton>
                        </Tooltip>
                    )}
                </Box>
            </Box>
            {navItems.length === 0 ? (
                <Typography variant='caption' color='text.secondary' sx={{ px: 3, py: 2, display: 'block' }}>
                    No menu results
                </Typography>
            ) : (
                navItems
            )}
        </Box>
    )
}

MenuList.propTypes = {
    isCollapsed: PropTypes.bool
}

export default MenuList
