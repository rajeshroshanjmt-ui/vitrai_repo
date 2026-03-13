import PropTypes from 'prop-types'

import { Box, Button, Paper, Skeleton, Stack, Typography } from '@mui/material'
import { IconRefresh } from '@tabler/icons-react'

const LoadingState = ({ skeletonRows }) => (
    <Stack spacing={1.25}>
        {Array.from({ length: skeletonRows }).map((_, index) => (
            <Paper key={`state-loading-${index}`} variant='outlined' sx={{ p: 1.75 }}>
                <Stack spacing={1}>
                    <Skeleton width='42%' height={24} />
                    <Skeleton width='88%' height={18} />
                </Stack>
            </Paper>
        ))}
    </Stack>
)

LoadingState.propTypes = {
    skeletonRows: PropTypes.number
}

const StateView = ({ mode, title, description, actionLabel, onAction, action, skeletonRows, sx }) => {
    if (mode === 'loading') {
        return <LoadingState skeletonRows={skeletonRows} />
    }

    return (
        <Paper variant='outlined' sx={{ p: 3, ...sx }}>
            <Stack spacing={1.25}>
                <Typography variant='h4'>{title}</Typography>
                {description ? (
                    <Typography variant='body2' color='text.secondary'>
                        {description}
                    </Typography>
                ) : null}
                <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
                    {onAction ? (
                        <Button variant='outlined' startIcon={<IconRefresh size={16} />} onClick={onAction}>
                            {actionLabel}
                        </Button>
                    ) : null}
                    {action}
                </Box>
            </Stack>
        </Paper>
    )
}

StateView.propTypes = {
    mode: PropTypes.oneOf(['loading', 'empty', 'error']),
    title: PropTypes.string,
    description: PropTypes.string,
    actionLabel: PropTypes.string,
    onAction: PropTypes.func,
    action: PropTypes.node,
    skeletonRows: PropTypes.number,
    sx: PropTypes.object
}

StateView.defaultProps = {
    mode: 'empty',
    title: 'Nothing to show',
    description: '',
    actionLabel: 'Retry',
    onAction: undefined,
    action: null,
    skeletonRows: 3,
    sx: {}
}

export default StateView
