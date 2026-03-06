import { createTheme } from '@mui/material/styles'

// assets
import colors from '@/assets/scss/_themes-vars.module.scss'

// project imports
import componentStyleOverrides from './compStyleOverride'
import themePalette from './palette'
import themeTypography from './typography'

/**
 * Represent theme style and structure as per Material-UI
 * @param {JsonObject} customization customization parameter object
 */

export const theme = (customization) => {
    const color = colors

    const sharedSemantic = customization.isDarkMode
        ? {
              brand: {
                  light: color.darkBrandLight,
                  main: color.darkBrandMain,
                  dark: color.darkBrandDark
              },
              surface: {
                  base: color.surfaceBaseDark,
                  raised: color.surfaceRaisedDark,
                  sunken: color.surfaceSunkenDark
              },
              outline: {
                  subtle: color.outlineSubtleDark,
                  strong: color.outlineStrongDark
              },
              glow: {
                  soft: color.glowSoftDark,
                  elevated: color.glowElevatedDark
              },
              focusRing: {
                  main: color.focusRingDark
              }
          }
        : {
              brand: {
                  light: color.brandLight,
                  main: color.brandMain,
                  dark: color.brandDark
              },
              surface: {
                  base: color.surfaceBaseLight,
                  raised: color.surfaceRaisedLight,
                  sunken: color.surfaceSunkenLight
              },
              outline: {
                  subtle: color.outlineSubtleLight,
                  strong: color.outlineStrongLight
              },
              glow: {
                  soft: color.glowSoftLight,
                  elevated: color.glowElevatedLight
              },
              focusRing: {
                  main: color.focusRingLight
              }
          }

    const themeOption = customization.isDarkMode
        ? {
              colors: color,
              semantic: sharedSemantic,
              heading: color.darkTextTitle,
              paper: color.surfaceRaisedDark,
              backgroundDefault: color.surfaceBaseDark,
              background: color.surfaceSunkenDark,
              darkTextPrimary: color.darkTextPrimary,
              darkTextSecondary: color.darkTextSecondary,
              textDark: color.darkTextTitle,
              menuSelected: color.darkBrandMain,
              menuSelectedBack: color.outlineSubtleDark,
              divider: color.outlineSubtleDark,
              customization
          }
        : {
              colors: color,
              semantic: sharedSemantic,
              heading: color.grey900,
              paper: color.surfaceRaisedLight,
              backgroundDefault: color.surfaceBaseLight,
              background: color.surfaceSunkenLight,
              darkTextPrimary: color.grey900,
              darkTextSecondary: color.grey600,
              textDark: color.grey900,
              menuSelected: color.brandDark,
              menuSelectedBack: color.outlineSubtleLight,
              divider: color.outlineSubtleLight,
              customization
          }

    const themeOptions = {
        direction: 'ltr',
        palette: themePalette(themeOption),
        mixins: {
            toolbar: {
                minHeight: '48px',
                padding: '16px',
                '@media (min-width: 600px)': {
                    minHeight: '48px'
                }
            }
        },
        typography: themeTypography(themeOption)
    }

    const themes = createTheme(themeOptions)
    themes.components = componentStyleOverrides(themeOption)

    return themes
}

export default theme
