/**
 * Typography used in theme
 * @param {JsonObject} theme theme customization object
 */

export default function themeTypography(theme) {
    return {
        fontFamily: theme?.customization?.fontFamily,
        fontWeightLight: 400,
        fontWeightRegular: 400,
        fontWeightMedium: 500,
        fontWeightBold: 700,
        h6: {
            fontWeight: 600,
            color: theme.heading,
            fontSize: '0.875rem',
            lineHeight: 1.35,
            letterSpacing: '-0.01em'
        },
        h5: {
            fontSize: '1rem',
            color: theme.heading,
            fontWeight: 600,
            lineHeight: 1.4,
            letterSpacing: '-0.01em'
        },
        h4: {
            fontSize: '1.125rem',
            color: theme.heading,
            fontWeight: 600,
            lineHeight: 1.4,
            letterSpacing: '-0.015em'
        },
        h3: {
            fontSize: '1.375rem',
            color: theme.heading,
            fontWeight: 700,
            lineHeight: 1.3,
            letterSpacing: '-0.02em'
        },
        h2: {
            fontSize: '1.875rem',
            color: theme.heading,
            fontWeight: 700,
            lineHeight: 1.15,
            letterSpacing: '-0.03em'
        },
        h1: {
            fontSize: '2.25rem',
            color: theme.heading,
            fontWeight: 800,
            letterSpacing: '-0.035em',
            lineHeight: 1.05
        },
        subtitle1: {
            fontSize: '0.9375rem',
            fontWeight: 600,
            color: theme.textDark
        },
        subtitle2: {
            fontSize: '0.8125rem',
            fontWeight: 600,
            color: theme.darkTextSecondary
        },
        caption: {
            fontSize: '0.75rem',
            color: theme.darkTextSecondary,
            fontWeight: 500,
            letterSpacing: '0.01em'
        },
        body1: {
            fontSize: '0.9375rem',
            fontWeight: 400,
            lineHeight: 1.65,
            color: theme.darkTextPrimary
        },
        body2: {
            fontSize: '0.875rem',
            letterSpacing: '0.005em',
            fontWeight: 400,
            lineHeight: 1.6,
            color: theme.darkTextPrimary
        },
        button: {
            textTransform: 'none',
            fontWeight: 600,
            letterSpacing: '0.01em'
        },
        customInput: {
            marginTop: 1,
            marginBottom: 1,
            '& > label': {
                top: 23,
                left: 0,
                color: theme.grey500,
                '&[data-shrink="false"]': {
                    top: 5
                }
            },
            '& > div > input': {
                padding: '30.5px 14px 11.5px !important'
            },
            '& legend': {
                display: 'none'
            },
            '& fieldset': {
                top: 0
            }
        },
        mainContent: {
            backgroundColor: 'transparent',
            width: '100%',
            minHeight: 'calc(100vh - 64px)',
            flexGrow: 1,
            padding: '24px',
            marginTop: '64px',
            marginRight: '0px',
            borderRadius: `${theme?.customization?.borderRadius}px`
        },
        menuCaption: {
            fontSize: '0.6875rem',
            fontWeight: 700,
            color: theme.darkTextSecondary,
            padding: '4px 6px',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            marginTop: '6px'
        },
        subMenuCaption: {
            fontSize: '0.72rem',
            fontWeight: 600,
            color: theme.darkTextSecondary,
            textTransform: 'uppercase',
            letterSpacing: '0.06em'
        },
        commonAvatar: {
            cursor: 'pointer',
            borderRadius: '8px'
        },
        smallAvatar: {
            width: '22px',
            height: '22px',
            fontSize: '1rem'
        },
        mediumAvatar: {
            width: '34px',
            height: '34px',
            fontSize: '1.2rem'
        },
        largeAvatar: {
            width: '44px',
            height: '44px',
            fontSize: '1.5rem'
        }
    }
}
