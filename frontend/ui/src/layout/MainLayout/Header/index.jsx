import PropTypes from 'prop-types'
import { useSelector, useDispatch } from 'react-redux'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

// material-ui
import { Badge, Button, Avatar, Box, ButtonBase, IconButton, Menu, MenuItem, Switch, Tooltip, Typography, Chip } from '@mui/material'
import { useTheme, styled, darken, alpha } from '@mui/material/styles'

// project imports
import LogoSection from '../LogoSection'
import ProfileSection from './ProfileSection'
import WorkspaceSwitcher from '@/layout/MainLayout/Header/WorkspaceSwitcher'
import OrgWorkspaceBreadcrumbs from '@/layout/MainLayout/Header/OrgWorkspaceBreadcrumbs'
import PricingDialog from '@/ui-component/subscription/PricingDialog'
import CommandPaletteDialog from './CommandPaletteDialog'

// assets
import { IconBell, IconCommand, IconMenu2, IconX, IconSparkles } from '@tabler/icons-react'

// store
import { store } from '@/store'
import { SET_DARKMODE } from '@/store/actions'
import { useConfig } from '@/store/context/ConfigContext'
import { enqueueSnackbar as enqueueSnackbarAction, closeSnackbar as closeSnackbarAction } from '@/store/actions'
import { logoutSuccess } from '@/store/reducers/authSlice'

// API
import accountApi from '@/api/account.api'

// Hooks
import useApi from '@/hooks/useApi'
import useNotifier from '@/utils/useNotifier'

// ==============================|| MAIN NAVBAR / HEADER ||============================== //

const MaterialUISwitch = styled(Switch)(({ theme }) => ({
    width: 62,
    height: 34,
    padding: 7,
    '& .MuiSwitch-switchBase': {
        margin: 1,
        padding: 0,
        transform: 'translateX(6px)',
        '&.Mui-checked': {
            color: '#fff',
            transform: 'translateX(22px)',
            '& .MuiSwitch-thumb:before': {
                backgroundImage: `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" height="20" width="20" viewBox="0 0 20 20"><path fill="${encodeURIComponent(
                    '#fff'
                )}" d="M4.2 2.5l-.7 1.8-1.8.7 1.8.7.7 1.8.6-1.8L6.7 5l-1.9-.7-.6-1.8zm15 8.3a6.7 6.7 0 11-6.6-6.6 5.8 5.8 0 006.6 6.6z"/></svg>')`
            },
            '& + .MuiSwitch-track': {
                opacity: 1,
                backgroundColor:
                    theme.palette.mode === 'dark' ? alpha(theme.palette.brand.main, 0.42) : alpha(theme.palette.brand.main, 0.34)
            }
        }
    },
    '& .MuiSwitch-thumb': {
        backgroundColor: theme.palette.mode === 'dark' ? theme.palette.brand.dark : theme.palette.brand.main,
        width: 32,
        height: 32,
        '&:before': {
            content: "''",
            position: 'absolute',
            width: '100%',
            height: '100%',
            left: 0,
            top: 0,
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'center',
            backgroundImage: `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" height="20" width="20" viewBox="0 0 20 20"><path fill="${encodeURIComponent(
                '#fff'
            )}" d="M9.305 1.667V3.75h1.389V1.667h-1.39zm-4.707 1.95l-.982.982L5.09 6.072l.982-.982-1.473-1.473zm10.802 0L13.927 5.09l.982.982 1.473-1.473-.982-.982zM10 5.139a4.872 4.872 0 00-4.862 4.86A4.872 4.872 0 0010 14.862 4.872 4.872 0 0014.86 10 4.872 4.872 0 0010 5.139zm0 1.389A3.462 3.462 0 0113.471 10a3.462 3.462 0 01-3.473 3.472A3.462 3.462 0 016.527 10 3.462 3.462 0 0110 6.528zM1.665 9.305v1.39h2.083v-1.39H1.666zm14.583 0v1.39h2.084v-1.39h-2.084zM5.09 13.928L3.616 15.4l.982.982 1.473-1.473-.982-.982zm9.82 0l-.982.982 1.473 1.473.982-.982-1.473-1.473zM9.305 16.25v2.083h1.389V16.25h-1.39z"/></svg>')`
        }
    },
    '& .MuiSwitch-track': {
        opacity: 1,
        backgroundColor: theme.palette.mode === 'dark' ? alpha(theme.palette.brand.main, 0.3) : alpha(theme.palette.brand.main, 0.26),
        borderRadius: 20 / 2
    }
}))

