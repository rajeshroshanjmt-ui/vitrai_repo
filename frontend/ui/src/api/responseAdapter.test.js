import {
    toList,
    toObject,
    resolvePayload,
    successResponse,
    unavailableResponse,
    unavailableListResponse,
    unavailableObjectResponse
} from './responseAdapter'

describe('responseAdapter', () => {
    test('toList returns a list for array payload', () => {
        expect(toList([1, 2])).toEqual([1, 2])
    })

    test('toList returns payload.data when data is an array', () => {
        expect(toList({ data: ['a'] })).toEqual(['a'])
    })

    test('toList returns payload.items when items is an array', () => {
        expect(toList({ items: ['x'] })).toEqual(['x'])
    })

    test('toList returns empty array for invalid payload', () => {
        expect(toList(null)).toEqual([])
        expect(toList({ data: {} })).toEqual([])
    })

    test('toObject returns empty object for non-object values', () => {
        expect(toObject(null)).toEqual({})
        expect(toObject([])).toEqual({})
        expect(toObject('abc')).toEqual({})
    })

    test('resolvePayload unwraps axios-like response data', () => {
        expect(resolvePayload({ data: { ok: true } })).toEqual({ ok: true })
    })

    test('resolvePayload returns value unchanged for non-response object', () => {
        const payload = { ok: true }
        expect(resolvePayload(payload)).toEqual(payload)
    })

    test('successResponse shape', () => {
        expect(successResponse(['a'], 201)).toEqual({
            data: ['a'],
            status: 201,
            isNotFound: false,
            isUnavailable: false,
            error: null
        })
    })

    test('unavailableResponse marks 404 as notFound', () => {
        expect(unavailableResponse([], 404)).toEqual({
            data: [],
            status: 404,
            isNotFound: true,
            isUnavailable: true,
            error: null
        })
    })

    test('unavailable helpers return safe defaults', () => {
        expect(unavailableListResponse(404).data).toEqual([])
        expect(unavailableObjectResponse(404).data).toEqual({})
    })
})
