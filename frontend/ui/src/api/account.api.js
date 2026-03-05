const inviteAccount = async () => ({ data: { status: 'ok' } })
const registerAccount = async () => ({ data: { status: 'ok' } })
const verifyAccountEmail = async () => ({ data: { status: 'ok' } })
const resendVerificationEmail = async () => ({ data: { status: 'ok' } })
const forgotPassword = async () => ({ data: { status: 'ok' } })
const resetPassword = async () => ({ data: { status: 'ok' } })
const getBillingData = async () => ({ data: { url: null } })

const logout = async () => {
    localStorage.removeItem('vetrai_access_token')
    return {
        data: {
            message: 'logged_out',
            redirectTo: '/login'
        }
    }
}

const getBasicAuth = async () => ({ data: { enabled: false } })
const checkBasicAuth = async () => ({ data: { ok: true } })

export default {
    getBillingData,
    inviteAccount,
    registerAccount,
    verifyAccountEmail,
    resendVerificationEmail,
    forgotPassword,
    resetPassword,
    logout,
    getBasicAuth,
    checkBasicAuth
}
