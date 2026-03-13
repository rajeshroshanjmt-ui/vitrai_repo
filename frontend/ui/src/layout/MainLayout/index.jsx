import { useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Outlet } from 'react-router-dom'

// material-ui
import { styled, useTheme } from '@mui/material/styles'
import { AppBar, Box, CssBaseline, Toolbar, useMediaQuery } from '@mui/material'

// project imports
import Header from './Header'
import Sidebar from './Sidebar'
import { collapsedDrawerWidth, drawerWidth, headerHeight } from '@/store/constant'
import { SET_MENU } from '@/store/actions'

// styles
const Main = styled('main', { shouldForwardProp: (prop) => prop !== 'open' && prop !== 'drawerwidth' })(({ theme, open, drawerwidth }) => ({
    ...theme.typography.mainContent,
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: 'transparent',
    animation: 'main-shell-fade 220ms ease',
    '@keyframes main-shell-fade': {
        from: {
            opacity: 0.72,
            transform: 'translateY(4px)'
        },
        to: {
            opacity: 1,
            transform: 'translateY(0)'
        }
    },
    '&::before': {
        display: 'none'
    },
    ...(!open && {
        borderBottomLeftRadius: 0,
        borderBottomRightRadius: 0,
        transition: theme.transitions.create('all', {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.leavingScreen
        }),
        marginRight: 0,
        [theme.breakpoints.up('md')]: {
            marginLeft: -drawerwidth,
            width: `calc(100% - ${drawerwidth}px)`
        },
        [theme.breakpoints.down('md')]: {
            marginLeft: '20px',
            width: `calc(100% - ${drawerwidth}px)`,
            padding: '16px'
        },
        [theme.breakpoints.down('sm')]: {
            marginLeft: '10px',
            width: `calc(100% - ${drawerwidth}px)`,
            padding: '16px',
            marginRight: '10px'
        }
    }),
    ...(open && {
        transition: theme.transitions.create('all', {
            easing: theme.transitions.easing.easeOut,
            duration: theme.transitions.duration.enteringScreen
        }),
        marginLeft: 0,
        marginRight: 0,
        borderBottomLeftRadius: 0,
        borderBottomRightRadius: 0,
        width: `calc(100% - ${drawerwidth}px)`
    })
}))

// ==============================|| MAIN LAYOUT ||============================== //

const MainLayout = () => {
    const theme = useTheme()
    const matchDownMd = useMediaQuery(theme.breakpoints.down('lg'))

    // Handle left drawer
    const leftDrawerOpened = useSelector((state) => state.customization.opened)
    const isSidebarCollapsed = useSelector((state) => state.customization.isSidebarCollapsed)
    const dispatch = useDispatch()
    const handleLeftDrawerToggle = () => {
        dispatch({ type: SET_MENU, opened: !leftDrawerOpened })
    }

    const effectiveDrawerWidth = matchDownMd ? drawerWidth : isSidebarCollapsed ? collapsedDrawerWidth : drawerWidth

    useEffect(() => {
        setTimeout(() => dispatch({ type: SET_MENU, opened: !matchDownMd }), 0)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [matchDownMd])

    return (
        <Box
            sx={{
                display: 'flex',
                minHeight: '100vh',
                backgroundColor: theme.palette.surface?.base || theme.palette.background.default
            }}
        >
            <CssBaseline />
            {/* header */}
            <AppBar
                enableColorOnDark
                position='fixed'
                color='inherit'
                elevation={0}
                sx={{
                    bgcolor: theme.palette.surface?.raised || theme.palette.background.default,
                    boxShadow: 'none',
                    borderBottom: `1px solid ${theme.palette.divider}`,
                    backdropFilter: 'none',
                    transition: leftDrawerOpened ? theme.transitions.create('width') : 'none'
                }}
            >
                <Toolbar
                    sx={{
                        height: `${headerHeight}px`,
                        px: { xs: 2, md: 3 },
                        boxShadow: 'none',
                        borderBottom: 'none'
                    }}
                >
                    <Header handleLeftDrawerToggle={handleLeftDrawerToggle} />
                </Toolbar>
            </AppBar>

            {/* drawer */}
            <Sidebar drawerOpen={leftDrawerOpened} drawerToggle={handleLeftDrawerToggle} />

            {/* main content */}
            <Main theme={theme} open={leftDrawerOpened} drawerwidth={effectiveDrawerWidth}>
                <Outlet />
            </Main>
        </Box>
    )
}

export default MainLayout
