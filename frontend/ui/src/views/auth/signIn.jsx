import { useEffect, useMemo, useState } from 'react'
import { useSelector } from 'react-redux'
import { Link, useLocation, useNavigate } from 'react-router-dom'

// material-ui
import { Alert, Box, Button, Divider, Stack, TextField, Typography, useTheme, InputAdornment } from '@mui/material'
import { LoadingButton } from '@mui/lab'
import { alpha } from '@mui/material/styles'
import { IconExclamationCircle, IconLock, IconMail, IconSparkles } from '@tabler/icons-react'

// project imports
import MainCard from '@/ui-component/cards/MainCard'

// Hooks
import useApi from '@/hooks/useApi'
import { useConfig } from '@/store/context/ConfigContext'
import { useError } from '@/store/context/ErrorContext'

// API
import authApi from '@/api/auth'
import accountApi from '@/api/account.api'
import loginMethodApi from '@/api/loginmethod'

// utils
import useNotifier from '@/utils/useNotifier'

// store
import { loginSuccess, logoutSuccess } from '@/store/reducers/authSlice'
import { store } from '@/store'

// icons
import AzureSSOLoginIcon from '@/assets/images/microsoft-azure.svg'
import GoogleSSOLoginIcon from '@/assets/images/google.svg'
import Auth0SSOLoginIcon from '@/assets/images/auth0.svg'
import GithubSSOLoginIcon from '@/assets/images/github.svg'
import VetraiLogo from '@/assets/images/logo.png'

// ==============================|| SignInPage ||============================== //

const SSO_PROVIDER_CONFIG = {
    azure: { label: 'Sign In With Microsoft', icon: AzureSSOLoginIcon, alt: 'MicrosoftSSO' },
    google: { label: 'Sign In With Google', icon: GoogleSSOLoginIcon, alt: 'GoogleSSO' },
    auth0: { label: 'Sign In With Auth0 by Okta', icon: Auth0SSOLoginIcon, alt: 'Auth0SSO' },
    github: { label: 'Sign In With Github', icon: GithubSSOLoginIcon, alt: 'GithubSSO' }
}

const SSO_PROVIDER_ORDER = ['azure', 'google', 'auth0', 'github']

const UX_HIGHLIGHTS = ['Cross-workspace access control', 'Real-time flow execution insights', 'Secure model and data connectors']

