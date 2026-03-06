import { useEffect, useState } from 'react'
import { useSelector } from 'react-redux'

import { Popper, FormControl, TextField, Box, Typography } from '@mui/material'
import Autocomplete, { autocompleteClasses } from '@mui/material/Autocomplete'
import { useTheme, styled } from '@mui/material/styles'
import PropTypes from 'prop-types'
import { findMatchingOption } from './utils'

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

export const Dropdown = ({ name, value, loading, options, onSelect, disabled = false, freeSolo = false, disableClearable = false }) => {
    const customization = useSelector((state) => state.customization)
    const [internalValue, setInternalValue] = useState(value ?? '')
    const theme = useTheme()
    const normalizedOptions = Array.isArray(options) ? options : []
    const matchingOption = findMatchingOption(normalizedOptions, internalValue)

    useEffect(() => {
        setInternalValue(value ?? '')
    }, [value])

    return (
        <FormControl sx={{ mt: 1, width: '100%' }} size='small'>
            <Autocomplete
                id={name}
                disabled={disabled}
                freeSolo={freeSolo}
                disableClearable={disableClearable}
                size='small'
                loading={loading}
                options={normalizedOptions}
                value={freeSolo ? internalValue : matchingOption}
                isOptionEqualToValue={(option, selected) => {
                    if (!option || !selected) return false
                    if (typeof selected === 'string') return option.name === selected || option.label === selected
                    return option.name === selected.name
                }}
                onChange={(e, selection) => {
                    let nextValue = ''
                    if (typeof selection === 'string') {
                        nextValue = selection
                    } else if (selection && typeof selection === 'object') {
                        nextValue = selection.name || selection.label || ''
                    }
                    setInternalValue(nextValue)
                    onSelect(nextValue)
                }}
                PopperComponent={StyledPopper}
                renderInput={(params) => {
                    return (
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
                            InputProps={{
                                ...params.InputProps,
                                startAdornment: matchingOption?.imageSrc ? (
                                    <Box
                                        component='img'
                                        src={matchingOption.imageSrc}
                                        alt={matchingOption.label || 'Selected Option'}
                                        sx={{
                                            width: 32,
                                            height: 32,
                                            borderRadius: '50%'
                                        }}
                                    />
                                ) : null
                            }}
                        />
                    )
                }}
                renderOption={(props, option) => {
                    const { key, ...optionProps } = props
                    return (
                        <Box component='li' key={key} {...optionProps} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            {option.imageSrc && (
                                <img
                                    src={option.imageSrc}
                                    alt={option.description}
                                    style={{
                                        width: 30,
                                        height: 30,
                                        padding: 1,
                                        borderRadius: '50%'
                                    }}
                                />
                            )}
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <Typography variant='h5'>{option.label}</Typography>
                                {option.description && (
                                    <Typography sx={{ color: customization.isDarkMode ? '#9e9e9e' : '' }}>{option.description}</Typography>
                                )}
                            </div>
                        </Box>
                    )
                }}
                sx={{ height: '100%' }}
            />
        </FormControl>
    )
}

Dropdown.propTypes = {
    name: PropTypes.string,
    value: PropTypes.string,
    loading: PropTypes.bool,
    options: PropTypes.array,
    freeSolo: PropTypes.bool,
    onSelect: PropTypes.func,
    disabled: PropTypes.bool,
    disableClearable: PropTypes.bool
}
