import { alpha } from '@mui/material/styles'

export default function componentStyleOverrides(theme) {
    const isDark = theme?.customization?.isDarkMode
    const semantic = theme?.semantic || {}

    const surfaceBase = semantic?.surface?.base || theme?.backgroundDefault
    const surfaceRaised = semantic?.surface?.raised || theme?.paper
    const surfaceSunken = semantic?.surface?.sunken || theme?.background
    const outlineSubtle = semantic?.outline?.subtle || theme?.divider
    const outlineStrong = semantic?.outline?.strong || theme?.divider
    const glowSoft = semantic?.glow?.soft || alpha(theme?.colors?.primaryMain || '#2a6fe8', 0.12)
    const glowElevated = semantic?.glow?.elevated || alpha(theme?.colors?.primaryMain || '#2a6fe8', 0.2)
    const focusRing = semantic?.focusRing?.main || alpha(theme?.colors?.primaryMain || '#2a6fe8', 0.45)

    return {
        MuiCssBaseline: {
            styleOverrides: {
                '*, *::before, *::after': {
                    boxSizing: 'border-box'
                },
                body: {
                    backgroundColor: surfaceBase,
                    backgroundImage: isDark
                        ? `radial-gradient(1200px 420px at 8% -10%, ${alpha(theme?.colors?.darkBrandMain || '#6aa5ff', 0.22)}, transparent 55%), radial-gradient(900px 320px at 100% 0%, ${alpha(theme?.colors?.darkSecondaryMain || '#3aa9cd', 0.16)}, transparent 60%)`
                        : `radial-gradient(1000px 360px at 5% -8%, ${alpha(theme?.colors?.brandMain || '#2a6fe8', 0.12)}, transparent 52%), radial-gradient(900px 280px at 95% 0%, ${alpha(theme?.colors?.secondaryMain || '#129ccf', 0.1)}, transparent 58%)`,
                    color: theme?.darkTextPrimary,
                    scrollbarWidth: 'thin',
                    scrollbarColor: `${alpha(theme?.colors?.primaryMain || '#2a6fe8', 0.5)} ${surfaceSunken}`,
                    transition: 'background-color 220ms ease, color 220ms ease',
                    '&::-webkit-scrollbar, & *::-webkit-scrollbar': {
                        width: 12,
                        height: 12,
                        backgroundColor: surfaceSunken
                    },
                    '&::-webkit-scrollbar-thumb, & *::-webkit-scrollbar-thumb': {
                        borderRadius: 999,
                        backgroundColor: alpha(theme?.colors?.primaryMain || '#2a6fe8', isDark ? 0.5 : 0.34),
                        border: `3px solid ${surfaceSunken}`
                    },
                    '&::-webkit-scrollbar-thumb:hover, & *::-webkit-scrollbar-thumb:hover': {
                        backgroundColor: alpha(theme?.colors?.primaryMain || '#2a6fe8', isDark ? 0.62 : 0.46)
                    },
                    '&::-webkit-scrollbar-corner, & *::-webkit-scrollbar-corner': {
                        backgroundColor: surfaceSunken
                    }
                },
                '#root': {
                    minHeight: '100vh'
                },
                '*:focus-visible': {
                    outline: `2px solid ${focusRing}`,
                    outlineOffset: 2
                }
            }
        },
        MuiButton: {
            styleOverrides: {
                root: {
                    fontWeight: 650,
                    borderRadius: 10,
                    transition: 'transform 150ms ease, box-shadow 150ms ease, background-color 180ms ease',
                    '&:hover': {
                        transform: 'translateY(-1px)'
                    }
                },
                containedPrimary: {
                    boxShadow: `0 8px 24px ${glowSoft}`,
                    backgroundImage: `linear-gradient(135deg, ${theme?.colors?.primaryMain || '#2a6fe8'} 0%, ${theme?.colors?.secondaryMain || '#129ccf'} 100%)`,
                    '&:hover': {
                        boxShadow: `0 12px 28px ${glowElevated}`,
                        backgroundImage: `linear-gradient(135deg, ${theme?.colors?.primaryDark || '#1b4ea8'} 0%, ${theme?.colors?.secondaryDark || '#0f6b91'} 100%)`
                    }
                },
                outlined: {
                    borderColor: outlineStrong,
                    '&:hover': {
                        borderColor: theme?.menuSelected,
                        backgroundColor: alpha(theme?.menuSelected || '#2a6fe8', 0.08)
                    }
                }
            }
        },
        MuiSvgIcon: {
            styleOverrides: {
                root: {
                    color: 'inherit'
                }
            }
        },
        MuiPaper: {
            defaultProps: {
                elevation: 0
            },
            styleOverrides: {
                root: {
                    backgroundImage: 'none',
                    backgroundColor: surfaceRaised,
                    border: `1px solid ${outlineSubtle}`
                },
                rounded: {
                    borderRadius: `${theme?.customization?.borderRadius}px`
                }
            }
        },
        MuiCard: {
            styleOverrides: {
                root: {
                    backgroundColor: surfaceRaised,
                    border: `1px solid ${outlineSubtle}`,
                    boxShadow: `0 8px 30px ${alpha('#020617', isDark ? 0.34 : 0.08)}`,
                    transition: 'transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease',
                    '&:hover': {
                        borderColor: outlineStrong,
                        boxShadow: `0 16px 34px ${alpha('#020617', isDark ? 0.4 : 0.14)}`
                    }
                }
            }
        },
        MuiCardHeader: {
            styleOverrides: {
                root: {
                    color: theme?.colors?.textDark,
                    padding: '20px 24px 16px'
                },
                title: {
                    fontSize: '1.12rem',
                    fontWeight: 650
                }
            }
        },
        MuiCardContent: {
            styleOverrides: {
                root: {
                    padding: '20px 24px'
                }
            }
        },
        MuiCardActions: {
            styleOverrides: {
                root: {
                    padding: '18px 24px'
                }
            }
        },
        MuiListItemButton: {
            styleOverrides: {
                root: {
                    color: theme?.darkTextPrimary,
                    borderRadius: 10,
                    paddingTop: '10px',
                    paddingBottom: '10px',
                    transition: 'background-color 160ms ease, color 160ms ease, transform 140ms ease',
                    '&.Mui-selected': {
                        color: theme?.menuSelected,
                        backgroundColor: alpha(theme?.menuSelected || '#2a6fe8', 0.14),
                        boxShadow: `inset 0 0 0 1px ${outlineStrong}`,
                        '&:hover': {
                            backgroundColor: alpha(theme?.menuSelected || '#2a6fe8', 0.18)
                        },
                        '& .MuiListItemIcon-root': {
                            color: theme?.menuSelected
                        }
                    },
                    '&:hover': {
                        transform: 'translateX(2px)',
                        backgroundColor: alpha(theme?.menuSelected || '#2a6fe8', 0.1),
                        color: theme?.menuSelected,
                        '& .MuiListItemIcon-root': {
                            color: theme?.menuSelected
                        }
                    }
                }
            }
        },
        MuiListItemIcon: {
            styleOverrides: {
                root: {
                    color: theme?.darkTextPrimary,
                    minWidth: '36px'
                }
            }
        },
        MuiListItemText: {
            styleOverrides: {
                primary: {
                    color: theme?.textDark
                }
            }
        },
        MuiInputBase: {
            styleOverrides: {
                input: {
                    color: theme?.textDark,
                    '&::placeholder': {
                        color: theme?.darkTextSecondary,
                        fontSize: '0.875rem',
                        opacity: 1
                    },
                    '&.Mui-disabled': {
                        WebkitTextFillColor: alpha(theme?.darkTextSecondary || '#98abc7', 0.85)
                    }
                }
            }
        },
        MuiOutlinedInput: {
            styleOverrides: {
                root: {
                    background: surfaceSunken,
                    borderRadius: `${theme?.customization?.borderRadius}px`,
                    transition: 'box-shadow 160ms ease, border-color 160ms ease, background-color 160ms ease',
                    '& .MuiOutlinedInput-notchedOutline': {
                        borderColor: outlineSubtle
                    },
                    '&:hover .MuiOutlinedInput-notchedOutline': {
                        borderColor: outlineStrong
                    },
                    '&.Mui-focused': {
                        boxShadow: `0 0 0 3px ${focusRing}`,
                        '& .MuiOutlinedInput-notchedOutline': {
                            borderColor: theme?.menuSelected
                        }
                    },
                    '&.MuiInputBase-multiline': {
                        padding: 1
                    }
                },
                input: {
                    fontWeight: 500,
                    background: surfaceSunken,
                    padding: '14px 14px',
                    borderRadius: `${theme?.customization?.borderRadius}px`,
                    '&.MuiInputBase-inputSizeSmall': {
                        padding: '10px 12px',
                        '&.MuiInputBase-inputAdornedStart': {
                            paddingLeft: 0
                        }
                    }
                },
                inputAdornedStart: {
                    paddingLeft: 4
                },
                notchedOutline: {
                    borderRadius: `${theme?.customization?.borderRadius}px`
                }
            }
        },
        MuiSlider: {
            styleOverrides: {
                root: {
                    '&.Mui-disabled': {
                        color: theme?.colors?.grey300
                    }
                },
                mark: {
                    backgroundColor: surfaceRaised,
                    width: '4px'
                },
                valueLabel: {
                    color: theme?.colors?.primaryLight
                }
            }
        },
        MuiDivider: {
            styleOverrides: {
                root: {
                    borderColor: outlineSubtle,
                    opacity: 1
                }
            }
        },
        MuiAvatar: {
            styleOverrides: {
                root: {
                    color: theme?.colors?.primaryDark,
                    background: alpha(theme?.colors?.primaryMain || '#2a6fe8', 0.18)
                }
            }
        },
        MuiChip: {
            styleOverrides: {
                root: {
                    borderRadius: 8,
                    border: `1px solid ${outlineSubtle}`,
                    '&.MuiChip-deletable .MuiChip-deleteIcon': {
                        color: 'inherit'
                    }
                }
            }
        },
        MuiTooltip: {
            styleOverrides: {
                tooltip: {
                    color: isDark ? theme?.colors?.darkTextPrimary : theme?.colors?.grey900,
                    background: isDark ? alpha('#0d1f35', 0.98) : alpha('#f4f8ff', 0.98),
                    border: `1px solid ${outlineSubtle}`,
                    boxShadow: `0 8px 20px ${alpha('#020617', isDark ? 0.45 : 0.14)}`
                }
            }
        },
        MuiAutocomplete: {
            styleOverrides: {
                option: {
                    transition: 'background-color 120ms ease',
                    '&:hover': {
                        background: alpha(theme?.menuSelected || '#2a6fe8', 0.11)
                    }
                },
                paper: {
                    border: `1px solid ${outlineSubtle}`,
                    backgroundColor: surfaceRaised
                }
            }
        },
        MuiTableCell: {
            styleOverrides: {
                root: {
                    borderColor: outlineSubtle
                },
                head: {
                    color: theme?.darkTextSecondary,
                    fontWeight: 650,
                    backgroundColor: alpha(theme?.menuSelected || '#2a6fe8', 0.07)
                }
            }
        },
        MuiTableRow: {
            styleOverrides: {
                root: {
                    '&.MuiTableRow-hover:hover': {
                        backgroundColor: alpha(theme?.menuSelected || '#2a6fe8', 0.06)
                    }
                }
            }
        },
        MuiDrawer: {
            styleOverrides: {
                paper: {
                    backgroundImage: isDark
                        ? `linear-gradient(180deg, ${alpha('#0d2d4d', 0.24)} 0%, ${surfaceRaised} 70%)`
                        : `linear-gradient(180deg, ${alpha('#eaf2ff', 0.86)} 0%, ${surfaceRaised} 75%)`
                }
            }
        }
    }
}
