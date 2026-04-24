import React from 'react'
import PropTypes from 'prop-types'

import { Box, Button, Card, IconButton, Stack, Typography } from '@mui/material'
import { IconCopy, IconRefresh } from '@tabler/icons-react'

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props)
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null,
        }
    }

    static getDerivedStateFromError(error) {
        return { hasError: true }
    }

    componentDidCatch(error, errorInfo) {
        this.setState({
            error,
            errorInfo,
        })
        console.error('Error caught by boundary:', error, errorInfo)
    }

    copyToClipboard = () => {
        const { error } = this.state
        const statusCode = error?.response?.status || error?.status || 'Unknown'
        const errorMessage = error?.response?.data?.message || error?.message || error?.toString() || 'Unexpected error'
        const errorDetails = `Status: ${statusCode}\nMessage: ${errorMessage}`
        navigator.clipboard.writeText(errorDetails)
    }

    handleRetry = () => {
        if (this.props.onRetry) {
            this.props.onRetry()
        } else {
            this.setState({ hasError: false, error: null, errorInfo: null })
            window.location.reload()
        }
    }

    render() {
        if (this.state.hasError) {
            const { error } = this.state
            const statusCode = error?.response?.status || error?.status || 'Unknown'
            const errorMessage = error?.response?.data?.message || error?.message || error?.toString() || 'Unexpected error'

            return (
                <Box sx={{ border: 1, borderColor: 'grey.900', borderRadius: 2, padding: '20px', maxWidth: '1280px' }}>
                    <Stack flexDirection='column' sx={{ alignItems: 'center', gap: 3 }}>
                        <Stack flexDirection='column' sx={{ alignItems: 'center', gap: 1 }}>
                            <Typography variant='h2'>Oh snap!</Typography>
                            <Typography variant='h3'>The following error occurred when loading this page.</Typography>
                        </Stack>
                        <Card variant='outlined'>
                            <Box sx={{ position: 'relative', px: 2, py: 3 }}>
                                <IconButton
                                    onClick={this.copyToClipboard}
                                    size='small'
                                    sx={{ position: 'absolute', top: 1, right: 1 }}
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
                        <Button variant='outlined' startIcon={<IconRefresh size={16} />} onClick={this.handleRetry}>
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

        return this.props.children
    }
}

ErrorBoundary.propTypes = {
    children: PropTypes.node,
    onRetry: PropTypes.func,
}

export default ErrorBoundary
