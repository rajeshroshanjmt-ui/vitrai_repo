import PropTypes from 'prop-types'
import { Component } from 'react'

import { Box, Button, Paper, Stack, Typography } from '@mui/material'
import { IconCopy, IconRefresh } from '@tabler/icons-react'

class RuntimeErrorBoundary extends Component {
    constructor(props) {
        super(props)
        this.state = {
            hasError: false,
            errorMessage: ''
        }
    }

    static getDerivedStateFromError(error) {
        return {
            hasError: true,
            errorMessage: error?.message || 'Unexpected runtime error'
        }
    }

    componentDidCatch(error, info) {
        // Keep this log for production incident debugging.
        console.error('RuntimeErrorBoundary captured an error:', error, info)
    }

    handleReload = () => {
        window.location.reload()
    }

    handleRetry = () => {
        this.setState({ hasError: false, errorMessage: '' })
    }

    handleCopyError = () => {
        navigator.clipboard.writeText(this.state.errorMessage || 'Runtime error')
    }

    render() {
        if (!this.state.hasError) {
            return this.props.children
        }

        return (
            <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', p: 3 }}>
                <Paper elevation={2} sx={{ maxWidth: 640, width: '100%', p: 3 }}>
                    <Stack spacing={2}>
                        <Typography variant='h3'>Something went wrong</Typography>
                        <Typography variant='body2' color='text.secondary'>
                            A runtime error interrupted the interface. Reload to recover.
                        </Typography>
                        <Box
                            sx={{
                                p: 2,
                                borderRadius: 1,
                                border: 1,
                                borderColor: 'divider',
                                backgroundColor: 'background.default',
                                fontFamily: 'monospace',
                                fontSize: '0.8rem',
                                wordBreak: 'break-word'
                            }}
                        >
                            {this.state.errorMessage}
                        </Box>
                        <Box sx={{ display: 'flex', gap: 1 }}>
                            <Button variant='outlined' startIcon={<IconRefresh size={16} />} onClick={this.handleRetry}>
                                Try again
                            </Button>
                            <Button variant='contained' startIcon={<IconRefresh size={16} />} onClick={this.handleReload}>
                                Reload application
                            </Button>
                            <Button variant='text' startIcon={<IconCopy size={16} />} onClick={this.handleCopyError}>
                                Copy error
                            </Button>
                        </Box>
                    </Stack>
                </Paper>
            </Box>
        )
    }
}

RuntimeErrorBoundary.propTypes = {
    children: PropTypes.node
}

export default RuntimeErrorBoundary
