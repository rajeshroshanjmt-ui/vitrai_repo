import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { z } from 'zod'
import axios from 'axios'

// material-ui
import { Alert, Box, Button, Divider, Icon, List, ListItemText, OutlinedInput, Stack, Typography, useTheme } from '@mui/material'
import { LoadingButton } from '@mui/lab'

// project imports
import { Input } from '@/ui-component/input/Input'
import { BackdropLoader } from '@/ui-component/loading/BackdropLoader'
import MainCard from '@/ui-component/cards/MainCard'

// API
import loginMethodApi from '@/api/loginmethod'
import { baseURL } from '@/store/constant'

// Hooks
import useApi from '@/hooks/useApi'
import { useConfig } from '@/store/context/ConfigContext'
import { useError } from '@/store/context/ErrorContext'

// utils
import useNotifier from '@/utils/useNotifier'
import { passwordSchema } from '@/utils/validation'

// Icons
import Auth0SSOLoginIcon from '@/assets/images/auth0.svg'
import GithubSSOLoginIcon from '@/assets/images/github.svg'
import GoogleSSOLoginIcon from '@/assets/images/google.svg'
import AzureSSOLoginIcon from '@/assets/images/microsoft-azure.svg'
import VetraiLogo from '@/assets/images/logo.png'
import { IconCircleCheck, IconExclamationCircle } from '@tabler/icons-react'

// ==============================|| Register ||============================== //

const SSO_PROVIDER_CONFIG = {
    azure: { label: 'Sign In With Microsoft', icon: AzureSSOLoginIcon, alt: 'MicrosoftSSO' },
    google: { label: 'Sign In With Google', icon: GoogleSSOLoginIcon, alt: 'GoogleSSO' },
    auth0: { label: 'Sign In With Auth0 by Okta', icon: Auth0SSOLoginIcon, alt: 'Auth0SSO' },
    github: { label: 'Sign In With Github', icon: GithubSSOLoginIcon, alt: 'GithubSSO' }
}

const SSO_PROVIDER_ORDER = ['azure', 'google', 'auth0', 'github']

// IMPORTANT: when updating this schema, update the schema on the server as well
// backend/schemas.py
const RegisterUserSchema = z
    .object({
        username: z.string().min(1, 'Name is required'),
        email: z.string().min(1, 'Email is required').email('Invalid email address'),
        password: passwordSchema,
        confirmPassword: z.string().min(1, 'Confirm Password is required')
    })
    .refine((data) => data.password === data.confirmPassword, {
        message: "Passwords don't match",
        path: ['confirmPassword']
    })

