import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

// material-ui
import { Box, Skeleton, Stack, ToggleButton, ToggleButtonGroup } from '@mui/material'
import { useTheme } from '@mui/material/styles'

// project imports
import MainCard from '@/ui-component/cards/MainCard'
import ItemCard from '@/ui-component/cards/ItemCard'
import { gridSpacing } from '@/store/constant'
import WorkflowEmptySVG from '@/assets/images/workflow_empty.svg'
import ConfirmDialog from '@/ui-component/dialog/ConfirmDialog'
import { FlowListTable } from '@/ui-component/table/FlowListTable'
import { StyledPermissionButton } from '@/ui-component/button/RBACButtons'
import ViewHeader from '@/layout/MainLayout/ViewHeader'
import ErrorBoundary from '@/ErrorBoundary'
import TablePagination, { DEFAULT_ITEMS_PER_PAGE } from '@/ui-component/pagination/TablePagination'

// API
import chatflowsApi from '@/api/chatflows'

// Hooks
import useApi from '@/hooks/useApi'

// const
import { baseURL } from '@/store/constant'
import { useError } from '@/store/context/ErrorContext'

// icons
import { IconPlus, IconLayoutGrid, IconList } from '@tabler/icons-react'

// ==============================|| CHATFLOWS ||============================== //

