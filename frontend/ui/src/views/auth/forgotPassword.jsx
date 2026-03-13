import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

// material-ui
import { Alert, Box, Stack, Typography, useTheme } from '@mui/material'
import { LoadingButton } from '@mui/lab'

// project imports
import MainCard from '@/ui-component/cards/MainCard'
import { Input } from '@/ui-component/input/Input'

// API
import accountApi from '@/api/account.api'

// Hooks
import useApi from '@/hooks/useApi'
import { useConfig } from '@/store/context/ConfigContext'
import { useError } from '@/store/context/ErrorContext'

// utils
import useNotifier from '@/utils/useNotifier'

// Icons
import { IconCircleCheck, IconExclamationCircle } from '@tabler/icons-react'
import VetraiLogo from '@/assets/images/logo.png'

// ==============================|| ForgotPasswordPage ||============================== //

const ForgotPasswordPage = () => {
    const theme = useTheme()
    useNotifier()

    const usernameInput = {
        label: 'Username',
        name: 'username',
        type: 'email',
        placeholder: 'user@company.com'
    }
    const [usernameVal, setUsernameVal] = useState('')
    const { isEnterpriseLicensed } = useConfig()

    const [isLoading, setLoading] = useState(false)
    const [responseMsg, setResponseMsg] = useState(undefined)

    const { authRateLimitError, setAuthRateLimitError } = useError()

    const forgotPasswordApi = useApi(accountApi.forgotPassword)

    const sendResetRequest = async (event) => {
        event.preventDefault()
        setAuthRateLimitError(null)
        setResponseMsg(undefined)
        const body = {
            user: {
                email: usernameVal
            }
        }
        setLoading(true)
        await forgotPasswordApi.request(body)
    }

    useEffect(() => {
        setAuthRateLimitError(null)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [setAuthRateLimitError])

    useEffect(() => {
        if (forgotPasswordApi.error) {
            const errMessage =
                typeof forgotPasswordApi.error?.response?.data === 'object'
                    ? forgotPasswordApi.error?.response?.data?.message
                    : forgotPasswordApi.error?.response?.data || forgotPasswordApi.error?.message
            setResponseMsg({
                type: 'error',
                msg: errMessage ?? 'Failed to send instructions, please contact your administrator.'
            })
            setLoading(false)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [forgotPasswordApi.error])

    useEffect(() => {
        if (forgotPasswordApi.data) {
            setResponseMsg({
                type: 'success',
                msg: 'Password reset instructions sent to the email.'
            })
            setLoading(false)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [forgotPasswordApi.data])

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

    return (
        <Box sx={authShellSx}>
            <MainCard
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

                    {responseMsg && responseMsg?.type === 'error' && (
                        <Alert icon={<IconExclamationCircle />} variant='filled' severity='error'>
                            {responseMsg.msg}
                        </Alert>
                    )}
                    {authRateLimitError && (
                        <Alert icon={<IconExclamationCircle />} variant='filled' severity='error'>
                            {authRateLimitError}
                        </Alert>
                    )}
                    {responseMsg && responseMsg?.type !== 'error' && (
                        <Alert icon={<IconCircleCheck />} variant='filled' severity='success'>
                            {responseMsg.msg}
                        </Alert>
                    )}
                    <Stack sx={{ gap: 1 }}>
                        <Typography variant='overline' sx={{ color: theme.palette.primary.main, fontWeight: 700, letterSpacing: 1 }}>
                            Account Recovery
                        </Typography>
                        <Typography variant='h1'>Forgot Password?</Typography>
                        <Typography variant='body2' sx={{ color: theme.palette.grey[600] }}>
                            Enter your account email and we&apos;ll send reset instructions.
                        </Typography>
                        <Typography variant='body2' sx={{ color: theme.palette.grey[600] }}>
                            Have a reset password code?{' '}
                            <Link style={{ color: theme.palette.primary.main }} to='/reset-password'>
                                Change your password here
                            </Link>
                            .
                        </Typography>
                        <Typography variant='body2' sx={{ color: theme.palette.grey[600] }}>
                            Need to sign in instead?{' '}
                            <Link style={{ color: theme.palette.primary.main }} to='/signin'>
                                Back to Login
                            </Link>
                            .
                        </Typography>
                    </Stack>
                    <form onSubmit={sendResetRequest}>
                        <Stack sx={{ width: '100%', gap: 2 }}>
                            <Box>
                                <Typography sx={{ fontWeight: 600, mb: 0.75 }}>
                                    Email<span style={{ color: 'red' }}>&nbsp;*</span>
                                </Typography>
                                <Input
                                    inputParam={usernameInput}
                                    onChange={(newValue) => setUsernameVal(newValue)}
                                    value={usernameVal}
                                    showDialog={false}
                                />
                                {isEnterpriseLicensed && (
                                    <Typography variant='caption'>
                                        <i>If you forgot the email you used for signing up, please contact your administrator.</i>
                                    </Typography>
                                )}
                            </Box>
                            <LoadingButton
                                loading={isLoading}
                                variant='contained'
                                sx={{ borderRadius: 2, height: 44, width: '100%' }}
                                disabled={!usernameVal}
                                type='submit'
                            >
                                Send Reset Password Instructions
                            </LoadingButton>
                        </Stack>
                    </form>
                </Stack>
            </MainCard>
        </Box>
    )
}

export default ForgotPasswordPage
