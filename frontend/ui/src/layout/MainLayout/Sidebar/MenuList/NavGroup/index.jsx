import PropTypes from 'prop-types'

// material-ui
import { useTheme } from '@mui/material/styles'
import { Divider, List, Typography } from '@mui/material'

// project imports
import NavItem from '../NavItem'
import NavCollapse from '../NavCollapse'
import { useAuth } from '@/hooks/useAuth'
import { Available } from '@/ui-component/rbac/available'
import { getMenuChildren } from '../menuUtils'

// ==============================|| SIDEBAR MENU LIST GROUP ||============================== //

const NavGroup = ({ item, isCollapsed = false }) => {
    const theme = useTheme()
    const { hasPermission, hasDisplay } = useAuth()

    const listItems = (menu, level = 1) => {
        if (!menu) return null

        // Filter based on display and permission
        if (!shouldDisplayMenu(menu)) return null

        // Handle item and group types
        switch (menu.type) {
            case 'collapse':
                return <NavCollapse key={menu.id} menu={menu} level={level} isCollapsed={isCollapsed} />
            case 'item':
                return <NavItem key={menu.id} item={menu} level={level} navType='MENU' isCollapsed={isCollapsed} />
            case 'group':
                return getMenuChildren(menu).map((child) => listItems(child, level + 1))
            default:
                return (
                    <Typography key={menu.id} variant='h6' color='error' align='center'>
                        Menu Items Error
                    </Typography>
                )
        }
    }

    const shouldDisplayMenu = (menu) => {
        if (!menu) return false

        // Handle permission check
        if (menu.permission && !hasPermission(menu.permission)) {
            return false // Do not render if permission is lacking
        }

        // If `display` is defined, check against cloud/enterprise conditions
        if (menu.display) {
            const shouldsiplay = hasDisplay(menu.display)
            return shouldsiplay
        }

        // If `display` is not defined, display by default
        return true
    }

    const renderPrimaryItems = () => {
        const children = getMenuChildren(item)
        const primaryGroup = children.find((child) => child?.id === 'primary')

        if (primaryGroup) return getMenuChildren(primaryGroup)

        // Backward-compatible fallback: render standalone primary items if menu
        // schema does not provide a dedicated `primary` group.
        return children.filter((child) => child?.type === 'item' || child?.type === 'collapse')
    }

    const renderNonPrimaryGroups = () => {
        const children = getMenuChildren(item)
        const hasPrimaryGroup = children.some((child) => child?.id === 'primary')
        let nonprimaryGroups = children.filter((child) => child?.type === 'group' && (!hasPrimaryGroup || child.id !== 'primary'))
        // Display children based on permission and display
        nonprimaryGroups = nonprimaryGroups.map((group) => {
            const groupChildren = getMenuChildren(group).filter((menu) => shouldDisplayMenu(menu))
            return { ...group, children: groupChildren }
        })
        // Get rid of group with empty children
        nonprimaryGroups = nonprimaryGroups.filter((group) => group.children.length > 0)
        return nonprimaryGroups
    }

    return (
        <>
            <List
                subheader={
                    item.title &&
                    !isCollapsed && (
                        <Typography variant='caption' sx={{ ...theme.typography.menuCaption }} display='block' gutterBottom>
                            {item.title}
                            {item.caption && (
                                <Typography variant='caption' sx={{ ...theme.typography.subMenuCaption }} display='block' gutterBottom>
                                    {item.caption}
                                </Typography>
                            )}
                        </Typography>
                    )
                }
                sx={{
                    px: isCollapsed ? 1 : 2,
                    py: 2,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 1
                }}
            >
                {renderPrimaryItems().map((menu) => listItems(menu))}
            </List>

            {renderNonPrimaryGroups().map((group) => {
                const groupPermissions = group.children.map((menu) => menu.permission).join(',')
                return (
                    <Available key={group.id} permission={groupPermissions}>
                        <>
                            <Divider sx={{ height: '1px', borderColor: theme.palette.outline?.subtle || theme.palette.divider, my: 0 }} />
                            <List
                                subheader={
                                    !isCollapsed ? (
                                        <Typography variant='caption' sx={{ ...theme.typography.subMenuCaption }} display='block' gutterBottom>
                                            {group.title}
                                        </Typography>
                                    ) : null
                                }
                                sx={{ px: isCollapsed ? 1 : 2, py: 2, display: 'flex', flexDirection: 'column', gap: 1 }}
                            >
                                {group.children.map((menu) => listItems(menu))}
                            </List>
                        </>
                    </Available>
                )
            })}
        </>
    )
}

NavGroup.propTypes = {
    item: PropTypes.object,
    isCollapsed: PropTypes.bool
}

export default NavGroup