const Chatflows = () => {
    const navigate = useNavigate()
    const theme = useTheme()

    const [isLoading, setLoading] = useState(true)
    const [images, setImages] = useState({})
    const [search, setSearch] = useState('')
    const { error, setError } = useError()

    const getAllChatflowsApi = useApi(chatflowsApi.getAllChatflows)
    const [view, setView] = useState(localStorage.getItem('flowDisplayStyle') || 'card')

    /* Table Pagination */
    const [currentPage, setCurrentPage] = useState(1)
    const [pageLimit, setPageLimit] = useState(DEFAULT_ITEMS_PER_PAGE)
    const [total, setTotal] = useState(0)

    const onChange = (page, pageLimit) => {
        setCurrentPage(page)
        setPageLimit(pageLimit)
        applyFilters(page, pageLimit)
    }

    const applyFilters = (page, limit) => {
        const params = {
            page: page || currentPage,
            limit: limit || pageLimit
        }
        getAllChatflowsApi.request(params)
    }

    const handleChange = (event, nextView) => {
        if (nextView === null) return
        localStorage.setItem('flowDisplayStyle', nextView)
        setView(nextView)
    }

    const onSearchChange = (event) => {
        setSearch(event.target.value)
    }

    function filterFlows(data) {
        const name = String(data?.name || '').toLowerCase()
        const category = String(data?.category || '').toLowerCase()
        const id = String(data?.id || '').toLowerCase()
        const query = search.toLowerCase()
        return (
            name.indexOf(query) > -1 ||
            category.indexOf(query) > -1 ||
            id.indexOf(query) > -1
        )
    }

    const addNew = () => {
        navigate('/canvas')
    }

    const goToCanvas = (selectedChatflow) => {
        navigate(`/canvas/${selectedChatflow.id}`)
    }

    useEffect(() => {
        applyFilters(currentPage, pageLimit)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    useEffect(() => {
        setLoading(getAllChatflowsApi.loading)
    }, [getAllChatflowsApi.loading])

    useEffect(() => {
        if (getAllChatflowsApi.data) {
            try {
                const chatflows = Array.isArray(getAllChatflowsApi.data?.data) ? getAllChatflowsApi.data.data : []
                const total = Number(getAllChatflowsApi.data?.total ?? chatflows.length)
                setTotal(total)
                const images = {}
                for (let i = 0; i < chatflows.length; i += 1) {
                    const flowDataStr = chatflows[i].flowData
                    const flowData = typeof flowDataStr === 'string' ? JSON.parse(flowDataStr) : flowDataStr || {}
                    const nodes = Array.isArray(flowData?.nodes) ? flowData.nodes : []
                    images[chatflows[i].id] = []
                    for (let j = 0; j < nodes.length; j += 1) {
                        const nodeName = nodes[j]?.data?.name
                        const nodeLabel = nodes[j]?.data?.label
                        if (!nodeName) continue
                        if (nodeName === 'stickyNote' || nodeName === 'stickyNoteAgentflow') continue
                        const imageSrc = `${baseURL}/api/v1/node-icon/${nodeName}`
                        if (!images[chatflows[i].id].some((img) => img.imageSrc === imageSrc)) {
                            images[chatflows[i].id].push({
                                imageSrc,
                                label: nodeLabel
                            })
                        }
                    }
                }
                setImages(images)
            } catch (e) {
                console.error(e)
            }
        }
    }, [getAllChatflowsApi.data])

    return (
        <MainCard>
            {error ? (
                <ErrorBoundary error={error} />
            ) : (
                <Stack flexDirection='column' sx={{ gap: 3 }}>
                    <ViewHeader
                        onSearchChange={onSearchChange}
                        search={true}
                        searchPlaceholder='Search Name or Category'
                        title='Chatflows'
                        description='Build single-agent systems, chatbots and simple LLM flows'
                    >
                        <ToggleButtonGroup
                            sx={{ borderRadius: 2, maxHeight: 40 }}
                            value={view}
                            color='primary'
                            disabled={total === 0}
                            exclusive
                            onChange={handleChange}
                        >
                            <ToggleButton
                                sx={{
                                    borderColor: theme.palette.grey[900] + 25,
                                    borderRadius: 2,
                                    color: theme?.customization?.isDarkMode ? 'white' : 'inherit'
                                }}
                                variant='contained'
                                value='card'
                                title='Card View'
                            >
                                <IconLayoutGrid />
                            </ToggleButton>
                            <ToggleButton
                                sx={{
                                    borderColor: theme.palette.grey[900] + 25,
                                    borderRadius: 2,
                                    color: theme?.customization?.isDarkMode ? 'white' : 'inherit'
                                }}
                                variant='contained'
                                value='list'
                                title='List View'
                            >
                                <IconList />
                            </ToggleButton>
                        </ToggleButtonGroup>
                        <StyledPermissionButton
                            data-testid='chatflows-add-new'
                            permissionId={'chatflows:create'}
                            variant='contained'
                            onClick={addNew}
                            startIcon={<IconPlus />}
                            sx={{ borderRadius: 2, height: 40 }}
                        >
                            Add New
                        </StyledPermissionButton>
                    </ViewHeader>

                    {isLoading && (
                        <Box display='grid' gridTemplateColumns='repeat(3, 1fr)' gap={gridSpacing}>
                            <Skeleton variant='rounded' height={160} />
                            <Skeleton variant='rounded' height={160} />
                            <Skeleton variant='rounded' height={160} />
                        </Box>
                    )}
                    {!isLoading && total > 0 && (
                        <>
                            {!view || view === 'card' ? (
                                <Box data-testid='chatflows-grid' display='grid' gridTemplateColumns='repeat(3, 1fr)' gap={gridSpacing}>
                                    {getAllChatflowsApi.data?.data?.filter(filterFlows).map((data, index) => (
                                        <ItemCard key={index} onClick={() => goToCanvas(data)} data={data} images={images[data.id]} />
                                    ))}
                                </Box>
                            ) : (
                                <FlowListTable data-testid='chatflows-table'
                                    data={getAllChatflowsApi.data?.data}
                                    images={images}
                                    isLoading={isLoading}
                                    filterFunction={filterFlows}
                                    updateFlowsApi={getAllChatflowsApi}
                                    setError={setError}
                                    currentPage={currentPage}
                                    pageLimit={pageLimit}
                                />
                            )}
                            {/* Pagination and Page Size Controls */}
                            <TablePagination currentPage={currentPage} limit={pageLimit} total={total} onChange={onChange} />
                        </>
                    )}
                    {!isLoading && (!getAllChatflowsApi.data?.data || getAllChatflowsApi.data?.data.length === 0) && (
                        <Stack sx={{ alignItems: 'center', justifyContent: 'center' }} flexDirection='column'>
                            <Box sx={{ p: 2, height: 'auto' }}>
                                <img
                                    style={{ objectFit: 'cover', height: '25vh', width: 'auto' }}
                                    src={WorkflowEmptySVG}
                                    alt='WorkflowEmptySVG'
                                />
                            </Box>
                            <div>No Chatflows Yet</div>
                        </Stack>
                    )}
                </Stack>
            )}
            <ConfirmDialog />
        </MainCard>
    )
}

export default Chatflows
