import { findMatchingOption } from './utils'

describe('dropdown utils', () => {
    test('returns null for empty value', () => {
        expect(findMatchingOption([{ name: 'a', label: 'A' }], '')).toBeNull()
    })

    test('returns null for non-array options', () => {
        expect(findMatchingOption(null, 'a')).toBeNull()
        expect(findMatchingOption({}, 'a')).toBeNull()
    })

    test('matches by option name', () => {
        const options = [{ name: 'model-a', label: 'Model A' }]
        expect(findMatchingOption(options, 'model-a')).toEqual(options[0])
    })

    test('matches by option label', () => {
        const options = [{ name: 'model-a', label: 'Model A' }]
        expect(findMatchingOption(options, 'Model A')).toEqual(options[0])
    })
})
