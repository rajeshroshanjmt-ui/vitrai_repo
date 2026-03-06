import PropTypes from 'prop-types'
import { forwardRef } from 'react'

// material-ui
import { Card, CardContent, CardHeader, Divider, Typography } from '@mui/material'

// constant
const headerSX = {
    '& .MuiCardHeader-action': { mr: 0 }
}

// ==============================|| CUSTOM MAIN CARD ||============================== //

const MainCard = forwardRef(function MainCard(
    {
        boxShadow,
        children,
        content = true,
        contentClass = '',
        contentSX = {
            px: 2,
            py: 0
        },
        darkTitle,
        maxWidth = 'full',
        secondary,
        shadow,
        sx = {},
        title,
        ...others
    },
    ref
) {
    const otherProps = { ...others, border: others.border === false ? undefined : others.border }
    return (
        <Card
            ref={ref}
            {...otherProps}
            sx={{
                background: (theme) => theme.palette.surface?.raised || theme.palette.background.paper,
                border: (theme) => `1px solid ${theme.palette.outline?.subtle || theme.palette.divider}`,
                boxShadow: (theme) => `0 10px 28px ${theme.palette.glow?.soft || 'rgba(0,0,0,0.08)'}`,
                transition: 'transform 170ms ease, box-shadow 170ms ease, border-color 170ms ease',
                ':hover': {
                    transform: boxShadow ? 'translateY(-1px)' : 'none',
                    borderColor: (theme) => theme.palette.outline?.strong || theme.palette.divider,
                    boxShadow: boxShadow ? shadow || '0 16px 32px 0 rgb(10 22 37 / 20%)' : 'inherit'
                },
                maxWidth: maxWidth === 'sm' ? '800px' : maxWidth === 'md' ? '960px' : '1280px',
                mx: 'auto',
                ...sx
            }}
        >
            {/* card header and action */}
            {!darkTitle && title && <CardHeader sx={headerSX} title={title} action={secondary} />}
            {darkTitle && title && <CardHeader sx={headerSX} title={<Typography variant='h3'>{title}</Typography>} action={secondary} />}

            {/* content & header divider */}
            {title && <Divider />}

            {/* card content */}
            {content && (
                <CardContent sx={contentSX} className={contentClass}>
                    {children}
                </CardContent>
            )}
            {!content && children}
        </Card>
    )
})

MainCard.propTypes = {
    border: PropTypes.bool,
    boxShadow: PropTypes.bool,
    maxWidth: PropTypes.oneOf(['full', 'sm', 'md']),
    children: PropTypes.node,
    content: PropTypes.bool,
    contentClass: PropTypes.string,
    contentSX: PropTypes.object,
    darkTitle: PropTypes.bool,
    secondary: PropTypes.oneOfType([PropTypes.node, PropTypes.string, PropTypes.object]),
    shadow: PropTypes.string,
    sx: PropTypes.object,
    title: PropTypes.oneOfType([PropTypes.node, PropTypes.string, PropTypes.object])
}

export default MainCard