const SignInPage = () => {
    const theme = useTheme()
    const customization = useSelector((state) => state.customization)
    useNotifier()

    const { isEnterpriseLicensed, isCloud, isOpenSource } = useConfig()
    const { authRateLimitError, setAuthRateLimitError } = useError()

    const [usernameVal, setUsernameVal] = useState('')
    const [passwordVal, setPasswordVal] = useState('')
    const [configuredSsoProviders, setConfiguredSsoProviders] = useState([])
    const [authError, setAuthError] = useState(undefined)
    const [loading, setLoading] = useState(false)
    const [showResendButton, setShowResendButton] = useState(false)
    const [successMessage, setSuccessMessage] = useState('')

    const loginApi = useApi(authApi.login)
    const getDefaultProvidersApi = useApi(loginMethodApi.getDefaultLoginMethods)
    const resendVerificationApi = useApi(accountApi.resendVerificationEmail)

    const navigate = useNavigate()
    const location = useLocation()

    const isFormValid = Boolean(usernameVal.trim() && passwordVal)

    const authShellSx = {
        minHeight: '100vh',
        position: 'relative',
        overflow: 'hidden',
        px: { xs: 2, sm: 3, md: 4 },
        py: { xs: 3, sm: 4 },
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: customization.isDarkMode
            ? 'linear-gradient(160deg, #1a2744 0%, #111827 50%, #0f172a 100%)'
            : 'linear-gradient(160deg, #f0f7ff 0%, #f8f9fc 50%, #f0f4ff 100%)'
    }

    const ssoProvidersToRender = useMemo(() => {
        return SSO_PROVIDER_ORDER.filter((provider) => configuredSsoProviders.includes(provider) && SSO_PROVIDER_CONFIG[provider])
    }, [configuredSsoProviders])

    const doLogin = (event) => {
        event.preventDefault()
        if (!isFormValid) return

        setAuthRateLimitError(null)
        setAuthError(undefined)
        setSuccessMessage('')
        setLoading(true)

        loginApi.request({
            email: usernameVal,
            password: passwordVal
        })
    }

    useEffect(() => {
        if (!loginApi.error) return

        setLoading(false)

        const status = loginApi.error?.response?.status
        const redirectUrl = loginApi.error?.response?.data?.redirectUrl
        if (status === 401 && redirectUrl) {
            window.location.href = redirectUrl
            return
        }

        setAuthError(loginApi.error?.response?.data?.message || loginApi.error?.message || 'Sign in failed')
    }, [loginApi.error])

    useEffect(() => {
        store.dispatch(logoutSuccess())
        setAuthRateLimitError(null)
        if (!isOpenSource) {
            getDefaultProvidersApi.request()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [setAuthRateLimitError, isOpenSource])

    useEffect(() => {
        const queryParams = new URLSearchParams(location.search)
        const errorData = queryParams.get('error')
        if (!errorData) return

        try {
            const parsedErrorData = JSON.parse(decodeURIComponent(errorData))
            setAuthError(parsedErrorData?.message || 'Authentication failed')
        } catch {
            setAuthError('Authentication failed')
        }
    }, [location.search])

    useEffect(() => {
        if (!loginApi.data) return

        setLoading(false)
        store.dispatch(loginSuccess(loginApi.data))
        navigate(location.state?.path || '/')
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loginApi.data])

    useEffect(() => {
        if (getDefaultProvidersApi.data?.providers) {
            setConfiguredSsoProviders(getDefaultProvidersApi.data.providers.map((provider) => provider))
        }
    }, [getDefaultProvidersApi.data])

    useEffect(() => {
        setShowResendButton(authError === 'User Email Unverified')
    }, [authError])

    const signInWithSSO = (ssoProvider) => {
        window.location.href = `/api/v1/${ssoProvider}/login`
    }

    const handleResendVerification = async () => {
        try {
            await resendVerificationApi.request({ email: usernameVal })
            setAuthError(undefined)
            setSuccessMessage('Verification email has been sent successfully.')
            setShowResendButton(false)
        } catch (error) {
            setAuthError(error?.response?.data?.message || error?.message || 'Failed to send verification email.')
        }
    }

    return (
        <Box sx={authShellSx}>
            <MainCard
                content={false}
                maxWidth='md'
                sx={{
                    width: '100%',
                    maxWidth: 1080,
                    border: `1px solid ${alpha(theme.palette.common.white, customization.isDarkMode ? 0.14 : 0.62)}`,
                    boxShadow: customization.isDarkMode ? '0 22px 58px rgba(0, 0, 0, 0.55)' : '0 24px 58px rgba(15, 23, 42, 0.16)',
                    borderRadius: 3,
                    backdropFilter: 'blur(8px)',
                    position: 'relative',
                    zIndex: 2,
                    overflow: 'hidden'
                }}
            >
                <Box
                    sx={{
                        display: 'grid',
                        gridTemplateColumns: { xs: '1fr', md: '1.05fr 1fr' }
                    }}
                >
                    <Box
                        sx={{
                            p: { xs: 3, md: 5 },
                            background: '#0f172a',
                            borderRight: {
                                xs: 'none',
                                md: `1px solid ${alpha(theme.palette.divider, customization.isDarkMode ? 0.28 : 0.72)}`
                            }
                        }}
                    >
                        <Stack sx={{ height: '100%', justifyContent: 'space-between', gap: 4 }}>
                            <Stack sx={{ gap: 3 }}>
                                <Box sx={{ display: 'inline-flex', width: 'fit-content', px: 1.25, py: 0.5, borderRadius: 10, bgcolor: alpha('#3b82f6', 0.14) }}>
                                    <Typography
                                        variant='caption'
                                        sx={{
                                            letterSpacing: 0.7,
                                            textTransform: 'uppercase',
                                            color: '#93c5fd',
                                            fontWeight: 700
                                        }}
                                    >
                                        Vetrai Workspace Cloud
                                    </Typography>
                                </Box>

                                <img src={VetraiLogo} alt='Vetrai' style={{ width: '100%', maxWidth: '65px', height: 'auto' }} />

                                <Typography variant='h2' sx={{ lineHeight: 1.2, color: '#f9fafb' }}>
                                    Build, monitor, and scale AI workflows with confidence.
                                </Typography>
                                <Typography variant='body1' sx={{ color: '#9ca3af' }}>
                                    One control center for chatflows, agentflows, assistants, and execution visibility across teams.
                                </Typography>
                            </Stack>

                            <Stack sx={{ gap: 1.2 }}>
                                {UX_HIGHLIGHTS.map((item) => (
                                    <Box
                                        key={item}
                                        sx={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 1,
                                            px: 1.25,
                                            py: 1,
                                            borderRadius: 2,
                                            bgcolor: 'rgba(255,255,255,0.04)',
                                            border: '1px solid rgba(255,255,255,0.08)'
                                        }}
                                    >
                                        <IconSparkles size={15} color='#93c5fd' />
                                        <Typography variant='body2' sx={{ fontWeight: 600, color: '#e5e7eb' }}>
                                            {item}
                                        </Typography>
                                    </Box>
                                ))}
                            </Stack>
                        </Stack>
                    </Box>

                    <Box sx={{ p: { xs: 3, md: 5 }, background: customization.isDarkMode ? '#1f2937' : '#ffffff' }}>
                        <Stack sx={{ gap: 3 }}>
                            <Stack sx={{ gap: 1 }}>
                                <Typography variant='overline' sx={{ color: theme.palette.primary.main, fontWeight: 700, letterSpacing: 1.1 }}>
                                    Welcome Back
                                </Typography>
                                <Typography variant='h2'>Sign In</Typography>
                                <Typography variant='body2' sx={{ color: theme.palette.text.secondary }}>
                                    Enter your account details to access your Vetrai workspace.
                                </Typography>
                                {isCloud ? (
                                    <Typography variant='body2' sx={{ color: theme.palette.text.secondary }}>
                                        Don&apos;t have an account?{' '}
                                        <Link style={{ color: theme.palette.primary.main }} to='/register'>
                                            Sign up for free
                                        </Link>
                                        .
                                    </Typography>
                                ) : null}
                                {isEnterpriseLicensed ? (
                                    <Typography variant='body2' sx={{ color: theme.palette.text.secondary }}>
                                        Have an invite code?{' '}
                                        <Link style={{ color: theme.palette.primary.main }} to='/register'>
                                            Sign up for an account
                                        </Link>
                                        .
                                    </Typography>
                                ) : null}
                            </Stack>

                            {successMessage ? (
                                <Alert variant='filled' severity='success' onClose={() => setSuccessMessage('')}>
                                    {successMessage}
                                </Alert>
                            ) : null}

                            {authRateLimitError ? (
                                <Alert icon={<IconExclamationCircle size={18} />} variant='filled' severity='error'>
                                    {authRateLimitError}
                                </Alert>
                            ) : null}

                            {authError ? (
                                <Alert icon={<IconExclamationCircle size={18} />} variant='filled' severity='error'>
                                    {authError}
                                </Alert>
                            ) : null}

                            {showResendButton ? (
                                <LoadingButton
                                    variant='text'
                                    onClick={handleResendVerification}
                                    loading={resendVerificationApi.loading}
                                    disabled={!usernameVal}
                                    sx={{ alignSelf: 'flex-start', p: 0, minWidth: 'auto' }}
                                >
                                    Resend Verification Email
                                </LoadingButton>
                            ) : null}

                            <form onSubmit={doLogin}>
                                <Stack sx={{ gap: 2 }}>
                                    <Box>
                                        <Typography sx={{ fontWeight: 700, mb: 0.75 }}>
                                            Email<span style={{ color: theme.palette.error.main }}>&nbsp;*</span>
                                        </Typography>
                                        <TextField
                                            fullWidth
                                            type='email'
                                            autoComplete='email'
                                            placeholder='user@company.com'
                                            value={usernameVal}
                                            onChange={(event) => setUsernameVal(event.target.value)}
                                            InputProps={{
                                                startAdornment: (
                                                    <InputAdornment position='start'>
                                                        <IconMail size={18} color={theme.palette.text.secondary} />
                                                    </InputAdornment>
                                                )
                                            }}
                                            sx={{
                                                '& .MuiOutlinedInput-root': {
                                                    borderRadius: 1.5,
                                                    background: alpha(theme.palette.background.paper, customization.isDarkMode ? 0.44 : 0.95)
                                                }
                                            }}
                                        />
                                    </Box>

                                    <Box>
                                        <Typography sx={{ fontWeight: 700, mb: 0.75 }}>
                                            Password<span style={{ color: theme.palette.error.main }}>&nbsp;*</span>
                                        </Typography>
                                        <TextField
                                            fullWidth
                                            type='password'
                                            autoComplete='current-password'
                                            placeholder='Enter your password'
                                            value={passwordVal}
                                            onChange={(event) => setPasswordVal(event.target.value)}
                                            InputProps={{
                                                startAdornment: (
                                                    <InputAdornment position='start'>
                                                        <IconLock size={18} color={theme.palette.text.secondary} />
                                                    </InputAdornment>
                                                )
                                            }}
                                            sx={{
                                                '& .MuiOutlinedInput-root': {
                                                    borderRadius: 1.5,
                                                    background: alpha(theme.palette.background.paper, customization.isDarkMode ? 0.44 : 0.95)
                                                }
                                            }}
                                        />
                                        <Typography variant='body2' sx={{ mt: 1.1, textAlign: 'right' }}>
                                            <Link style={{ color: theme.palette.primary.main }} to='/forgot-password'>
                                                Forgot password?
                                            </Link>
                                        </Typography>
                                    </Box>

                                    <LoadingButton
                                        loading={loading}
                                        variant='contained'
                                        type='submit'
                                        disabled={!isFormValid}
                                        sx={{
                                            mt: 0.75,
                                            borderRadius: 2,
                                            height: 48,
                                            width: '100%',
                                            textTransform: 'none',
                                            fontSize: '0.95rem',
                                            fontWeight: 700,
                                            backgroundColor: theme.palette.primary.main,
                                            boxShadow: '0 1px 3px rgba(0,0,0,0.10), 0 1px 2px rgba(0,0,0,0.06)',
                                            '&:hover': {
                                                backgroundColor: theme.palette.primary.dark,
                                                boxShadow: '0 4px 8px rgba(0,0,0,0.15)'
                                            }
                                        }}
                                    >
                                        Sign In
                                    </LoadingButton>

                                    {ssoProvidersToRender.length > 0 ? <Divider sx={{ width: '100%', my: 0.5 }}>OR CONTINUE WITH</Divider> : null}

                                    {ssoProvidersToRender.map((ssoProvider) => {
                                        const providerConfig = SSO_PROVIDER_CONFIG[ssoProvider]
                                        return (
                                            <Button
                                                key={ssoProvider}
                                                variant='outlined'
                                                sx={{
                                                    borderRadius: 2,
                                                    height: 46,
                                                    width: '100%',
                                                    lineHeight: 0,
                                                    borderColor: alpha(theme.palette.divider, customization.isDarkMode ? 0.35 : 0.9),
                                                    bgcolor: alpha(theme.palette.background.paper, customization.isDarkMode ? 0.35 : 0.84),
                                                    ':hover': {
                                                        borderColor: alpha(theme.palette.primary.main, 0.5),
                                                        bgcolor: alpha(theme.palette.primary.main, 0.06)
                                                    }
                                                }}
                                                onClick={() => signInWithSSO(ssoProvider)}
                                                startIcon={<img src={providerConfig.icon} alt={providerConfig.alt} width={20} height={20} />}
                                            >
                                                {providerConfig.label}
                                            </Button>
                                        )
                                    })}
                                </Stack>
                            </form>
                        </Stack>
                    </Box>
                </Box>
            </MainCard>
        </Box>
    )
}

export default SignInPage
