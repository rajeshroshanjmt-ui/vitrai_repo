import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { omit } from 'lodash'

// MUI
import { Alert, Box, Button, CircularProgress, Stack } from '@mui/material'
import { IconArrowLeft } from '@tabler/icons-react'

// Project imports
import MainCard from '@/ui-component/cards/MainCard'
import ViewHeader from '@/layout/MainLayout/ViewHeader'
import { ExecutionDetails } from './ExecutionDetails'
import { parseExecutionData } from './executionUtils'

// API
import executionsApi from '@/api/executions'

// Hooks
import useApi from '@/hooks/useApi'

const ExecutionDetailsPage = () => {
    const { id: executionId } = useParams()
    const navigate = useNavigate()

    const [execution, setExecution] = useState([])
    const [metadata, setMetadata] = useState({})

    const getExecutionByIdApi = useApi(executionsApi.getExecutionById)

    useEffect(() => {
        if (executionId) {
            getExecutionByIdApi.request(executionId)
        }

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [executionId])

    useEffect(() => {
        const executionResponse = getExecutionByIdApi.data
        if (executionResponse === undefined) return

        if (!executionResponse) {
            setExecution([])
            setMetadata({})
            return
        }

        setExecution(parseExecutionData(executionResponse.executionData))
        setMetadata(omit(executionResponse, ['executionData']))
    }, [getExecutionByIdApi.data])

    const refreshExecution = (id) => {
        getExecutionByIdApi.request(id || executionId)
    }

    return (
        <MainCard>
            <Stack spacing={2}>
                <Button
                    size='small'
                    variant='outlined'
                    onClick={() => navigate('/executions')}
                    startIcon={<IconArrowLeft size={16} />}
                    sx={{ alignSelf: 'flex-start' }}
                >
                    Back to Executions
                </Button>

                <ViewHeader title='Execution Details' description='Node trace, logs, tokens, and error diagnostics for one run' />

                {getExecutionByIdApi.loading ? (
                    <Box sx={{ minHeight: '60vh', display: 'grid', placeItems: 'center' }}>
                        <CircularProgress size={48} />
                    </Box>
                ) : getExecutionByIdApi.error || !metadata?.id ? (
                    <Alert severity='error'>Execution not found or inaccessible.</Alert>
                ) : (
                    <ExecutionDetails
                        renderAsPage
                        execution={execution}
                        metadata={metadata}
                        onProceedSuccess={() => refreshExecution()}
                        onUpdateSharing={() => refreshExecution()}
                        onRefresh={refreshExecution}
                    />
                )}
            </Stack>
        </MainCard>
    )
}

export default ExecutionDetailsPage
