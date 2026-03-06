export const findMatchingOption = (optionList = [], selectedValue = '') => {
    if (!Array.isArray(optionList) || !selectedValue) {
        return null
    }

    return optionList.find((option) => option?.name === selectedValue || option?.label === selectedValue) || null
}
