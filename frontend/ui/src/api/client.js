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

const ensureAccessToken = () => {
    // Return the stored token if present; otherwise return null and let
    // the 401 interceptor redirect to the login page.
    // The old bootstrap call (posting email+tenant_id without a password)
    // always resulted in a 422 because the password field was missing.
    return localStorage.getItem('vetrai_access_token') || null
}

apiClient.interceptors.request.use((config) => {
    if (config?.skipAuth) {
        return config
    }

    const token = ensureAccessToken()
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
