import { useEffect, useState, useCallback, useRef, useContext } from 'react'
import ReactFlow, { Controls, Background, useNodesState, useEdgesState } from 'reactflow'
import 'reactflow/dist/style.css'
import '@/views/canvas/index.css'

import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useSelector } from 'react-redux'

// material-ui
import { Toolbar, Box, AppBar, Typography } from '@mui/material'
import { useTheme } from '@mui/material/styles'

// project imports
import AgentFlowNode from './AgentFlowNode'
import AgentFlowEdge from './AgentFlowEdge'
import IterationNode from './IterationNode'
import MarketplaceCanvasHeader from '@/views/marketplaces/MarketplaceCanvasHeader'
import StickyNote from './StickyNote'
import EditNodeDialog from '@/views/agentflowsv2/EditNodeDialog'
import { flowContext } from '@/store/context/ReactFlowContext'

// API
import marketplacesApi from '@/api/marketplaces'

// Hooks
import useApi from '@/hooks/useApi'

// icons
import { IconMagnetFilled, IconMagnetOff, IconArtboard, IconArtboardOff } from '@tabler/icons-react'

const nodeTypes = { agentFlow: AgentFlowNode, stickyNote: StickyNote, iteration: IterationNode }
const edgeTypes = { agentFlow: AgentFlowEdge }

// ==============================|| CANVAS ||============================== //

const MarketplaceCanvasV2 = () => {
    const theme = useTheme()
    const navigate = useNavigate()
    const { id } = useParams()
    const customization = useSelector((state) => state.customization)

    const { state } = useLocation()
    const [flowData, setFlowData] = useState(state?.flowData ?? null)
    const [flowName, setFlowName] = useState(state?.templateName ?? state?.name ?? 'Marketplace Template')
    const [templateUnavailable, setTemplateUnavailable] = useState(false)
    const getAllTemplatesMarketplacesApi = useApi(marketplacesApi.getAllTemplatesFromMarketplaces)

    // ==============================|| ReactFlow ||============================== //

    const [nodes, setNodes, onNodesChange] = useNodesState()
    const [edges, setEdges, onEdgesChange] = useEdgesState()
    const [editNodeDialogOpen, setEditNodeDialogOpen] = useState(false)
    const [editNodeDialogProps, setEditNodeDialogProps] = useState({})
    const [isSnappingEnabled, setIsSnappingEnabled] = useState(false)
    const [isBackgroundEnabled, setIsBackgroundEnabled] = useState(true)

    const reactFlowWrapper = useRef(null)
    const { setReactFlowInstance } = useContext(flowContext)

    // ==============================|| useEffect ||============================== //

    useEffect(() => {
        if (!flowData && id) {
            getAllTemplatesMarketplacesApi.request()
        }

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [flowData, id])

    useEffect(() => {
        if (!getAllTemplatesMarketplacesApi.data || flowData) return

        const templates = Array.isArray(getAllTemplatesMarketplacesApi.data) ? getAllTemplatesMarketplacesApi.data : []
        const selectedTemplate = templates.find((template) => template?.id === id)
        if (!selectedTemplate) {
            setTemplateUnavailable(true)
            return
        }
        setFlowData(selectedTemplate.flowData || null)
        setFlowName(selectedTemplate.templateName || selectedTemplate.name || 'Marketplace Template')
    }, [getAllTemplatesMarketplacesApi.data, flowData, id])

    useEffect(() => {
        if (flowData) {
            const initialFlow = JSON.parse(flowData)
            setNodes(initialFlow.nodes || [])
            setEdges(initialFlow.edges || [])
        } else {
            setNodes([])
            setEdges([])
        }

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [flowData])

    const onChatflowCopy = (flowData) => {
        const templateFlowData = JSON.stringify(flowData)
        navigate('/v2/agentcanvas', { state: { templateFlowData } })
    }

    // eslint-disable-next-line
    const onNodeDoubleClick = useCallback((event, node) => {
        if (!node || !node.data) return
        if (node.data.name === 'stickyNoteAgentflow') {
            // dont show dialog
        } else {
            const inputParams = Array.isArray(node.data.inputParams) ? node.data.inputParams : []
            const dialogProps = {
                data: node.data,
                inputParams: inputParams.filter((inputParam) => !inputParam?.hidden),
                disabled: true
            }

            setEditNodeDialogProps(dialogProps)
            setEditNodeDialogOpen(true)
        }
    })

    return (
        <>
            <Box>
                <AppBar
                    enableColorOnDark
                    position='fixed'
                    color='inherit'
                    elevation={1}
                    sx={{
                        bgcolor: theme.palette.background.default
                    }}
                >
                    <Toolbar>
                        <MarketplaceCanvasHeader
                            flowName={flowName}
                            flowData={flowData ? JSON.parse(flowData) : { nodes: [], edges: [] }}
                            onChatflowCopy={(flowData) => onChatflowCopy(flowData)}
                        />
                    </Toolbar>
                </AppBar>
                <Box sx={{ pt: '70px', height: '100vh', width: '100%' }}>
                    {!flowData && templateUnavailable && (
                        <Box sx={{ p: 2 }}>
                            <Typography color='text.secondary'>Template unavailable. Please open it from Marketplace list.</Typography>
                        </Box>
                    )}
                    <div className='reactflow-parent-wrapper'>
                        <div className='reactflow-wrapper' ref={reactFlowWrapper}>
                            <ReactFlow
                                nodes={nodes}
                                edges={edges}
                                onNodesChange={onNodesChange}
                                onEdgesChange={onEdgesChange}
                                onNodeDoubleClick={onNodeDoubleClick}
                                onInit={setReactFlowInstance}
                                nodeTypes={nodeTypes}
                                edgeTypes={edgeTypes}
                                fitView
                                minZoom={0.1}
                                snapGrid={[25, 25]}
                                snapToGrid={isSnappingEnabled}
                            >
                                <Controls
                                    className={customization.isDarkMode ? 'dark-mode-controls' : ''}
                                    style={{
                                        display: 'flex',
                                        flexDirection: 'row',
                                        left: '50%',
                                        transform: 'translate(-50%, -50%)'
                                    }}
                                >
                                    <button
                                        className='react-flow__controls-button react-flow__controls-interactive'
                                        onClick={() => {
                                            setIsSnappingEnabled(!isSnappingEnabled)
                                        }}
                                        title='toggle snapping'
                                        aria-label='toggle snapping'
                                    >
                                        {isSnappingEnabled ? <IconMagnetFilled /> : <IconMagnetOff />}
                                    </button>
                                    <button
                                        className='react-flow__controls-button react-flow__controls-interactive'
                                        onClick={() => {
                                            setIsBackgroundEnabled(!isBackgroundEnabled)
                                        }}
                                        title='toggle background'
                                        aria-label='toggle background'
                                    >
                                        {isBackgroundEnabled ? <IconArtboard /> : <IconArtboardOff />}
                                    </button>
                                </Controls>
                                {isBackgroundEnabled && <Background color='#aaa' gap={16} />}
                                <EditNodeDialog
                                    show={editNodeDialogOpen}
                                    dialogProps={editNodeDialogProps}
                                    onCancel={() => setEditNodeDialogOpen(false)}
                                />
                            </ReactFlow>
                        </div>
                    </div>
                </Box>
            </Box>
        </>
    )
}

export default MarketplaceCanvasV2