const RegisterPage = () => {
    const theme = useTheme()
    useNotifier()

    const { isEnterpriseLicensed, isCloud, isOpenSource } = useConfig()
    const { authRateLimitError, setAuthRateLimitError } = useError()

    const navigate = useNavigate()
    const location = useLocation()

    const usernameInput = {
        label: 'Username',
        name: 'username',
        type: 'text',
        placeholder: 'John Doe'
    }

    const passwordInput = {
        label: 'Password',
        name: 'password',
        type: 'password',
        placeholder: '********'
    }

    const confirmPasswordInput = {
        label: 'Confirm Password',
        name: 'confirmPassword',
        type: 'password',
        placeholder: '********'
    }

    const emailInput = {
        label: 'Email',
        name: 'email',
        type: 'email',
        placeholder: 'user@company.com'
    }

    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [username, setUsername] = useState('')
    const [configuredSsoProviders, setConfiguredSsoProviders] = useState([])

    const [loading, setLoading] = useState(false)
    const [authError, setAuthError] = useState('')
    const [successMsg, setSuccessMsg] = useState('')

    const getDefaultProvidersApi = useApi(loginMethodApi.getDefaultLoginMethods)

    const ssoProvidersToRender = useMemo(() => {
        return SSO_PROVIDER_ORDER.filter((provider) => configuredSsoProviders.includes(provider) && SSO_PROVIDER_CONFIG[provider])
    }, [configuredSsoProviders])

    const isFormValid = useMemo(() => {
        return Boolean(username.trim() && email.trim() && password && confirmPassword)
    }, [confirmPassword, email, password, username])

    const authShellSx = {
        minHeight: '100vh',
        px: { xs: 2, sm: 3 },
        py: { xs: 3, sm: 5 },
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background:
            theme.palette.mode === 'dark'
                ? 'radial-gradient(circle at top right, rgba(71, 98, 130, 0.35), rgba(15, 23, 42, 1) 55%)'
                : 'radial-gradient(circle at top right, rgba(66, 165, 245, 0.18), rgba(248, 250, 252, 1) 58%)'
    }

    const register = async (event) => {
        event.preventDefault()
        setAuthRateLimitError(null)
        setAuthError('')

        const result = RegisterUserSchema.safeParse({
            username,
            email,
            password,
            confirmPassword
        })
        if (!result.success) {
            setAuthError(result.error.errors.map((err) => err.message).join(', '))
            return
        }

        setLoading(true)
        try {
            // Generate a proper UUID for tenant_id
            const tenant_id = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                const r = Math.random() * 16 | 0
                const v = c === 'x' ? r : (r & 0x3 | 0x8)
                return v.toString(16)
            })
            const registerResponse = await axios.post(`${baseURL}/api/auth/register`, {
                email,
                password,
                tenant_id,
                role: 'admin'
            })

            if (registerResponse?.data?.access_token) {
                const token = registerResponse.data.access_token
                localStorage.setItem('vetrai_access_token', token)
                localStorage.setItem('vetrai_tenant_id', tenant_id)
                localStorage.setItem('vetrai_email', email)
                localStorage.setItem('vetrai_role', 'admin')
                setSuccessMsg('Registration successful. Redirecting...')
                setTimeout(() => {
                    window.location.href = '/chatflows'
                }, 1500)
            }
        } catch (error) {
            setAuthError(error?.response?.data?.detail || 'Registration failed')
        } finally {
            setLoading(false)
        }
    }

    const signInWithSSO = (ssoProvider) => {
        window.location.href = `/api/v1/${ssoProvider}/login`
    }

    useEffect(() => {
        setAuthRateLimitError(null)
        getDefaultProvidersApi.request()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    useEffect(() => {
        if (getDefaultProvidersApi.data?.providers) {
            setConfiguredSsoProviders(getDefaultProvidersApi.data.providers)
        }
    }, [getDefaultProvidersApi.data])

    return (
        <Box sx={authShellSx}>
            <MainCard
                maxWidth='sm'
                sx={{
                    width: '100%',
                    maxWidth: 560,
                    borderRadius: 4,
                    border: `1px solid ${theme.palette.grey[900]}22`,
                    boxShadow: theme.palette.mode === 'dark' ? '0 14px 40px rgba(0,0,0,0.45)' : '0 14px 40px rgba(15, 23, 42, 0.12)'
                }}
            >
                <Stack flexDirection='column' sx={{ width: '100%', gap: 3 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                        <img src={VetraiLogo} alt='Vetrai' style={{ width: '100%', maxWidth: '65px', height: 'auto' }} />
                    </Box>

                    {authError ? (
                        <Alert icon={<IconExclamationCircle />} variant='filled' severity='error'>
                            {authError.split(', ').length > 1 ? (
                                <List dense sx={{ py: 0 }}>
                                    {authError.split(', ').map((error, index) => (
                                        <ListItemText key={index} primary={error} primaryTypographyProps={{ color: '#fff !important' }} />
                                    ))}
                                </List>
                            ) : (
                                authError
                            )}
                        </Alert>
                    ) : null}

                    {authRateLimitError ? (
                        <Alert icon={<IconExclamationCircle />} variant='filled' severity='error'>
                            {authRateLimitError}
                        </Alert>
                    ) : null}

                    {successMsg ? (
                        <Alert icon={<IconCircleCheck />} variant='filled' severity='success'>
                            {successMsg}
                        </Alert>
                    ) : null}

                    <Stack sx={{ gap: 1 }}>
                        <Typography variant='overline' sx={{ color: theme.palette.primary.main, fontWeight: 700, letterSpacing: 1 }}>
                            Create Workspace Access
                        </Typography>
                        <Typography variant='h1'>Sign Up</Typography>
                        <Typography variant='body2' sx={{ color: theme.palette.grey[600] }}>
                            Already have an account?{' '}
                            <Link style={{ color: theme.palette.primary.main }} to='/signin'>
                                Sign In
                            </Link>
                            .
                        </Typography>
                    </Stack>

                    <form onSubmit={register} data-rewardful>
                        <Stack sx={{ width: '100%', gap: 2 }}>

                            <Box>
                                <Typography sx={{ fontWeight: 600, mb: 0.75 }}>
                                    Full Name<span style={{ color: 'red' }}>&nbsp;*</span>
                                </Typography>
                                <Input inputParam={usernameInput} onChange={setUsername} value={username} showDialog={false} />
                                <Typography variant='caption'>
                                    <i>Used for display purposes only.</i>
                                </Typography>
                            </Box>

                            <Box>
                                <Typography sx={{ fontWeight: 600, mb: 0.75 }}>
                                    Email<span style={{ color: 'red' }}>&nbsp;*</span>
                                </Typography>
                                <Input inputParam={emailInput} onChange={setEmail} value={email} showDialog={false} />
                                <Typography variant='caption'>
                                    <i>Use a valid email address. It will be used for sign in.</i>
                                </Typography>
                            </Box>


                            <Box>
                                <Typography sx={{ fontWeight: 600, mb: 0.75 }}>
                                    Password<span style={{ color: 'red' }}>&nbsp;*</span>
                                </Typography>
                                <Input inputParam={passwordInput} onChange={setPassword} value={password} />
                                <Typography variant='caption'>
                                    <i>
                                        Password must be at least 8 characters long and contain at least one lowercase letter, one uppercase
                                        letter, one digit, and one special character.
                                    </i>
                                </Typography>
                            </Box>

                            <Box>
                                <Typography sx={{ fontWeight: 600, mb: 0.75 }}>
                                    Confirm Password<span style={{ color: 'red' }}>&nbsp;*</span>
                                </Typography>
                                <Input inputParam={confirmPasswordInput} onChange={setConfirmPassword} value={confirmPassword} />
                                <Typography variant='caption'>
                                    <i>Confirm your password. Must match the password typed above.</i>
                                </Typography>
                            </Box>

                            <LoadingButton
                                loading={loading}
                                variant='contained'
                                sx={{ borderRadius: 2, height: 44, width: '100%' }}
                                type='submit'
                                disabled={!isFormValid}
                            >
                                Create Account
                            </LoadingButton>

                            {ssoProvidersToRender.length > 0 ? <Divider sx={{ width: '100%' }}>OR</Divider> : null}

                            {ssoProvidersToRender.map((ssoProvider) => {
                                const providerConfig = SSO_PROVIDER_CONFIG[ssoProvider]
                                return (
                                    <Button
                                        key={ssoProvider}
                                        variant='outlined'
                                        sx={{ borderRadius: 2, height: 45, width: '100%', lineHeight: 0 }}
                                        onClick={() => signInWithSSO(ssoProvider)}
                                        startIcon={
                                            <Icon>
                                                <img src={providerConfig.icon} alt={providerConfig.alt} width={20} height={20} />
                                            </Icon>
                                        }
                                    >
                                        {providerConfig.label}
                                    </Button>
                                )
                            })}
                        </Stack>
                    </form>
                </Stack>
            </MainCard>

            <BackdropLoader open={loading} />
        </Box>
    )
}

export default RegisterPage
