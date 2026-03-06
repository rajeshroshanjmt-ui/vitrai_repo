import { useState } from 'react'
import { useError } from '@/store/context/ErrorContext'
import { resolvePayload } from '@/api/responseAdapter'

export default (apiFunc) => {
    const [data, setData] = useState(null)
    const [loading, setLoading] = useState(false)
    const [error, setApiError] = useState(null)
    const [status, setStatus] = useState(null)
    const [isNotFound, setIsNotFound] = useState(false)
    const [isUnavailable, setIsUnavailable] = useState(false)
    const { setError, handleError } = useError()

    const request = async (...args) => {
        setLoading(true)
        setApiError(null)
        setStatus(null)
        setIsNotFound(false)
        setIsUnavailable(false)
        try {
            const result = await apiFunc(...args)
            const responseStatus = Number(result?.status) || 200
            const responseData = resolvePayload(result)
            const notFound = Boolean(result?.isNotFound || responseStatus === 404)
            const unavailable = Boolean(result?.isUnavailable || notFound || responseStatus === 501 || responseStatus === 503)

            setData(responseData)
            setStatus(responseStatus)
            setIsNotFound(notFound)
            setIsUnavailable(unavailable)
            setError(null)
        } catch (err) {
            const responseStatus = err?.response?.status || null
            const notFound = responseStatus === 404
            const unavailable = notFound || responseStatus === 501 || responseStatus === 503

            setStatus(responseStatus)
            setIsNotFound(notFound)
            setIsUnavailable(unavailable)
            setApiError(err || 'Unexpected Error!')
            if (!unavailable) {
                handleError(err || 'Unexpected Error!')
            }
        } finally {
            setLoading(false)
        }
    }

    return {
        error,
        data,
        loading,
        status,
        isNotFound,
        isUnavailable,
        request
    }
}