const Header = ({ handleLeftDrawerToggle }) => {
    const theme = useTheme()
    const navigate = useNavigate()

    const customization = useSelector((state) => state.customization)
    const logoutApi = useApi(accountApi.logout)

    const [isDark, setIsDark] = useState(customization.isDarkMode)
    const dispatch = useDispatch()
    const { isEnterpriseLicensed, isCloud } = useConfig()
    const currentUser = useSelector((state) => state.auth.user)
    const isAuthenticated = useSelector((state) => state.auth.isAuthenticated)
    const notifications = useSelector((state) => state.notifier.notifications)
    const [isPricingOpen, setIsPricingOpen] = useState(false)
    const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false)
    const [notificationsAnchorEl, setNotificationsAnchorEl] = useState(null)

    const runtimeEnv = String(import.meta.env.VITE_APP_ENV || import.meta.env.MODE || 'development').toUpperCase()
    const visibleNotifications = Array.isArray(notifications) ? notifications : []
    const notificationCount = visibleNotifications.filter((item) => !item.dismissed).length

    useNotifier()

    const enqueueSnackbar = (...args) => dispatch(enqueueSnackbarAction(...args))
    const closeSnackbar = (...args) => dispatch(closeSnackbarAction(...args))

    const changeDarkMode = () => {
        dispatch({ type: SET_DARKMODE, isDarkMode: !isDark })
        setIsDark((isDark) => !isDark)
        localStorage.setItem('isDarkMode', !isDark)
    }

    const signOutClicked = () => {
        logoutApi.request()
        enqueueSnackbar({
            message: 'Logging out...',
            options: {
                key: new Date().getTime() + Math.random(),
                variant: 'success',
                action: (key) => (
                    <Button style={{ color: 'white' }} onClick={() => closeSnackbar(key)}>
                        <IconX />
                    </Button>
                )
            }
        })
    }

    useEffect(() => {
        try {
            if (logoutApi.data && logoutApi.data.message === 'logged_out') {
                store.dispatch(logoutSuccess())
                window.location.href = logoutApi.data.redirectTo
            }
        } catch (e) {
            console.error(e)
        }
    }, [logoutApi.data])

    useEffect(() => {
        const onKeyDown = (event) => {
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
                event.preventDefault()
                setIsCommandPaletteOpen(true)
            }
        }

        document.addEventListener('keydown', onKeyDown)
        return () => document.removeEventListener('keydown', onKeyDown)
    }, [])

    return (
        <>
            <Box
                sx={{
                    width: 228,
                    display: 'flex',
                    [theme.breakpoints.down('md')]: {
                        width: 'auto'
                    }
                }}
            >
                <Box component='span' sx={{ display: { xs: 'none', md: 'block' }, flexGrow: 1 }}>
                    <LogoSection />
                </Box>
                {isAuthenticated && (
                    <ButtonBase sx={{ borderRadius: '8px', overflow: 'hidden' }}>
                        <Avatar
                            variant='rounded'
                            sx={{
                                ...theme.typography.commonAvatar,
                                ...theme.typography.mediumAvatar,
                                transition: 'all .2s ease-in-out',
                                background: 'transparent',
                                border: `1px solid ${theme.palette.divider}`,
                                color: theme.palette.text.primary,
                                '&:hover': {
                                    background: theme.palette.action.hover
                                }
                            }}
                            onClick={handleLeftDrawerToggle}
                            color='inherit'
                        >
                            <IconMenu2 stroke={1.5} size='1.3rem' />
                        </Avatar>
                    </ButtonBase>
                )}
            </Box>
            <Box
                sx={{
                    flexGrow: 1,
                    px: 4,
                    display: 'flex',
                    alignItems: 'center'
                }}
            >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Typography
                        variant='subtitle2'
                        color='text.secondary'
                        sx={{
                            display: { xs: 'none', md: 'block' },
                            fontSize: '0.6875rem',
                            letterSpacing: '0.06em',
                            textTransform: 'uppercase',
                            fontWeight: 600
                        }}
                    >
                        Vetrai AI Orchestration Platform
                    </Typography>
                    <Chip
                        size='small'
                        label={runtimeEnv}
                        color={runtimeEnv === 'PRODUCTION' ? 'error' : 'warning'}
                        variant='outlined'
                        sx={{ height: 20, borderRadius: 1, fontWeight: 700 }}
                    />
                </Box>
            </Box>
            {isEnterpriseLicensed && isAuthenticated && <WorkspaceSwitcher />}
            {isCloud && isAuthenticated && <OrgWorkspaceBreadcrumbs />}
            {isCloud && currentUser?.isOrganizationAdmin && (
                <Button
                    variant='contained'
                    sx={{
                        mr: 1,
                        ml: 2,
                        borderRadius: 14,
                        background: (theme) =>
                            `linear-gradient(110deg, ${theme.palette.brand.main} 5%, ${theme.palette.secondary.main} 100%)`,
                        color: (theme) => theme.palette.secondary.contrastText,
                        boxShadow: (theme) => `0 10px 20px ${theme.palette.glow?.soft || 'rgba(0,0,0,0.16)'}`,
                        transition: 'all 0.3s ease',
                        '&:hover': {
                            background: (theme) =>
                                `linear-gradient(110deg, ${darken(theme.palette.brand.main, 0.1)} 5%, ${darken(
                                    theme.palette.secondary.main,
                                    0.1
                                )} 100%)`,
                            boxShadow: (theme) => `0 14px 26px ${theme.palette.glow?.elevated || 'rgba(0,0,0,0.22)'}`
                        }
                    }}
                    onClick={() => setIsPricingOpen(true)}
                    startIcon={<IconSparkles size={20} />}
                >
                    Upgrade
                </Button>
            )}
            <Tooltip title='Command Palette (Ctrl+K)'>
                <IconButton sx={{ ml: 1 }} color='inherit' onClick={() => setIsCommandPaletteOpen(true)}>
                    <IconCommand size={19} />
                </IconButton>
            </Tooltip>
            <Tooltip title='Notifications'>
                <IconButton sx={{ ml: 0.5 }} color='inherit' onClick={(event) => setNotificationsAnchorEl(event.currentTarget)}>
                    <Badge badgeContent={notificationCount} color='error'>
                        <IconBell size={19} />
                    </Badge>
                </IconButton>
            </Tooltip>
            {isPricingOpen && isCloud && (
                <PricingDialog
                    open={isPricingOpen}
                    onClose={(planUpdated) => {
                        setIsPricingOpen(false)
                        if (planUpdated) {
                            navigate('/')
                            navigate(0)
                        }
                    }}
                />
            )}
            <Menu
                anchorEl={notificationsAnchorEl}
                open={Boolean(notificationsAnchorEl)}
                onClose={() => setNotificationsAnchorEl(null)}
                PaperProps={{ sx: { width: 360, maxHeight: 420 } }}
            >
                {visibleNotifications.length === 0 ? (
                    <MenuItem disabled>No notifications</MenuItem>
                ) : (
                    visibleNotifications
                        .slice(-8)
                        .reverse()
                        .map((item) => (
                            <MenuItem key={item.key} onClick={() => setNotificationsAnchorEl(null)} sx={{ whiteSpace: 'normal' }}>
                                <Box>
                                    <Typography variant='body2'>
                                        {typeof item.message === 'string' ? item.message : 'Notification received'}
                                    </Typography>
                                    <Typography variant='caption' color='text.secondary'>
                                        {item.options?.variant || 'info'}
                                    </Typography>
                                </Box>
                            </MenuItem>
                        ))
                )}
            </Menu>
            <MaterialUISwitch checked={isDark} onChange={changeDarkMode} />
            <Box sx={{ ml: 2 }}></Box>
            <ProfileSection handleLogout={signOutClicked} />
            <CommandPaletteDialog open={isCommandPaletteOpen} onClose={() => setIsCommandPaletteOpen(false)} />
        </>
    )
}

Header.propTypes = {
    handleLeftDrawerToggle: PropTypes.func
}

export default Header
