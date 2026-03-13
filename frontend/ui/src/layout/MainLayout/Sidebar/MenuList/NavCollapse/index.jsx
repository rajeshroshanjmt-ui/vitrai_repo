import PropTypes from 'prop-types'
import { useState } from 'react'
import { useSelector } from 'react-redux'

// material-ui
import { useTheme } from '@mui/material/styles'
import { Collapse, List, ListItemButton, ListItemIcon, ListItemText, Tooltip, Typography } from '@mui/material'

// project imports
import NavItem from '../NavItem'

// assets
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord'
import { IconChevronDown, IconChevronUp } from '@tabler/icons-react'

// ==============================|| SIDEBAR MENU LIST COLLAPSE ITEMS ||============================== //

const NavCollapse = ({ menu, level, isCollapsed = false }) => {
    const theme = useTheme()
    const customization = useSelector((state) => state.customization)

    const [open, setOpen] = useState(false)
    const [selected, setSelected] = useState(null)

    const handleClick = () => {
        setOpen(!open)
        setSelected(!selected ? menu.id : null)
    }

    // menu collapse & item
    const menus = menu.children?.map((item) => {
        switch (item.type) {
            case 'collapse':
                return <NavCollapse key={item.id} menu={item} level={level + 1} isCollapsed={isCollapsed} />
            case 'item':
                return <NavItem key={item.id} item={item} level={level + 1} isCollapsed={isCollapsed} />
            default:
                return (
                    <Typography key={item.id} variant='h6' color='error' align='center'>
                        Menu Items Error
                    </Typography>
                )
        }
    })

    const Icon = menu.icon
    const menuIcon = menu.icon ? (
        <Icon strokeWidth={1.5} size='1.3rem' style={{ marginTop: 'auto', marginBottom: 'auto' }} />
    ) : (
        <FiberManualRecordIcon
            sx={{
                width: selected === menu.id ? 8 : 6,
                height: selected === menu.id ? 8 : 6
            }}
            fontSize={level > 0 ? 'inherit' : 'medium'}
        />
    )

    const collapseButton = (
        <ListItemButton
            sx={{
                borderRadius: `${customization.borderRadius}px`,
                mb: 0.6,
                alignItems: 'center',
                justifyContent: isCollapsed ? 'center' : 'flex-start',
                backgroundColor: level > 1 ? 'transparent !important' : 'inherit',
                py: level > 1 ? 1 : 1.25,
                px: isCollapsed ? 1 : 2,
                pl: isCollapsed ? 1 : `${level * 24}px`
            }}
            selected={selected === menu.id}
            onClick={handleClick}
        >
            <ListItemIcon sx={{ my: 'auto', minWidth: isCollapsed ? 'auto' : !menu.icon ? 18 : 36 }}>{menuIcon}</ListItemIcon>
            {!isCollapsed && (
                <ListItemText
                    primary={
                        <Typography variant={selected === menu.id ? 'h5' : 'body1'} color='inherit' sx={{ my: 'auto' }}>
                            {menu.title}
                        </Typography>
                    }
                    secondary={
                        menu.caption && (
                            <Typography variant='caption' sx={{ ...theme.typography.subMenuCaption }} display='block' gutterBottom>
                                {menu.caption}
                            </Typography>
                        )
                    }
                />
            )}
            {!isCollapsed &&
                (open ? (
                    <IconChevronUp stroke={1.5} size='1rem' style={{ marginTop: 'auto', marginBottom: 'auto' }} />
                ) : (
                    <IconChevronDown stroke={1.5} size='1rem' style={{ marginTop: 'auto', marginBottom: 'auto' }} />
                ))}
        </ListItemButton>
    )

    return (
        <>
            {isCollapsed ? (
                <Tooltip title={menu.title || ''} placement='right'>
                    {collapseButton}
                </Tooltip>
            ) : (
                collapseButton
            )}
            <Collapse in={open} timeout='auto' unmountOnExit>
                <List
                    component='div'
                    disablePadding
                    sx={{
                        position: 'relative',
                        '&:after': {
                            content: "''",
                            position: 'absolute',
                            left: '34px',
                            top: 6,
                            height: 'calc(100% - 12px)',
                            width: '1px',
                            opacity: 0.5,
                            background: `linear-gradient(180deg, ${theme.palette.outline?.subtle || theme.palette.divider} 0%, transparent 100%)`
                        }
                    }}
                >
                    {menus}
                </List>
            </Collapse>
        </>
    )
}

NavCollapse.propTypes = {
    menu: PropTypes.object,
    level: PropTypes.number,
    isCollapsed: PropTypes.bool
}

export default NavCollapse
