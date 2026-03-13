import PropTypes from 'prop-types'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

// material-ui
import { Box, Dialog, DialogContent, DialogTitle, InputAdornment, List, ListItemButton, ListItemIcon, ListItemText, OutlinedInput, Typography } from '@mui/material'

// project imports
import config from '@/config'
import { menuItems } from '@/menu-items'
import { getMenuChildren } from '@/layout/MainLayout/Sidebar/MenuList/menuUtils'
import { useAuth } from '@/hooks/useAuth'

// icons
import { IconSearch } from '@tabler/icons-react'

const flattenMenuItems = (menus, hasPermission, hasDisplay, breadcrumbs = []) => {
    const commands = []

    menus.forEach((menu) => {
        if (!menu) return

        if (menu.permission && !hasPermission(menu.permission)) return
        if (menu.display && !hasDisplay(menu.display)) return

        if (menu.type === 'item' && menu.url) {
            commands.push({
                id: menu.id,
                title: menu.title || menu.id,
                subtitle: breadcrumbs.filter(Boolean).join(' / '),
                url: menu.url,
                icon: menu.icon,
                external: menu.external
            })
            return
        }

        const nextBreadcrumbs = menu.title ? [...breadcrumbs, menu.title] : breadcrumbs
        const children = getMenuChildren(menu)
        if (children.length) {
            commands.push(...flattenMenuItems(children, hasPermission, hasDisplay, nextBreadcrumbs))
        }
    })

    return commands
}

const CommandPaletteDialog = ({ open, onClose }) => {
    const [query, setQuery] = useState('')
    const navigate = useNavigate()
    const { hasPermission, hasDisplay } = useAuth()

    const commands = useMemo(() => flattenMenuItems(menuItems.items, hasPermission, hasDisplay), [hasPermission, hasDisplay])

    const filteredCommands = useMemo(() => {
        const keyword = query.trim().toLowerCase()
        if (!keyword) return commands

        return commands.filter((command) => {
            const title = String(command.title || '').toLowerCase()
            const subtitle = String(command.subtitle || '').toLowerCase()
            return title.includes(keyword) || subtitle.includes(keyword)
        })
    }, [commands, query])

    const onSelectCommand = (command) => {
        if (command.external) {
            window.open(command.url, '_blank', 'noopener,noreferrer')
        } else {
            navigate(`${config.basename}${command.url}`)
        }
        onClose()
        setQuery('')
    }

    const onDialogClose = () => {
        onClose()
        setQuery('')
    }

    return (
        <Dialog fullWidth maxWidth='sm' open={open} onClose={onDialogClose} aria-labelledby='command-palette-title'>
            <DialogTitle id='command-palette-title' sx={{ pb: 1 }}>
                Command Palette
            </DialogTitle>
            <DialogContent sx={{ pt: 1 }}>
                <OutlinedInput
                    autoFocus
                    fullWidth
                    size='small'
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder='Search pages and actions'
                    startAdornment={
                        <InputAdornment position='start'>
                            <IconSearch size={16} />
                        </InputAdornment>
                    }
                />
                <List sx={{ mt: 1, maxHeight: 420, overflowY: 'auto' }}>
                    {filteredCommands.length === 0 ? (
                        <Box sx={{ px: 1, py: 2 }}>
                            <Typography variant='body2' color='text.secondary'>
                                No matching commands
                            </Typography>
                        </Box>
                    ) : (
                        filteredCommands.slice(0, 25).map((command) => {
                            const Icon = command.icon
                            return (
                                <ListItemButton key={command.id} onClick={() => onSelectCommand(command)}>
                                    <ListItemIcon>{Icon ? <Icon size={18} /> : null}</ListItemIcon>
                                    <ListItemText primary={command.title} secondary={command.subtitle || command.url} />
                                </ListItemButton>
                            )
                        })
                    )}
                </List>
            </DialogContent>
        </Dialog>
    )
}

CommandPaletteDialog.propTypes = {
    open: PropTypes.bool,
    onClose: PropTypes.func
}

export default CommandPaletteDialog
