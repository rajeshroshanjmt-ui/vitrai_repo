const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value || {}, key)

export const toList = (payload) => {
    if (Array.isArray(payload)) return payload
    if (Array.isArray(payload?.data)) return payload.data
    if (Array.isArray(payload?.items)) return payload.items
    return []
}

export const toObject = (payload) => {
    if (payload && typeof payload === 'object' && !Array.isArray(payload)) return payload
    return {}
}

export const resolvePayload = (response) => {
    if (response && typeof response === 'object' && hasOwn(response, 'data')) return response.data
    return response
}

export const successResponse = (data, status = 200) => ({
    data,
    status,
    isNotFound: false,
    isUnavailable: false,
    error: null
})

export const unavailableResponse = (data, status = 404) => ({
    data,
    status,
    isNotFound: status === 404,
    isUnavailable: true,
    error: null
})

export const unavailableListResponse = (status = 404) => unavailableResponse([], status)
export const unavailableObjectResponse = (status = 404) => unavailableResponse({}, status)
