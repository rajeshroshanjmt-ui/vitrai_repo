import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import PropTypes from 'prop-types'
import { Stack, Typography, Dialog, DialogContent, DialogTitle, DialogActions, Box } from '@mui/material'
import CredentialInputHandler from '@/views/canvas/CredentialInputHandler'
import { Dropdown } from '@/ui-component/dropdown/Dropdown'
import { StyledButton } from '@/ui-component/button/StyledButton'
import assistantsApi from '@/api/assistants'
import useApi from '@/hooks/useApi'

const LoadAssistantDialog = ({
    show,
    dialogProps,
    onCancel,
    onAssistantSelected,
    setError,
    providerType = 'OPENAI',
    providerLabel = 'OpenAI',
    credentialNames = ['openAIApi']
}) => {
    const portalElement = document.getElementById('portal')

    const getAllAvailableAssistantsApi = useApi(assistantsApi.getAllAvailableAssistants)

    const [credentialId, setCredentialId] = useState('')
    const [availableAssistantsOptions, setAvailableAssistantsOptions] = useState([])
    const [selectedAssistantId, setSelectedAssistantId] = useState('')

    useEffect(() => {
        return () => {
            setCredentialId('')
            setAvailableAssistantsOptions([])
            setSelectedAssistantId('')
        }
    }, [dialogProps])

    useEffect(() => {
        if (getAllAvailableAssistantsApi.data && getAllAvailableAssistantsApi.data.length) {
            const assistants = []
            for (let i = 0; i < getAllAvailableAssistantsApi.data.length; i += 1) {
                assistants.push({
                    label: getAllAvailableAssistantsApi.data[i].name,
                    name: getAllAvailableAssistantsApi.data[i].id,
                    description: getAllAvailableAssistantsApi.data[i].instructions
                })
            }
            setAvailableAssistantsOptions(assistants)
        }
    }, [getAllAvailableAssistantsApi.data])

    useEffect(() => {
        if (getAllAvailableAssistantsApi.error && setError) {
            setError(getAllAvailableAssistantsApi.error)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [getAllAvailableAssistantsApi.error])

    const component = show ? (
        <Dialog
            fullWidth
            maxWidth='xs'
            open={show}
            onClose={onCancel}
            aria-labelledby='alert-dialog-title'
            aria-describedby='alert-dialog-description'
        >
            <DialogTitle sx={{ fontSize: '1rem' }} id='alert-dialog-title'>
                {dialogProps.title}
            </DialogTitle>
            <DialogContent>
                <Box sx={{ p: 2 }}>
                    <Stack sx={{ position: 'relative' }} direction='row'>
                            <Typography variant='overline'>
                                {`${providerLabel} Credential`}
                                <span style={{ color: 'red' }}>&nbsp;*</span>
                            </Typography>
                    </Stack>
                    <CredentialInputHandler
                        key={credentialId}
                        data={credentialId ? { credential: credentialId } : {}}
                        inputParam={{
                            label: 'Connect Credential',
                            name: 'credential',
                            type: 'credential',
                            credentialNames
                        }}
                        onSelect={(newValue) => {
                            setCredentialId(newValue)
                            if (newValue) getAllAvailableAssistantsApi.request(newValue, providerType)
                        }}
                    />
                </Box>
                {credentialId && (
                    <Box sx={{ p: 2 }}>
                        <Stack sx={{ position: 'relative' }} direction='row'>
                            <Typography variant='overline'>
                                Assistants
                                <span style={{ color: 'red' }}>&nbsp;*</span>
                            </Typography>
                        </Stack>
                        <Dropdown
                            name={selectedAssistantId}
                            options={availableAssistantsOptions}
                            onSelect={(newValue) => setSelectedAssistantId(newValue)}
                            value={selectedAssistantId ?? 'choose an option'}
                        />
                    </Box>
                )}
            </DialogContent>
            {selectedAssistantId && (
                <DialogActions>
                    <StyledButton variant='contained' onClick={() => onAssistantSelected(selectedAssistantId, credentialId)}>
                        Load
                    </StyledButton>
                </DialogActions>
            )}
        </Dialog>
    ) : null

    return createPortal(component, portalElement)
}

LoadAssistantDialog.propTypes = {
    show: PropTypes.bool,
    dialogProps: PropTypes.object,
    onCancel: PropTypes.func,
    onAssistantSelected: PropTypes.func,
    setError: PropTypes.func,
    providerType: PropTypes.string,
    providerLabel: PropTypes.string,
    credentialNames: PropTypes.array
}

export default LoadAssistantDialog
