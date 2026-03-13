import logo from '@/assets/images/logo.png'
import { Box } from '@mui/material'

// ==============================|| LOGO ||============================== //

const Logo = () => {
    return (
        <Box sx={{ alignItems: 'center', display: 'flex', width: '100%' }}>
            <Box
                component='img'
                src={logo}
                alt='Vetrai'
                sx={{
                    display: 'block',
                    height: 'auto',
                    maxWidth: 65,
                    objectFit: 'contain',
                    width: '100%'
                }}
            />
        </Box>
    )
}

export default Logo
