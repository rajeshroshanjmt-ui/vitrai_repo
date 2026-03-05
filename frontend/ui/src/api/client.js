import axios from 'axios'
import { baseURL } from '@/store/constant'

const apiClient = axios.create({
    baseURL: `${baseURL}/api`,
    headers: {
        'Content-type': 'application/json',
        'x-request-from': 'internal'
    },
    withCredentials: false
})

let bootstrapTokenPromise = null

const getBootstrapIdentity = () => {
    return {
        email: localStorage.getItem('username') || 'admin@vetrai.com',
        tenant_id: localStorage.getItem('vetrai_tenant_id') || '00000000-0000-0000-0000-000000000001',
        role: localStorage.getItem('vetrai_role') || 'admin'
    }
}

const ensureAccessToken = async () => {
    const existing = localStorage.getItem('vetrai_access_token')
    if (existing) {
        return existing
    }

    if (bootstrapTokenPromise) {
        return bootstrapTokenPromise
    }

    const identity = getBootstrapIdentity()
    bootstrapTokenPromise = axios
        .post(`${baseURL}/api/auth/token`, identity)
        .then((response) => {
            const token = response?.data?.access_token
            if (token) {
                localStorage.setItem('vetrai_access_token', token)
            }
            return token
        })
        .catch(() => null)
        .finally(() => {
            bootstrapTokenPromise = null
        })

    return bootstrapTokenPromise
}

apiClient.interceptors.request.use(async (config) => {
    if (config?.skipAuth) {
        return config
    }

    const token = await ensureAccessToken()
    if (token) {
        config.headers = {
            ...(config.headers || {}),
            Authorization: `Bearer ${token}`
        }
    }

    return config
})

apiClient.interceptors.response.use(
    function (response) {
        return response
    },
    async (error) => {
        if (error?.response?.status === 401) {
            localStorage.removeItem('vetrai_access_token')
        }
        return Promise.reject(error)
    }
)

export default apiClient
