import { Link } from 'react-router-dom'

// material-ui
import { ButtonBase } from '@mui/material'

// project imports
import config from '@/config'
import Logo from '@/ui-component/extended/Logo'

// ==============================|| MAIN LOGO ||============================== //

const LogoSection = () => (
    <ButtonBase
        disableRipple
        component={Link}
        to={config.defaultPath}
        sx={{
            alignItems: 'center',
            display: 'inline-flex',
            height: 56,
            justifyContent: 'flex-start',
            px: 1,
            width: '100%'
        }}
    >
        <Logo />
    </ButtonBase>
)

export default LogoSection
