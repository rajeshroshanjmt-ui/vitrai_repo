import PropTypes from 'prop-types'

import { Box, Button, Card, IconButton, Stack, Typography, useTheme } from '@mui/material'
import { IconCopy, IconRefresh } from '@tabler/icons-react'

const ErrorBoundary = ({ error, onRetry }) => {
    const theme = useTheme()
    const statusCode = error?.response?.status || error?.status || 'Unknown'
    const errorMessage = error?.response?.data?.message || error?.message || 'Unexpected error'
    const errorDetails = `Status: ${statusCode}\n${errorMessage}`

    const copyToClipboard = () => {
        navigator.clipboard.writeText(errorDetails)
    }

    const handleRetry = () => {
        if (onRetry) {
            onRetry()
            return
        }
        window.location.reload()
    }

    return (
        <Box sx={{ border: 1, borderColor: theme.palette.grey[900] + 25, borderRadius: 2, padding: '20px', maxWidth: '1280px' }}>
            <Stack flexDirection='column' sx={{ alignItems: 'center', gap: 3 }}>
                <Stack flexDirection='column' sx={{ alignItems: 'center', gap: 1 }}>
                    <Typography variant='h2'>Oh snap!</Typography>
                    <Typography variant='h3'>The following error occurred when loading this page.</Typography>
                </Stack>
                <Card variant='outlined'>
                    <Box sx={{ position: 'relative', px: 2, py: 3 }}>
                        <IconButton
                            onClick={copyToClipboard}
                            size='small'
                            sx={{ position: 'absolute', top: 1, right: 1, color: theme.palette.grey[900] + 25 }}
                        >
                            <IconCopy />
                        </IconButton>
                        <pre style={{ margin: 0, overflowWrap: 'break-word', whiteSpace: 'pre-wrap', textAlign: 'center' }}>
                            <code>{`Status: ${statusCode}`}</code>
                            <br />
                            <code>{errorMessage}</code>
                        </pre>
                    </Box>
                </Card>
                <Button variant='outlined' startIcon={<IconRefresh size={16} />} onClick={handleRetry}>
                    Retry
                </Button>
                <Typography variant='body1' sx={{ fontSize: '1.1rem', textAlign: 'center', lineHeight: '1.5' }}>
                    Please retry after some time. If the issue persists, reach out to us on our Discord server.
                    <br />
                    Alternatively, you can raise an issue on Github.
                </Typography>
            </Stack>
        </Box>
    )
}

ErrorBoundary.propTypes = {
    error: PropTypes.object,
    onRetry: PropTypes.func
}

export default ErrorBoundary
