import { getMenuChildren } from './menuUtils'

describe('menu utils', () => {
    test('returns empty array when menu is undefined', () => {
        expect(getMenuChildren(undefined)).toEqual([])
    })

    test('returns empty array when children is not an array', () => {
        expect(getMenuChildren({ children: null })).toEqual([])
        expect(getMenuChildren({ children: {} })).toEqual([])
    })

    test('returns children when children is an array', () => {
        const children = [{ id: 'a' }]
        expect(getMenuChildren({ children })).toEqual(children)
    })
})
