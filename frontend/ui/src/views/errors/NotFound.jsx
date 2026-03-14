import { useNavigate } from 'react-router-dom'
import { Box, Button, Container, Typography, useTheme } from '@mui/material'
import { IconArrowLeft } from '@tabler/icons-react'

const NotFound = () => {
    const theme = useTheme()
    const navigate = useNavigate()

    return (
        <Box
            sx={{
                display: 'flex',
                flexDirection: 'column',
                minHeight: '100vh',
                alignItems: 'center',
                justifyContent: 'center',
                background:
                    theme.palette.mode === 'dark'
                        ? 'radial-gradient(circle at top right, rgba(71, 98, 130, 0.35), rgba(15, 23, 42, 1) 55%)'
                        : 'radial-gradient(circle at top right, rgba(66, 165, 245, 0.18), rgba(248, 250, 252, 1) 58%)'
            }}
        >
            <Container maxWidth='md'>
                <Box sx={{ textAlign: 'center', py: 6 }}>
                    <Typography
                        variant='h1'
                        sx={{
                            fontSize: { xs: '3rem', sm: '4rem', md: '5rem' },
                            fontWeight: 700,
                            mb: 2,
                            color: theme.palette.primary.main
                        }}
                    >
                        404
                    </Typography>

                    <Typography variant='h3' sx={{ mb: 2, fontWeight: 600 }}>
                        Page Not Found
                    </Typography>

                    <Typography
                        variant='body1'
                        sx={{
                            mb: 4,
                            color: theme.palette.text.secondary,
                            fontSize: '1.1rem'
                        }}
                    >
                        The page you're looking for doesn't exist or has been moved.
                    </Typography>

                    <Button
                        variant='contained'
                        size='large'
                        startIcon={<IconArrowLeft />}
                        onClick={() => navigate('/dashboard')}
                        sx={{
                            textTransform: 'none',
                            fontSize: '1rem',
                            px: 4,
                            py: 1.5
                        }}
                    >
                        Go to Dashboard
                    </Button>
                </Box>
            </Container>
        </Box>
    )
}

export default NotFound
