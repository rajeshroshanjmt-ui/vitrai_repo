import { createPortal } from 'react-dom'
import PropTypes from 'prop-types'
import { useState, useEffect } from 'react'
import { useDispatch } from 'react-redux'
import {
    HIDE_CANVAS_DIALOG,
    SHOW_CANVAS_DIALOG,
    enqueueSnackbar as enqueueSnackbarAction,
    closeSnackbar as closeSnackbarAction
} from '@/store/actions'
import { v4 as uuidv4 } from 'uuid'

// Material
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Box, Typography, OutlinedInput, FormControl, InputLabel, Select, MenuItem } from '@mui/material'

// Project imports
import { StyledButton } from '@/ui-component/button/StyledButton'
import ConfirmDialog from '@/ui-component/dialog/ConfirmDialog'
import { CUSTOM_ASSISTANT_PROFILES, DEFAULT_CUSTOM_ASSISTANT_PROFILE, getCustomAssistantProfile } from './assistantProfiles'

// Icons
import { IconX, IconFiles } from '@tabler/icons-react'

// API
import assistantsApi from '@/api/assistants'

// utils
import useNotifier from '@/utils/useNotifier'

const AddCustomAssistantDialog = ({ show, dialogProps, onCancel, onConfirm }) => {
    const portalElement = document.getElementById('portal')

    const dispatch = useDispatch()

    // ==============================|| Snackbar ||============================== //

    useNotifier()

    const enqueueSnackbar = (...args) => dispatch(enqueueSnackbarAction(...args))
    const closeSnackbar = (...args) => dispatch(closeSnackbarAction(...args))

    const [customAssistantName, setCustomAssistantName] = useState('')
    const [selectedProfileId, setSelectedProfileId] = useState(DEFAULT_CUSTOM_ASSISTANT_PROFILE.id)

    useEffect(() => {
        if (show) {
            setSelectedProfileId(DEFAULT_CUSTOM_ASSISTANT_PROFILE.id)
            setCustomAssistantName(DEFAULT_CUSTOM_ASSISTANT_PROFILE.defaultName)
        }
    }, [show])

    useEffect(() => {
        if (show) dispatch({ type: SHOW_CANVAS_DIALOG })
        else dispatch({ type: HIDE_CANVAS_DIALOG })
        return () => dispatch({ type: HIDE_CANVAS_DIALOG })
    }, [show, dispatch])

    const createCustomAssistant = async () => {
        try {
            const selectedProfile = getCustomAssistantProfile(selectedProfileId)
            const assistantName = customAssistantName.trim() || selectedProfile.defaultName
            const obj = {
                details: JSON.stringify({
                    name: assistantName,
                    instruction: selectedProfile.instruction,
                    profileId: selectedProfile.id,
                    profileLabel: selectedProfile.label,
                    qualityPreset: 'real_world_v1'
                }),
                credential: uuidv4(),
                type: 'CUSTOM'
            }
            const createResp = await assistantsApi.createNewAssistant(obj)
            if (createResp.data) {
                enqueueSnackbar({
                    message: 'New Custom Assistant created.',
                    options: {
                        key: new Date().getTime() + Math.random(),
                        variant: 'success',
                        action: (key) => (
                            <Button style={{ color: 'white' }} onClick={() => closeSnackbar(key)}>
                                <IconX />
                            </Button>
                        )
                    }
                })
                onConfirm(createResp.data.id)
            }
        } catch (err) {
            enqueueSnackbar({
                message: `Failed to add new Custom Assistant: ${
                    typeof err.response.data === 'object' ? err.response.data.message : err.response.data
                }`,
                options: {
                    key: new Date().getTime() + Math.random(),
                    variant: 'error',
                    persist: true,
                    action: (key) => (
                        <Button style={{ color: 'white' }} onClick={() => closeSnackbar(key)}>
                            <IconX />
                        </Button>
                    )
                }
            })
            onCancel()
        }
    }

    const component = show ? (
        <Dialog
            fullWidth
            maxWidth='sm'
            open={show}
            onClose={onCancel}
            aria-labelledby='alert-dialog-title'
            aria-describedby='alert-dialog-description'
        >
            <DialogTitle style={{ fontSize: '1rem' }} id='alert-dialog-title'>
                <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
                    <IconFiles style={{ marginRight: '10px' }} />
                    {dialogProps.title}
                </div>
            </DialogTitle>
            <DialogContent>
                <Box sx={{ p: 2 }}>
                    <div style={{ display: 'flex', flexDirection: 'row' }}>
                        <Typography>
                            Name<span style={{ color: 'red' }}>&nbsp;*</span>
                        </Typography>

                        <div style={{ flexGrow: 1 }}></div>
                    </div>
                    <OutlinedInput
                        id='custom-assistant-name'
                        size='small'
                        sx={{ mt: 1 }}
                        type='string'
                        fullWidth
                        key='customAssistantName'
                        onChange={(e) => setCustomAssistantName(e.target.value)}
                        value={customAssistantName ?? ''}
                    />
                </Box>
                <Box sx={{ p: 2, pt: 0 }}>
                    <Typography sx={{ mb: 1 }}>
                        Use Case Template<span style={{ color: 'red' }}>&nbsp;*</span>
                    </Typography>
                    <FormControl size='small' fullWidth>
                        <InputLabel id='assistant-profile-label'>Use Case</InputLabel>
                        <Select
                            labelId='assistant-profile-label'
                            id='assistant-profile-select'
                            value={selectedProfileId}
                            label='Use Case'
                            onChange={(event) => {
                                const nextProfileId = event.target.value
                                const nextProfile = getCustomAssistantProfile(nextProfileId)
                                setSelectedProfileId(nextProfileId)
                                if (!customAssistantName.trim() || customAssistantName === getCustomAssistantProfile(selectedProfileId).defaultName) {
                                    setCustomAssistantName(nextProfile.defaultName)
                                }
                            }}
                        >
                            {CUSTOM_ASSISTANT_PROFILES.map((profile) => (
                                <MenuItem key={profile.id} value={profile.id}>
                                    {profile.label}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                    <Typography variant='caption' sx={{ mt: 1, display: 'block', opacity: 0.85 }}>
                        {getCustomAssistantProfile(selectedProfileId).summary}
                    </Typography>
                </Box>
            </DialogContent>
            <DialogActions>
                <Button onClick={() => onCancel()}>Cancel</Button>
                <StyledButton disabled={!customAssistantName} variant='contained' onClick={() => createCustomAssistant()}>
                    {dialogProps.confirmButtonName}
                </StyledButton>
            </DialogActions>
            <ConfirmDialog />
        </Dialog>
    ) : null

    return createPortal(component, portalElement)
}

AddCustomAssistantDialog.propTypes = {
    show: PropTypes.bool,
    dialogProps: PropTypes.object,
    onCancel: PropTypes.func,
    onConfirm: PropTypes.func
}

export default AddCustomAssistantDialog
