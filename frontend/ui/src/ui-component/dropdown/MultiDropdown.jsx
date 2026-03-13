import { useEffect, useMemo, useState } from 'react'
import { useSelector } from 'react-redux'

import { Popper, FormControl, TextField, Box, Typography, Chip } from '@mui/material'
import Autocomplete, { autocompleteClasses } from '@mui/material/Autocomplete'
import { useTheme, styled } from '@mui/material/styles'
import PropTypes from 'prop-types'

const StyledPopper = styled(Popper)({
    boxShadow: '0px 8px 10px -5px rgb(0 0 0 / 20%), 0px 16px 24px 2px rgb(0 0 0 / 14%), 0px 6px 30px 5px rgb(0 0 0 / 12%)',
    borderRadius: '10px',
    [`& .${autocompleteClasses.listbox}`]: {
        boxSizing: 'border-box',
        '& ul': {
            padding: 10,
            margin: 10
        }
    }
})

export const MultiDropdown = ({ name, value, options, onSelect, formControlSx = {}, disabled = false, disableClearable = false }) => {
    const customization = useSelector((state) => state.customization)
    const getSelectedNames = (rawValue) => {
        if (Array.isArray(rawValue)) {
            return rawValue
                .map((item) => (typeof item === 'string' ? item : item?.name))
                .filter((item) => typeof item === 'string' && item.length > 0)
        }

        if (typeof rawValue !== 'string') return []
        const trimmed = rawValue.trim()
        if (!trimmed || trimmed === 'choose an option') return []

        try {
            const parsed = JSON.parse(trimmed)
            if (!Array.isArray(parsed)) return []
            return parsed.map((item) => (typeof item === 'string' ? item : item?.name)).filter(Boolean)
        } catch {
            return [trimmed]
        }
    }

    const [internalValue, setInternalValue] = useState(value ?? '')
    const theme = useTheme()
    const normalizedOptions = Array.isArray(options) ? options : []

    useEffect(() => {
        setInternalValue(value ?? '')
    }, [value])

    const selectedOptionNames = useMemo(() => getSelectedNames(internalValue), [internalValue])
    const selectedOptions = useMemo(
        () => normalizedOptions.filter((option) => selectedOptionNames.includes(option.name)),
        [normalizedOptions, selectedOptionNames]
    )

    return (
        <FormControl sx={{ mt: 1, width: '100%', ...formControlSx }} size='small'>
            <Autocomplete
                id={name}
                disabled={disabled}
                disableClearable={disableClearable}
                size='small'
                multiple
                filterSelectedOptions
                options={normalizedOptions}
                value={selectedOptions}
                onChange={(e, selections) => {
                    const selectionNames = selections.map((selection) => selection?.name).filter(Boolean)
                    const nextValue = selectionNames.length > 0 ? JSON.stringify(selectionNames) : ''
                    setInternalValue(nextValue)
                    onSelect?.(nextValue)
                }}
                PopperComponent={StyledPopper}
                renderInput={(params) => (
                    <TextField
                        {...params}
                        sx={{
                            height: '100%',
                            '& .MuiInputBase-root': {
                                height: '100%',
                                '& fieldset': {
                                    borderColor: theme.palette.grey[900] + 25
                                }
                            }
                        }}
                    />
                )}
                renderOption={(props, option) => (
                    <Box component='li' {...props}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <Typography variant='h5'>{option.label}</Typography>
                            {option.description && (
                                <Typography sx={{ color: customization.isDarkMode ? '#9e9e9e' : '' }}>{option.description}</Typography>
                            )}
                        </div>
                    </Box>
                )}
                renderTags={(tagValue, getTagProps) =>
                    tagValue.map((option, index) => {
                        const { key, ...chipProps } = getTagProps({ index })
                        return <Chip key={key} label={option?.label || option?.name || ''} {...chipProps} />
                    })
                }
                sx={{ height: '100%' }}
            />
        </FormControl>
    )
}

MultiDropdown.propTypes = {
    name: PropTypes.string,
    value: PropTypes.oneOfType([PropTypes.string, PropTypes.array]),
    options: PropTypes.array,
    onSelect: PropTypes.func,
    disabled: PropTypes.bool,
    formControlSx: PropTypes.object,
    disableClearable: PropTypes.bool
}
