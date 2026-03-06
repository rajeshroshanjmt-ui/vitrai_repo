/**
 * Color intention that you want to used in your theme
 * @param {JsonObject} theme Theme customization object
 */

export default function themePalette(theme) {
    const isDark = theme.customization.isDarkMode
    const semantic = theme.semantic || {}

    return {
        mode: isDark ? 'dark' : 'light',
        divider: semantic.outline?.subtle || theme.divider,
        transparent: theme.colors?.transparent,
        common: {
            black: isDark ? theme.colors?.darkBackground : theme.colors?.grey900,
            dark: isDark ? theme.colors?.darkPrimaryMain : theme.colors?.primaryMain,
            white: theme.colors?.paper
        },
        primary: {
            light: isDark ? theme.colors?.darkPrimaryLight : theme.colors?.primaryLight,
            main: isDark ? theme.colors?.darkPrimaryMain : theme.colors?.primaryMain,
            dark: isDark ? theme.colors?.darkPrimaryDark : theme.colors?.primaryDark,
            200: isDark ? theme.colors?.darkPrimary200 : theme.colors?.primary200,
            800: isDark ? theme.colors?.darkPrimary800 : theme.colors?.primary800
        },
        secondary: {
            light: isDark ? theme.colors?.darkSecondaryLight : theme.colors?.secondaryLight,
            main: isDark ? theme.colors?.darkSecondaryMain : theme.colors?.secondaryMain,
            dark: isDark ? theme.colors?.darkSecondaryDark : theme.colors?.secondaryDark,
            200: isDark ? theme.colors?.darkSecondary200 : theme.colors?.secondary200,
            800: isDark ? theme.colors?.darkSecondary800 : theme.colors?.secondary800
        },
        error: {
            light: theme.colors?.errorLight,
            main: theme.colors?.errorMain,
            dark: theme.colors?.errorDark
        },
        orange: {
            light: theme.colors?.orangeLight,
            main: theme.colors?.orangeMain,
            dark: theme.colors?.orangeDark
        },
        teal: {
            light: theme.colors?.tealLight,
            main: theme.colors?.tealMain,
            dark: theme.colors?.tealDark
        },
        warning: {
            light: theme.colors?.warningLight,
            main: theme.colors?.warningMain,
            dark: theme.colors?.warningDark
        },
        success: {
            light: theme.colors?.successLight,
            200: theme.colors?.success200,
            main: theme.colors?.successMain,
            dark: theme.colors?.successDark
        },
        grey: {
            50: theme.colors?.grey50,
            100: theme.colors?.grey100,
            200: theme.colors?.grey200,
            300: theme.colors?.grey300,
            400: theme.colors?.grey400,
            500: theme.colors?.grey500,
            600: theme.heading,
            700: theme.darkTextSecondary,
            900: theme.textDark
        },
        dark: {
            light: theme.colors?.darkTextPrimary,
            main: theme.colors?.darkLevel1,
            dark: theme.colors?.darkLevel2,
            800: theme.colors?.darkBackground,
            900: theme.colors?.darkPaper
        },
        text: {
            primary: theme.darkTextPrimary,
            secondary: theme.darkTextSecondary,
            dark: theme.textDark,
            hint: theme.colors?.grey100
        },
        background: {
            paper: theme.paper,
            default: theme.backgroundDefault
        },
        brand: semantic.brand,
        surface: semantic.surface,
        outline: semantic.outline,
        glow: semantic.glow,
        focusRing: semantic.focusRing,
        textBackground: {
            main: isDark ? semantic.surface?.sunken : theme.colors?.grey50,
            border: semantic.outline?.subtle || theme.colors?.grey400
        },
        card: {
            main: semantic.surface?.raised || theme.paper,
            light: semantic.surface?.base || theme.backgroundDefault,
            hover: semantic.surface?.sunken || theme.paper
        },
        asyncSelect: {
            main: semantic.surface?.sunken || theme.colors?.grey50
        },
        timeMessage: {
            main: isDark ? theme.colors?.darkLevel2 : theme.colors?.grey200
        },
        canvasHeader: {
            deployLight: theme.colors?.primaryLight,
            deployDark: theme.colors?.primaryDark,
            saveLight: theme.colors?.secondaryLight,
            saveDark: theme.colors?.secondaryDark,
            settingsLight: theme.colors?.grey300,
            settingsDark: theme.colors?.grey700
        },
        codeEditor: {
            main: isDark ? theme.colors?.darkLevel2 : theme.colors?.primaryLight
        },
        nodeToolTip: {
            background: semantic.surface?.raised || theme.paper,
            color: isDark ? theme.colors?.darkTextPrimary : 'rgba(0, 0, 0, 0.87)'
        }
    }
}
