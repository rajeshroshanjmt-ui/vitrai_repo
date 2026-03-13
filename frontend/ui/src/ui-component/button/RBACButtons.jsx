import * as PropTypes from 'prop-types'
import { useAuth } from '@/hooks/useAuth'
import { StyledButton, StyledToggleButton } from '@/ui-component/button/StyledButton'
import { Button, IconButton, ListItemButton, MenuItem, Tab } from '@mui/material'

export const StyledPermissionButton = ({ permissionId, display, ...props }) => {
    const { hasPermission, hasDisplay } = useAuth()

    if (!hasPermission(permissionId) || !hasDisplay(display)) {
        return null
    }

    return <StyledButton {...props} />
}

export const StyledPermissionToggleButton = ({ permissionId, display, ...props }) => {
    const { hasPermission, hasDisplay } = useAuth()

    if (!hasPermission(permissionId) || !hasDisplay(display)) {
        return null
    }

    return <StyledToggleButton {...props} />
}

export const PermissionIconButton = ({ permissionId, display, ...props }) => {
    const { hasPermission, hasDisplay } = useAuth()

    if (!hasPermission(permissionId) || !hasDisplay(display)) {
        return null
    }

    return <IconButton {...props} />
}

export const PermissionButton = ({ permissionId, display, ...props }) => {
    const { hasPermission, hasDisplay } = useAuth()

    if (!hasPermission(permissionId) || !hasDisplay(display)) {
        return null
    }

    return <Button {...props} />
}

export const PermissionTab = ({ permissionId, display, ...props }) => {
    const { hasPermission, hasDisplay } = useAuth()

    if (!hasPermission(permissionId) || !hasDisplay(display)) {
        return null
    }

    return <Tab {...props} />
}

export const PermissionMenuItem = ({ permissionId, display, ...props }) => {
    const { hasPermission, hasDisplay } = useAuth()

    if (!hasPermission(permissionId) || !hasDisplay(display)) {
        return null
    }

    return <MenuItem {...props} />
}

export const PermissionListItemButton = ({ permissionId, display, ...props }) => {
    const { hasPermission, hasDisplay } = useAuth()

    if (!hasPermission(permissionId) || !hasDisplay(display)) {
        return null
    }

    return <ListItemButton {...props} />
}

const displayPropType = PropTypes.oneOfType([PropTypes.string, PropTypes.arrayOf(PropTypes.string)])

StyledPermissionButton.propTypes = { permissionId: PropTypes.string, display: displayPropType }
StyledPermissionToggleButton.propTypes = { permissionId: PropTypes.string, display: displayPropType }
PermissionIconButton.propTypes = { permissionId: PropTypes.string, display: displayPropType }
PermissionButton.propTypes = { permissionId: PropTypes.string, display: displayPropType }
PermissionTab.propTypes = { permissionId: PropTypes.string, display: displayPropType }
PermissionMenuItem.propTypes = { permissionId: PropTypes.string, display: displayPropType }
PermissionListItemButton.propTypes = { permissionId: PropTypes.string, display: displayPropType }
