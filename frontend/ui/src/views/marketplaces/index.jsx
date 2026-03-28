import * as React from 'react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDispatch } from 'react-redux'

// material-ui
import {
    Box,
    Stack,
    Badge,
    ToggleButton,
    InputLabel,
    FormControl,
    Select,
    OutlinedInput,
    Checkbox,
    ListItemText,
    Skeleton,
    FormControlLabel,
    ToggleButtonGroup,
    MenuItem,
    Button,
    Tabs,
    Autocomplete,
    TextField,
    Chip,
    Tooltip,
    Typography,
    Divider,
    Grid,
    Pagination
} from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { alpha } from '@mui/material/styles'
import { IconLayoutGrid, IconList, IconX, IconMessageCircleFilled, IconRobot, IconSparkles } from '@tabler/icons-react'
import vetraiLogo from '@/assets/images/logo.png'

// project imports
import MainCard from '@/ui-component/cards/MainCard'
import ItemCard from '@/ui-component/cards/ItemCard'
import WorkflowEmptySVG from '@/assets/images/workflow_empty.svg'
import ToolDialog from '@/views/tools/ToolDialog'
import { MarketplaceTable } from '@/ui-component/table/MarketplaceTable'
import ViewHeader from '@/layout/MainLayout/ViewHeader'
import ErrorBoundary from '@/ErrorBoundary'
import { TabPanel } from '@/ui-component/tabs/TabPanel'
import { closeSnackbar as closeSnackbarAction, enqueueSnackbar as enqueueSnackbarAction } from '@/store/actions'
import ConfirmDialog from '@/ui-component/dialog/ConfirmDialog'
import { PermissionTab } from '@/ui-component/button/RBACButtons'
import { Available } from '@/ui-component/rbac/available'
import ShareWithWorkspaceDialog from '@/ui-component/dialog/ShareWithWorkspaceDialog'

// API
import marketplacesApi from '@/api/marketplaces'

// Hooks
import useApi from '@/hooks/useApi'
import useConfirm from '@/hooks/useConfirm'
import { useAuth } from '@/hooks/useAuth'

// Utils
import useNotifier from '@/utils/useNotifier'

// const
import { baseURL, AGENTFLOW_ICONS } from '@/store/constant'
import { gridSpacing } from '@/store/constant'
import { useError } from '@/store/context/ErrorContext'

const badges = ['POPULAR', 'NEW']
const types = ['Chatflow', 'AgentflowV2', 'Assistant', 'Tool']
const framework = ['Langchain', 'Langgraph', 'LlamaIndex', 'Assistant Runtime']
const difficulties = ['Beginner', 'Intermediate', 'Advanced']

// Category configuration - icon references resolved at render time
const getCategoryTiles = (icons) => [
    { key: 'all',        label: 'All Templates', icon: icons.grid,    color: '#059669' },
    { key: 'Chatflow',   label: 'Chatflows',      icon: icons.message, color: '#2563eb' },
    { key: 'Agentflow',  label: 'Agentflows',     icon: icons.robot,   color: '#0891b2' },
    { key: 'Assistant',  label: 'Assistants',     icon: icons.sparkle, color: '#7c3aed' },
]

const MenuProps = {
    PaperProps: {
        style: {
            width: 160
        }
    }
}

// Helper to get featured templates (POPULAR badge and Beginner difficulty)
const getFeaturedTemplates = (templates) => {
    return templates
        .filter((t) => t.badge === 'POPULAR' || t.difficulty === 'Beginner')
        .sort((a, b) => {
            if (a.badge === 'POPULAR' && b.badge !== 'POPULAR') return -1
            if (b.badge === 'POPULAR' && a.badge !== 'POPULAR') return 1
            return 0
        })
        .slice(0, 6)
}

// Helper to get difficulty color
const getDifficultyColor = (difficulty, theme) => {
    switch (difficulty) {
        case 'Beginner':
            return theme.palette.success.main
        case 'Intermediate':
            return theme.palette.warning.main
        case 'Advanced':
            return theme.palette.error.main
        default:
            return theme.palette.grey[500]
    }
}

// ==============================|| Marketplace ||============================== //

const Marketplace = () => {
    const navigate = useNavigate()
    const dispatch = useDispatch()
    useNotifier()

    const theme = useTheme()
    const { error, setError } = useError()

    const [isLoading, setLoading] = useState(true)
    const [images, setImages] = useState({})
    const [icons, setIcons] = useState({})
    const [usecases, setUsecases] = useState([])
    const [eligibleUsecases, setEligibleUsecases] = useState([])
    const [selectedUsecases, setSelectedUsecases] = useState([])

    const [showToolDialog, setShowToolDialog] = useState(false)
    const [toolDialogProps, setToolDialogProps] = useState({})

    const getAllTemplatesMarketplacesApi = useApi(marketplacesApi.getAllTemplatesFromMarketplaces)

    const ITEMS_PER_PAGE = 24
    const [currentPage, setCurrentPage] = useState(1)
    const [view, setView] = React.useState(localStorage.getItem('mpDisplayStyle') || 'card')
    const [search, setSearch] = useState('')
    const [searchSuggestions, setSearchSuggestions] = useState([])
    const [recentSearches, setRecentSearches] = useState(
        JSON.parse(localStorage.getItem('mpRecentSearches') || '[]').slice(0, 5)
    )
    const [showSearchSuggestions, setShowSearchSuggestions] = useState(false)
    const [badgeFilter, setBadgeFilter] = useState([])
    const [typeFilter, setTypeFilter] = useState([])
    const [frameworkFilter, setFrameworkFilter] = useState([])
    const [difficultyFilter, setDifficultyFilter] = useState([])
    const [categoryFilter, setCategoryFilter] = useState([])

    // Flowise-style hero & category tiles
    const CATEGORY_TILES = React.useMemo(() => getCategoryTiles({
        grid: IconLayoutGrid,
        message: IconMessageCircleFilled,
        robot: IconRobot,
        sparkle: IconSparkles
    }), [])

    const getAllCustomTemplatesApi = useApi(marketplacesApi.getAllCustomTemplates)
    const [activeTabValue, setActiveTabValue] = useState(0)
    const [templateImages, setTemplateImages] = useState({})
    const [templateIcons, setTemplateIcons] = useState({})
    const [templateUsecases, setTemplateUsecases] = useState([])
    const [eligibleTemplateUsecases, setEligibleTemplateUsecases] = useState([])
    const [selectedTemplateUsecases, setSelectedTemplateUsecases] = useState([])
    const enqueueSnackbar = (...args) => dispatch(enqueueSnackbarAction(...args))
    const closeSnackbar = (...args) => dispatch(closeSnackbarAction(...args))
    const { confirm } = useConfirm()
    const { hasPermission } = useAuth()

    // Flowise-style hero & category tiles - state-dependent calculations
    const noFiltersActive = !search && activeTabValue === 0 && !typeFilter.length && !difficultyFilter.length && !categoryFilter.length

    const categoryCountMap = React.useMemo(() => {
        const data = getAllTemplatesMarketplacesApi.data || []
        const all = data.length
        const counts = { all }
        CATEGORY_TILES.slice(1).forEach(tile => {
            counts[tile.key] = data.filter(t => t.type === tile.key || t.badge === tile.key).length
        })
        return counts
    }, [getAllTemplatesMarketplacesApi.data, CATEGORY_TILES])

    const handleCategoryTileClick = (key) => {
        if (key === 'all') { setTypeFilter([]); setActiveTabValue(0) }
        else { setTypeFilter([key]); setActiveTabValue(0) }
        setCategoryFilter([])
        setCurrentPage(1)
    }

    const handleDifficultyChipClick = (difficulty) => {
        if (difficultyFilter.includes(difficulty)) {
            setDifficultyFilter(difficultyFilter.filter(d => d !== difficulty))
        } else {
            setDifficultyFilter([difficulty])
        }
    }

    const [showShareTemplateDialog, setShowShareTemplateDialog] = useState(false)
    const [shareTemplateDialogProps, setShareTemplateDialogProps] = useState({})

    const share = (template) => {
        const dialogProps = {
            type: 'EDIT',
            cancelButtonName: 'Cancel',
            confirmButtonName: 'Share',
            data: {
                id: template.id,
                name: template.name,
                title: 'Share Custom Template',
                itemType: 'custom_template'
            }
        }
        setShareTemplateDialogProps(dialogProps)
        setShowShareTemplateDialog(true)
    }

    const getSelectStyles = (borderColor, isDarkMode) => ({
        '& .MuiOutlinedInput-notchedOutline': {
            borderRadius: 2,
            borderColor: borderColor
        },
        '& .MuiSvgIcon-root': {
            color: isDarkMode ? '#fff' : 'inherit'
        }
    })

    const handleTabChange = (event, newValue) => {
        if (newValue === 1 && !getAllCustomTemplatesApi.data) {
            getAllCustomTemplatesApi.request()
        }
        setActiveTabValue(newValue)
    }

    const clearAllUsecases = () => {
        if (activeTabValue === 0) setSelectedUsecases([])
        else setSelectedTemplateUsecases([])
    }

    const handleBadgeFilterChange = (event) => {
        const {
            target: { value }
        } = event
        setBadgeFilter(
            // On autofill we get a stringified value.
            typeof value === 'string' ? value.split(',') : value
        )
        setCurrentPage(1)
        const data = activeTabValue === 0 ? getAllTemplatesMarketplacesApi.data : getAllCustomTemplatesApi.data
        getEligibleUsecases(data, {
            typeFilter,
            badgeFilter: typeof value === 'string' ? value.split(',') : value,
            frameworkFilter,
            search
        })
    }

    const handleTypeFilterChange = (event) => {
        const {
            target: { value }
        } = event
        setTypeFilter(
            // On autofill we get a stringified value.
            typeof value === 'string' ? value.split(',') : value
        )
        setCategoryFilter([])
        setCurrentPage(1)
        const data = activeTabValue === 0 ? getAllTemplatesMarketplacesApi.data : getAllCustomTemplatesApi.data
        getEligibleUsecases(data, {
            typeFilter: typeof value === 'string' ? value.split(',') : value,
            badgeFilter,
            frameworkFilter,
            search
        })
    }

    const handleFrameworkFilterChange = (event) => {
        const {
            target: { value }
        } = event
        setFrameworkFilter(
            // On autofill we get a stringified value.
            typeof value === 'string' ? value.split(',') : value
        )
        setCurrentPage(1)
        const data = activeTabValue === 0 ? getAllTemplatesMarketplacesApi.data : getAllCustomTemplatesApi.data
        getEligibleUsecases(data, {
            typeFilter,
            badgeFilter,
            frameworkFilter: typeof value === 'string' ? value.split(',') : value,
            search
        })
    }

    const handleDifficultyFilterChange = (event) => {
        const {
            target: { value }
        } = event
        setDifficultyFilter(
            typeof value === 'string' ? value.split(',') : value
        )
        setCurrentPage(1)
    }

    const handleViewChange = (event, nextView) => {
        if (nextView === null) return
        localStorage.setItem('mpDisplayStyle', nextView)
        setView(nextView)
    }

    const generateSearchSuggestions = (searchTerm, data) => {
        if (!searchTerm.trim() || !data) return []

        const term = searchTerm.toLowerCase()
        const uniqueSuggestions = new Set()

        // Get matching template names and descriptions
        data.forEach((template) => {
            if (template.templateName?.toLowerCase().includes(term)) {
                uniqueSuggestions.add(template.templateName)
            }
            if (template.description?.toLowerCase().includes(term)) {
                uniqueSuggestions.add(template.templateName)
            }
            // Add use cases that match
            if (template.usecases) {
                template.usecases.forEach((usecase) => {
                    if (usecase.toLowerCase().includes(term)) {
                        uniqueSuggestions.add(usecase)
                    }
                })
            }
        })

        return Array.from(uniqueSuggestions).slice(0, 8)
    }

    const onSearchChange = (event) => {
        const value = event.target.value
        setSearch(value)
        setShowSearchSuggestions(value.length > 0)
        setCurrentPage(1)

        const data = activeTabValue === 0 ? getAllTemplatesMarketplacesApi.data : getAllCustomTemplatesApi.data

        // Generate suggestions
        if (value.length > 1) {
            const suggestions = generateSearchSuggestions(value, data)
            setSearchSuggestions(suggestions)
        } else {
            setSearchSuggestions([])
        }

        // Debounced filter update
        clearTimeout(window.searchDebounceTimer)
        window.searchDebounceTimer = setTimeout(() => {
            getEligibleUsecases(data, { typeFilter, badgeFilter, frameworkFilter, difficultyFilter, search: value })
        }, 300) // 300ms debounce delay
    }

    // Cleanup debounce timer on unmount
    useEffect(() => {
        return () => {
            if (window.searchDebounceTimer) {
                clearTimeout(window.searchDebounceTimer)
            }
        }
    }, [])

    const handleSearchSelect = (selectedValue) => {
        setSearch(selectedValue)
        setShowSearchSuggestions(false)
        setCurrentPage(1)

        // Save to recent searches
        const updated = [selectedValue, ...recentSearches.filter((s) => s !== selectedValue)].slice(0, 5)
        setRecentSearches(updated)
        localStorage.setItem('mpRecentSearches', JSON.stringify(updated))

        const data = activeTabValue === 0 ? getAllTemplatesMarketplacesApi.data : getAllCustomTemplatesApi.data
        getEligibleUsecases(data, { typeFilter, badgeFilter, frameworkFilter, difficultyFilter, search: selectedValue })
    }

    const clearSearchHistory = () => {
        setRecentSearches([])
        localStorage.removeItem('mpRecentSearches')
    }

    const handleQuickFilter = (filterType, filterValue) => {
        if (filterType === 'difficulty') {
            setDifficultyFilter([filterValue])
        } else if (filterType === 'type') {
            setTypeFilter([filterValue])
        } else if (filterType === 'framework') {
            setFrameworkFilter([filterValue])
        }
        setSearch('')
        setShowSearchSuggestions(false)
    }

    const onDeleteCustomTemplate = async (template) => {
        const confirmPayload = {
            title: `Delete`,
            description: `Delete Custom Template ${template.name}?`,
            confirmButtonName: 'Delete',
            cancelButtonName: 'Cancel'
        }
        const isConfirmed = await confirm(confirmPayload)

        if (isConfirmed) {
            try {
                const deleteResp = await marketplacesApi.deleteCustomTemplate(template.id)
                if (deleteResp.data) {
                    enqueueSnackbar({
                        message: 'Custom Template deleted successfully!',
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
                    getAllCustomTemplatesApi.request()
                }
            } catch (error) {
                enqueueSnackbar({
                    message: `Failed to delete custom template: ${
                        typeof error.response.data === 'object' ? error.response.data.message : error.response.data
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
            }
        }
    }

    function filterFlows(data) {
        return (
            (data.categories ? data.categories.join(',') : '').toLowerCase().indexOf(search.toLowerCase()) > -1 ||
            data.templateName.toLowerCase().indexOf(search.toLowerCase()) > -1 ||
            (data.description && data.description.toLowerCase().indexOf(search.toLowerCase()) > -1)
        )
    }

    function filterByBadge(data) {
        return badgeFilter.length > 0 ? badgeFilter.includes(data.badge) : true
    }

    function filterByType(data) {
        return typeFilter.length > 0 ? typeFilter.includes(data.type) : true
    }

    function filterByFramework(data) {
        return frameworkFilter.length > 0 ? (data.framework || []).some((item) => frameworkFilter.includes(item)) : true
    }

    function filterByDifficulty(data) {
        return difficultyFilter.length > 0 ? difficultyFilter.includes(data.difficulty) : true
    }

    function filterByCategory(data) {
        return categoryFilter.length > 0 ? categoryFilter.some(cat => (data.categories || []).includes(cat)) : true
    }

    function filterByUsecases(data) {
        if (activeTabValue === 0)
            return selectedUsecases.length > 0 ? (data.usecases || []).some((item) => selectedUsecases.includes(item)) : true
        else
            return selectedTemplateUsecases.length > 0
                ? (data.usecases || []).some((item) => selectedTemplateUsecases.includes(item))
                : true
    }

    const getEligibleUsecases = (data, filter) => {
        if (!data) return

        let filteredData = data
        if (filter.badgeFilter.length > 0) filteredData = filteredData.filter((data) => filter.badgeFilter.includes(data.badge))
        if (filter.typeFilter.length > 0) filteredData = filteredData.filter((data) => filter.typeFilter.includes(data.type))
        if (filter.frameworkFilter.length > 0)
            filteredData = filteredData.filter((data) => (data.framework || []).some((item) => filter.frameworkFilter.includes(item)))
        if (filter.difficultyFilter && filter.difficultyFilter.length > 0)
            filteredData = filteredData.filter((data) => filter.difficultyFilter.includes(data.difficulty))
        if (filter.search) {
            filteredData = filteredData.filter(
                (data) =>
                    (data.categories ? data.categories.join(',') : '').toLowerCase().indexOf(filter.search.toLowerCase()) > -1 ||
                    data.templateName.toLowerCase().indexOf(filter.search.toLowerCase()) > -1 ||
                    (data.description && data.description.toLowerCase().indexOf(filter.search.toLowerCase()) > -1)
            )
        }

        const usecases = []
        for (let i = 0; i < filteredData.length; i += 1) {
            if (filteredData[i].flowData || filteredData[i].assistantData || filteredData[i].toolData) {
                usecases.push(...filteredData[i].usecases)
            }
        }
        if (activeTabValue === 0) setEligibleUsecases(Array.from(new Set(usecases)).sort())
        else setEligibleTemplateUsecases(Array.from(new Set(usecases)).sort())
    }

    const onUseTemplate = (selectedTool) => {
        const dialogProp = {
            title: 'Add New Tool',
            type: 'IMPORT',
            cancelButtonName: 'Cancel',
            confirmButtonName: 'Add',
            data: selectedTool
        }
        setToolDialogProps(dialogProp)
        setShowToolDialog(true)
    }

    const goToTool = (selectedTool) => {
        const dialogProp = {
            title: selectedTool.templateName,
            type: 'TEMPLATE',
            data: selectedTool
        }
        setToolDialogProps(dialogProp)
        setShowToolDialog(true)
    }

    const goToCanvas = (selectedChatflow) => {
        if (selectedChatflow.type === 'AgentflowV2') {
            navigate(`/v2/marketplace/${selectedChatflow.id}`, { state: selectedChatflow })
        } else {
            navigate(`/marketplace/${selectedChatflow.id}`, { state: selectedChatflow })
        }
    }

    const useMarketplaceTemplate = async (template) => {
        try {
            const response = await marketplacesApi.useTemplate(template.id, { name: `${template.name} (Copy)` })
            const flowId = response?.data?.id
            if (!flowId) throw new Error('Template import did not return flow id')

            enqueueSnackbar({
                message: `${template.name || 'Template'} imported successfully`,
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

            // Navigate to the canvas to edit the new flow
            if (template.type === 'AgentflowV2') {
                navigate(`/v2/agentcanvas/${flowId}`)
            } else {
                navigate(`/canvas/${flowId}`)
            }
        } catch (err) {
            enqueueSnackbar({
                message: `Failed to use template: ${err.message || 'Unknown error'}`,
                options: {
                    key: new Date().getTime() + Math.random(),
                    variant: 'error',
                    action: (key) => (
                        <Button style={{ color: 'white' }} onClick={() => closeSnackbar(key)}>
                            <IconX />
                        </Button>
                    )
                }
            })
        }
    }

    const goToAssistant = async (selectedAssistantTemplate) => {
        try {
            const response = await marketplacesApi.importAssistantTemplate(selectedAssistantTemplate)
            const assistantId = response?.data?.id
            if (!assistantId) throw new Error('Assistant import did not return id')

            enqueueSnackbar({
                message: `${selectedAssistantTemplate.templateName || 'Assistant template'} imported successfully`,
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
            navigate(`/assistants/custom/${assistantId}`)
        } catch (err) {
            const message = err?.response?.data?.message || err?.response?.data || err?.message || 'Unknown error'
            enqueueSnackbar({
                message: `Failed to import assistant template: ${message}`,
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
        }
    }

    const openTemplate = (template) => {
        if (template.type === 'Assistant') {
            goToAssistant(template)
            return
        }
        if (template.type === 'Chatflow' || template.type === 'Agentflow' || template.type === 'AgentflowV2') {
            goToCanvas(template)
            return
        }
        goToTool(template)
    }

    useEffect(() => {
        if (hasPermission('templates:marketplace')) {
            getAllTemplatesMarketplacesApi.request()
        } else if (hasPermission('templates:custom')) {
            setActiveTabValue(1)
            getAllCustomTemplatesApi.request()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    useEffect(() => {
        setLoading(getAllTemplatesMarketplacesApi.loading)
    }, [getAllTemplatesMarketplacesApi.loading])

    useEffect(() => {
        if (getAllTemplatesMarketplacesApi.data) {
            try {
                const flows = getAllTemplatesMarketplacesApi.data
                const usecases = []
                const images = {}
                const icons = {}
                for (let i = 0; i < flows.length; i += 1) {
                    usecases.push(...(flows[i].usecases || []))
                    if (flows[i].flowData) {
                        const flowDataStr = flows[i].flowData
                        const flowData = JSON.parse(flowDataStr)
                        const nodes = flowData.nodes || []
                        images[flows[i].id] = []
                        icons[flows[i].id] = []
                        for (let j = 0; j < nodes.length; j += 1) {
                            if (nodes[j].data.name === 'stickyNote' || nodes[j].data.name === 'stickyNoteAgentflow') continue
                            const foundIcon = AGENTFLOW_ICONS.find((icon) => icon.name === nodes[j].data.name)
                            if (foundIcon) {
                                icons[flows[i].id].push(foundIcon)
                            } else {
                                const imageSrc = `${baseURL}/api/v1/node-icon/${nodes[j].data.name}`
                                if (!images[flows[i].id].some((img) => img.imageSrc === imageSrc)) {
                                    images[flows[i].id].push({
                                        imageSrc,
                                        label: nodes[j].data.name
                                    })
                                }
                            }
                        }
                    }
                }
                setImages(images)
                setIcons(icons)
                setUsecases(Array.from(new Set(usecases)).sort())
                setEligibleUsecases(Array.from(new Set(usecases)).sort())
            } catch (e) {
                console.error(e)
            }
        }
    }, [getAllTemplatesMarketplacesApi.data])

    useEffect(() => {
        if (getAllTemplatesMarketplacesApi.error && setError) {
            setError(getAllTemplatesMarketplacesApi.error)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [getAllTemplatesMarketplacesApi.error])

    useEffect(() => {
        setLoading(getAllCustomTemplatesApi.loading)
    }, [getAllCustomTemplatesApi.loading])

    useEffect(() => {
        if (getAllCustomTemplatesApi.data) {
            try {
                const flows = getAllCustomTemplatesApi.data
                const usecases = []
                const tImages = {}
                const tIcons = {}
                for (let i = 0; i < flows.length; i += 1) {
                    usecases.push(...(flows[i].usecases || []))
                    if (flows[i].flowData) {
                        const flowDataStr = flows[i].flowData
                        const flowData = JSON.parse(flowDataStr)
                        const nodes = flowData.nodes || []
                        tImages[flows[i].id] = []
                        tIcons[flows[i].id] = []
                        for (let j = 0; j < nodes.length; j += 1) {
                            const foundIcon = AGENTFLOW_ICONS.find((icon) => icon.name === nodes[j].data.name)
                            if (foundIcon) {
                                tIcons[flows[i].id].push(foundIcon)
                            } else {
                                const imageSrc = `${baseURL}/api/v1/node-icon/${nodes[j].data.name}`
                                if (!tImages[flows[i].id].includes(imageSrc)) {
                                    tImages[flows[i].id].push(imageSrc)
                                }
                            }
                        }
                    }
                }
                setTemplateImages(tImages)
                setTemplateIcons(tIcons)
                setTemplateUsecases(Array.from(new Set(usecases)).sort())
                setEligibleTemplateUsecases(Array.from(new Set(usecases)).sort())
            } catch (e) {
                console.error(e)
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [getAllCustomTemplatesApi.data])

    useEffect(() => {
        if (getAllCustomTemplatesApi.error && setError) {
            setError(getAllCustomTemplatesApi.error)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [getAllCustomTemplatesApi.error])

    const availableCategories = React.useMemo(() => {
        const data = getAllTemplatesMarketplacesApi.data || []
        const filtered = typeFilter.length
            ? data.filter(t => typeFilter.includes(t.type) || typeFilter.some(f => t.type?.toLowerCase().startsWith(f.toLowerCase())))
            : data
        const cats = new Set()
        filtered.forEach(t => (t.categories || []).forEach(c => cats.add(c)))
        return Array.from(cats).sort()
    }, [getAllTemplatesMarketplacesApi.data, typeFilter])

    const filteredCommunityData = React.useMemo(() => {
        return (getAllTemplatesMarketplacesApi.data || [])
            .filter(filterByBadge)
            .filter(filterByType)
            .filter(filterFlows)
            .filter(filterByFramework)
            .filter(filterByDifficulty)
            .filter(filterByUsecases)
            .filter(filterByCategory)
    }, [getAllTemplatesMarketplacesApi.data, badgeFilter, typeFilter, search, frameworkFilter, difficultyFilter, selectedUsecases, categoryFilter])

    const paginatedCommunityData = React.useMemo(() => {
        const start = (currentPage - 1) * ITEMS_PER_PAGE
        return filteredCommunityData.slice(start, start + ITEMS_PER_PAGE)
    }, [filteredCommunityData, currentPage])

    const totalPages = Math.ceil(filteredCommunityData.length / ITEMS_PER_PAGE)

    return (
        <>
            <MainCard>
                {error ? (
                    <ErrorBoundary error={error} />
                ) : (
                    <Stack flexDirection='column'>
                        <ViewHeader
                            filters={
                                <>
                                    <FormControl
                                        sx={{
                                            borderRadius: 2,
                                            display: 'flex',
                                            flexDirection: 'column',
                                            justifyContent: 'end',
                                            minWidth: 120
                                        }}
                                    >
                                        <InputLabel size='small' id='filter-badge-label'>
                                            Tag
                                        </InputLabel>
                                        <Select
                                            labelId='filter-badge-label'
                                            id='filter-badge-checkbox'
                                            size='small'
                                            multiple
                                            value={badgeFilter}
                                            onChange={handleBadgeFilterChange}
                                            input={<OutlinedInput label='Tag' />}
                                            renderValue={(selected) => selected.join(', ')}
                                            MenuProps={MenuProps}
                                            sx={getSelectStyles(theme.palette.grey[900] + 25, theme?.customization?.isDarkMode)}
                                        >
                                            {badges.map((name) => (
                                                <MenuItem
                                                    key={name}
                                                    value={name}
                                                    sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1 }}
                                                >
                                                    <Checkbox checked={badgeFilter.indexOf(name) > -1} sx={{ p: 0 }} />
                                                    <ListItemText primary={name} />
                                                </MenuItem>
                                            ))}
                                        </Select>
                                    </FormControl>
                                    <FormControl
                                        sx={{
                                            borderRadius: 2,
                                            display: 'flex',
                                            flexDirection: 'column',
                                            justifyContent: 'end',
                                            minWidth: 120
                                        }}
                                    >
                                        <InputLabel size='small' id='type-badge-label'>
                                            Type
                                        </InputLabel>
                                        <Select
                                            size='small'
                                            labelId='type-badge-label'
                                            id='type-badge-checkbox'
                                            multiple
                                            value={typeFilter}
                                            onChange={handleTypeFilterChange}
                                            input={<OutlinedInput label='Type' />}
                                            renderValue={(selected) => selected.join(', ')}
                                            MenuProps={MenuProps}
                                            sx={getSelectStyles(theme.palette.grey[900] + 25, theme?.customization?.isDarkMode)}
                                        >
                                            {types.map((name) => (
                                                <MenuItem
                                                    key={name}
                                                    value={name}
                                                    sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1 }}
                                                >
                                                    <Checkbox checked={typeFilter.indexOf(name) > -1} sx={{ p: 0 }} />
                                                    <ListItemText primary={name} />
                                                </MenuItem>
                                            ))}
                                        </Select>
                                    </FormControl>
                                    <FormControl
                                        sx={{
                                            borderRadius: 2,
                                            display: 'flex',
                                            flexDirection: 'column',
                                            justifyContent: 'end',
                                            minWidth: 120
                                        }}
                                    >
                                        <InputLabel size='small' id='type-fw-label'>
                                            Framework
                                        </InputLabel>
                                        <Select
                                            size='small'
                                            labelId='type-fw-label'
                                            id='type-fw-checkbox'
                                            multiple
                                            value={frameworkFilter}
                                            onChange={handleFrameworkFilterChange}
                                            input={<OutlinedInput label='Framework' />}
                                            renderValue={(selected) => selected.join(', ')}
                                            MenuProps={MenuProps}
                                            sx={getSelectStyles(theme.palette.grey[900] + 25, theme?.customization?.isDarkMode)}
                                        >
                                            {framework.map((name) => (
                                                <MenuItem
                                                    key={name}
                                                    value={name}
                                                    sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1 }}
                                                >
                                                    <Checkbox checked={frameworkFilter.indexOf(name) > -1} sx={{ p: 0 }} />
                                                    <ListItemText primary={name} />
                                                </MenuItem>
                                            ))}
                                        </Select>
                                    </FormControl>
                                    <FormControl
                                        sx={{
                                            borderRadius: 2,
                                            display: 'flex',
                                            flexDirection: 'column',
                                            justifyContent: 'end',
                                            minWidth: 120
                                        }}
                                    >
                                        <InputLabel size='small' id='type-difficulty-label'>
                                            Difficulty
                                        </InputLabel>
                                        <Select
                                            size='small'
                                            labelId='type-difficulty-label'
                                            id='type-difficulty-checkbox'
                                            multiple
                                            value={difficultyFilter}
                                            onChange={handleDifficultyFilterChange}
                                            input={<OutlinedInput label='Difficulty' />}
                                            renderValue={(selected) => selected.join(', ')}
                                            MenuProps={MenuProps}
                                            sx={getSelectStyles(theme.palette.grey[900] + 25, theme?.customization?.isDarkMode)}
                                        >
                                            {difficulties.map((name) => (
                                                <MenuItem
                                                    key={name}
                                                    value={name}
                                                    sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1 }}
                                                >
                                                    <Checkbox checked={difficultyFilter.indexOf(name) > -1} sx={{ p: 0 }} />
                                                    <ListItemText primary={name} />
                                                </MenuItem>
                                            ))}
                                        </Select>
                                    </FormControl>
                                    {availableCategories.length > 0 && (
                                        <FormControl
                                            sx={{
                                                borderRadius: 2,
                                                display: 'flex',
                                                flexDirection: 'column',
                                                justifyContent: 'end',
                                                minWidth: 160
                                            }}
                                        >
                                            <InputLabel size='small' id='filter-category-label'>
                                                Category
                                            </InputLabel>
                                            <Select
                                                labelId='filter-category-label'
                                                id='filter-category-checkbox'
                                                size='small'
                                                multiple
                                                value={categoryFilter}
                                                onChange={(e) => {
                                                    const val = typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value
                                                    setCategoryFilter(val)
                                                    setCurrentPage(1)
                                                }}
                                                input={<OutlinedInput label='Category' />}
                                                renderValue={(selected) => selected.length === 1 ? selected[0] : `${selected.length} selected`}
                                                MenuProps={{ PaperProps: { style: { maxHeight: 320, width: 200 } } }}
                                                sx={getSelectStyles(theme.palette.grey[900] + 25, theme?.customization?.isDarkMode)}
                                            >
                                                {availableCategories.map((cat) => (
                                                    <MenuItem key={cat} value={cat} sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1 }}>
                                                        <Checkbox checked={categoryFilter.indexOf(cat) > -1} sx={{ p: 0 }} />
                                                        <ListItemText primary={cat} />
                                                    </MenuItem>
                                                ))}
                                            </Select>
                                        </FormControl>
                                    )}
                                </>
                            }
                            onSearchChange={onSearchChange}
                            search={true}
                            searchPlaceholder='Search Name/Description/Node'
                            title='Marketplace'
                            description='Explore and use pre-built templates'
                        >
                            <ToggleButtonGroup
                                sx={{ borderRadius: 2, height: '100%' }}
                                value={view}
                                color='primary'
                                exclusive
                                onChange={handleViewChange}
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
                        </ViewHeader>
                        {showSearchSuggestions && activeTabValue === 0 && (
                            <MainCard
                                sx={{
                                    mt: -2.5,
                                    mb: 2,
                                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                                    position: 'relative',
                                    zIndex: 10
                                }}
                            >
                                <Stack sx={{ gap: 2 }}>
                                    {searchSuggestions.length > 0 && (
                                        <Box>
                                            <Typography variant='caption' sx={{ color: theme.palette.grey[600], fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                Suggestions
                                            </Typography>
                                            <Stack sx={{ gap: 0.5, mt: 1 }}>
                                                {searchSuggestions.map((suggestion, index) => (
                                                    <Box
                                                        key={index}
                                                        onClick={() => handleSearchSelect(suggestion)}
                                                        sx={{
                                                            p: 1,
                                                            borderRadius: 1,
                                                            cursor: 'pointer',
                                                            '&:hover': {
                                                                backgroundColor: theme.palette.grey[100]
                                                            },
                                                            transition: 'background-color 0.2s'
                                                        }}
                                                    >
                                                        <Typography variant='body2'>{suggestion}</Typography>
                                                    </Box>
                                                ))}
                                            </Stack>
                                        </Box>
                                    )}
                                    {recentSearches.length > 0 && (
                                        <Box>
                                            <Stack direction='row' justifyContent='space-between' alignItems='center' sx={{ mb: 1 }}>
                                                <Typography variant='caption' sx={{ color: theme.palette.grey[600], fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                    Recent Searches
                                                </Typography>
                                                <Button size='small' onClick={clearSearchHistory} sx={{ fontSize: '0.75rem' }}>
                                                    Clear
                                                </Button>
                                            </Stack>
                                            <Stack direction='row' sx={{ gap: 1, flexWrap: 'wrap' }}>
                                                {recentSearches.map((recent, index) => (
                                                    <Chip
                                                        key={index}
                                                        label={recent}
                                                        onClick={() => handleSearchSelect(recent)}
                                                        variant='outlined'
                                                        size='small'
                                                        sx={{ cursor: 'pointer' }}
                                                    />
                                                ))}
                                            </Stack>
                                        </Box>
                                    )}
                                    {searchSuggestions.length === 0 && recentSearches.length === 0 && (
                                        <Typography variant='body2' sx={{ color: theme.palette.grey[500], textAlign: 'center', py: 2 }}>
                                            No suggestions found
                                        </Typography>
                                    )}
                                </Stack>
                            </MainCard>
                        )}
                        {hasPermission('templates:marketplace') && hasPermission('templates:custom') && (
                            <Stack direction='row' justifyContent='space-between' sx={{ mb: 2 }}>
                                <Tabs value={activeTabValue} onChange={handleTabChange} textColor='primary' aria-label='tabs'>
                                    <PermissionTab permissionId='templates:marketplace' value={0} label='Community Templates' />
                                    <PermissionTab permissionId='templates:custom' value={1} label='My Templates' />
                                </Tabs>
                                <Autocomplete
                                    id='useCases'
                                    multiple
                                    size='small'
                                    options={usecases}
                                    value={selectedUsecases}
                                    onChange={(_, newValue) => { setSelectedUsecases(newValue); setCurrentPage(1) }}
                                    disableCloseOnSelect
                                    getOptionLabel={(option) => option}
                                    isOptionEqualToValue={(option, value) => option === value}
                                    renderOption={(props, option, { selected }) => {
                                        const isDisabled = eligibleUsecases.length > 0 && !eligibleUsecases.includes(option)

                                        return (
                                            <li {...props} style={{ pointerEvents: isDisabled ? 'none' : 'auto' }}>
                                                <Checkbox checked={selected} color='success' disabled={isDisabled} />
                                                <ListItemText primary={option} />
                                            </li>
                                        )
                                    }}
                                    renderInput={(params) => <TextField {...params} label='Usecases' />}
                                    sx={{
                                        width: 300
                                    }}
                                    limitTags={2}
                                    renderTags={(value, getTagProps) => {
                                        const totalTags = value.length
                                        const limitTags = 2

                                        return (
                                            <>
                                                {value.slice(0, limitTags).map((option, index) => (
                                                    <Chip
                                                        {...getTagProps({ index })}
                                                        key={index}
                                                        label={option}
                                                        sx={{
                                                            height: 24,
                                                            '& .MuiSvgIcon-root': {
                                                                fontSize: 16,
                                                                background: 'None'
                                                            }
                                                        }}
                                                    />
                                                ))}

                                                {totalTags > limitTags && (
                                                    <Tooltip
                                                        title={
                                                            <ol style={{ paddingLeft: '20px' }}>
                                                                {value.slice(limitTags).map((item, i) => (
                                                                    <li key={i}>{item}</li>
                                                                ))}
                                                            </ol>
                                                        }
                                                        placement='top'
                                                    >
                                                        +{totalTags - limitTags}
                                                    </Tooltip>
                                                )}
                                            </>
                                        )
                                    }}
                                    slotProps={{
                                        paper: {
                                            sx: {
                                                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)'
                                            }
                                        }
                                    }}
                                />
                            </Stack>
                        )}
                        <Available permission='templates:marketplace'>
                            <TabPanel value={activeTabValue} index={0}>
                                {!isLoading && getAllTemplatesMarketplacesApi.data && (
                                    <Stack sx={{ mb: 3, gap: 3 }}>
                                        {/* Hero Banner — shown when no filters active */}
                                        {noFiltersActive && (
                                            <Box sx={{
                                                background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #1e1b4b 100%)',
                                                borderRadius: 3,
                                                p: { xs: 3, md: 5 },
                                                mb: 1,
                                                color: '#fff',
                                                position: 'relative',
                                                overflow: 'hidden'
                                            }}>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                                                    <img src={vetraiLogo} alt='Vetrai' style={{ height: 36, objectFit: 'contain' }} />
                                                    <Typography variant='h3' sx={{ color: '#f9fafb', fontWeight: 700, letterSpacing: '-0.02em' }}>
                                                        Marketplace
                                                    </Typography>
                                                </Box>
                                                <Typography sx={{ color: '#94a3b8', fontSize: '1rem', mb: 3, maxWidth: 520 }}>
                                                    {getAllTemplatesMarketplacesApi.data?.length || 0}+ ready-to-use AI templates — deploy in seconds.
                                                </Typography>
                                                <Stack direction='row' spacing={1} flexWrap='wrap' useFlexGap>
                                                    {['Beginner', 'Intermediate', 'Advanced'].map(d => (
                                                        <Chip
                                                            key={d}
                                                            label={d}
                                                            size='small'
                                                            onClick={() => handleDifficultyChipClick(d)}
                                                            sx={{
                                                                bgcolor: 'rgba(255,255,255,0.10)',
                                                                color: '#e2e8f0',
                                                                border: '1px solid rgba(255,255,255,0.15)',
                                                                cursor: 'pointer',
                                                                '&:hover': { bgcolor: 'rgba(255,255,255,0.18)' }
                                                            }}
                                                        />
                                                    ))}
                                                </Stack>
                                            </Box>
                                        )}

                                        {/* Category Tiles — always visible on main tab */}
                                        <Grid container spacing={2} sx={{ mb: 2 }}>
                                            {CATEGORY_TILES.map(tile => {
                                                const TileIcon = tile.icon
                                                const isActive = tile.key === 'all' ? !typeFilter || typeFilter.length === 0 : typeFilter?.includes(tile.key)
                                                const count = categoryCountMap[tile.key] || 0
                                                return (
                                                    <Grid key={tile.key} item xs={6} sm={3}>
                                                        <Box
                                                            onClick={() => handleCategoryTileClick(tile.key)}
                                                            sx={{
                                                                p: 2,
                                                                borderRadius: 2,
                                                                cursor: 'pointer',
                                                                border: `1px solid ${isActive ? tile.color : theme.palette.divider}`,
                                                                bgcolor: isActive ? alpha(tile.color, 0.08) : 'background.paper',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: 1.5,
                                                                transition: 'all 0.15s ease',
                                                                '&:hover': {
                                                                    border: `1px solid ${tile.color}`,
                                                                    bgcolor: alpha(tile.color, 0.06)
                                                                }
                                                            }}
                                                        >
                                                            <Box sx={{ bgcolor: alpha(tile.color, 0.12), borderRadius: 1.5, p: 0.75 }}>
                                                                <TileIcon size={20} color={tile.color} />
                                                            </Box>
                                                            <Box>
                                                                <Typography variant='body2' fontWeight={600}>{tile.label}</Typography>
                                                                <Typography variant='caption' sx={{ color: 'text.secondary' }}>{count}</Typography>
                                                            </Box>
                                                        </Box>
                                                    </Grid>
                                                )
                                            })}
                                        </Grid>

                                        {/* Featured Templates heading — shown when no filters */}
                                        {noFiltersActive && (
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                                                <IconSparkles size={18} color={theme.palette.warning.main} />
                                                <Typography variant='h5' fontWeight={600}>Featured Templates</Typography>
                                            </Box>
                                        )}

                                        {noFiltersActive && (
                                            <Box display='grid' gridTemplateColumns='repeat(auto-fill, minmax(250px, 1fr))' gap={gridSpacing}>
                                                {getFeaturedTemplates(getAllTemplatesMarketplacesApi.data).map((template, index) => (
                                                    <Box key={index}>
                                                        {template.badge && (
                                                            <Badge
                                                                sx={{
                                                                    width: '100%',
                                                                    height: '100%',
                                                                    '& .MuiBadge-badge': { right: 20 }
                                                                }}
                                                                badgeContent={template.badge}
                                                                color={template.badge === 'POPULAR' ? 'primary' : 'error'}
                                                            >
                                                                <ItemCard
                                                                    onClick={() => openTemplate(template)}
                                                                    data={template}
                                                                    images={template.flowData ? images[template.id] : []}
                                                                    icons={template.flowData ? icons[template.id] : []}
                                                                />
                                                            </Badge>
                                                        )}
                                                        {!template.badge && (
                                                            <ItemCard
                                                                onClick={() => openTemplate(template)}
                                                                data={template}
                                                                images={template.flowData ? images[template.id] : []}
                                                                icons={template.flowData ? icons[template.id] : []}
                                                            />
                                                        )}
                                                    </Box>
                                                ))}
                                            </Box>
                                        )}
                                    </Stack>
                                )}
                                {!view || view === 'card' ? (
                                    <>
                                        {isLoading ? (
                                            <Box display='grid' gridTemplateColumns='repeat(3, 1fr)' gap={gridSpacing}>
                                                <Skeleton variant='rounded' height={160} />
                                                <Skeleton variant='rounded' height={160} />
                                                <Skeleton variant='rounded' height={160} />
                                            </Box>
                                        ) : (
                                            <Box display='grid' gridTemplateColumns='repeat(3, 1fr)' gap={gridSpacing}>
                                                {paginatedCommunityData.map((data, index) => (
                                                        <Box key={index}>
                                                            {data.badge && (
                                                                <Badge
                                                                    sx={{
                                                                        width: '100%',
                                                                        height: '100%',
                                                                        '& .MuiBadge-badge': {
                                                                            right: 20
                                                                        }
                                                                    }}
                                                                    badgeContent={data.badge}
                                                                    color={data.badge === 'POPULAR' ? 'primary' : 'error'}
                                                                >
                                                                    <ItemCard
                                                                        onClick={() => openTemplate(data)}
                                                                        data={data}
                                                                        images={data.flowData ? images[data.id] : []}
                                                                        icons={data.flowData ? icons[data.id] : []}
                                                                    />
                                                                </Badge>
                                                            )}
                                                            {!data.badge && (
                                                                <ItemCard
                                                                    onClick={() => openTemplate(data)}
                                                                    data={data}
                                                                    images={data.flowData ? images[data.id] : []}
                                                                    icons={data.flowData ? icons[data.id] : []}
                                                                />
                                                            )}
                                                        </Box>
                                                    ))}
                                            </Box>
                                            {totalPages > 1 && (
                                                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', mt: 3, gap: 2 }}>
                                                    <Typography variant='body2' sx={{ color: 'text.secondary' }}>
                                                        {filteredCommunityData.length} templates
                                                    </Typography>
                                                    <Pagination
                                                        count={totalPages}
                                                        page={currentPage}
                                                        onChange={(_, p) => { setCurrentPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
                                                        color='primary'
                                                        shape='rounded'
                                                        showFirstButton
                                                        showLastButton
                                                    />
                                                </Box>
                                            )}
                                        )}
                                    </>
                                ) : (
                                    <MarketplaceTable
                                        data={getAllTemplatesMarketplacesApi.data}
                                        filterFunction={filterFlows}
                                        filterByType={filterByType}
                                        filterByBadge={filterByBadge}
                                        filterByFramework={filterByFramework}
                                        filterByDifficulty={filterByDifficulty}
                                        filterByUsecases={filterByUsecases}
                                        goToTool={goToTool}
                                        goToCanvas={goToCanvas}
                                        goToAssistant={goToAssistant}
                                        isLoading={isLoading}
                                        setError={setError}
                                    />
                                )}

                                {!isLoading &&
                                    (!getAllTemplatesMarketplacesApi.data || getAllTemplatesMarketplacesApi.data.length === 0) && (
                                        <Stack sx={{ alignItems: 'center', justifyContent: 'center' }} flexDirection='column'>
                                            <Box sx={{ p: 2, height: 'auto' }}>
                                                <img
                                                    style={{ objectFit: 'cover', height: '25vh', width: 'auto' }}
                                                    src={WorkflowEmptySVG}
                                                    alt='WorkflowEmptySVG'
                                                />
                                            </Box>
                                            <div>No Marketplace Yet</div>
                                        </Stack>
                                    )}
                            </TabPanel>
                        </Available>
                        <Available permission='templates:custom'>
                            <TabPanel value={activeTabValue} index={1}>
                                <Stack direction='row' sx={{ gap: 2, my: 2, alignItems: 'center', flexWrap: 'wrap' }}>
                                    {templateUsecases.map((usecase, index) => (
                                        <FormControlLabel
                                            key={index}
                                            size='small'
                                            control={
                                                <Checkbox
                                                    disabled={
                                                        eligibleTemplateUsecases.length === 0
                                                            ? true
                                                            : !eligibleTemplateUsecases.includes(usecase)
                                                    }
                                                    color='success'
                                                    checked={selectedTemplateUsecases.includes(usecase)}
                                                    onChange={(event) => {
                                                        setSelectedTemplateUsecases(
                                                            event.target.checked
                                                                ? [...selectedTemplateUsecases, usecase]
                                                                : selectedTemplateUsecases.filter((item) => item !== usecase)
                                                        )
                                                    }}
                                                />
                                            }
                                            label={usecase}
                                        />
                                    ))}
                                </Stack>
                                {selectedTemplateUsecases.length > 0 && (
                                    <Button
                                        sx={{ width: 'max-content', mb: 2, borderRadius: '20px' }}
                                        variant='outlined'
                                        onClick={() => clearAllUsecases()}
                                        startIcon={<IconX />}
                                    >
                                        Clear All
                                    </Button>
                                )}
                                {!view || view === 'card' ? (
                                    <>
                                        {isLoading ? (
                                            <Box display='grid' gridTemplateColumns='repeat(3, 1fr)' gap={gridSpacing}>
                                                <Skeleton variant='rounded' height={160} />
                                                <Skeleton variant='rounded' height={160} />
                                                <Skeleton variant='rounded' height={160} />
                                            </Box>
                                        ) : (
                                            <Box display='grid' gridTemplateColumns='repeat(3, 1fr)' gap={gridSpacing}>
                                                {getAllCustomTemplatesApi.data
                                                    ?.filter(filterByBadge)
                                                    .filter(filterByType)
                                                    .filter(filterFlows)
                                                    .filter(filterByFramework)
                                                    .filter(filterByUsecases)
                                                    .map((data, index) => (
                                                        <Box key={index}>
                                                            {data.badge && (
                                                                <Badge
                                                                    sx={{
                                                                        width: '100%',
                                                                        height: '100%',
                                                                        '& .MuiBadge-badge': {
                                                                            right: 20
                                                                        }
                                                                    }}
                                                                    badgeContent={data.badge}
                                                                    color={data.badge === 'POPULAR' ? 'primary' : 'error'}
                                                                >
                                                                    <ItemCard
                                                                        onClick={() => openTemplate(data)}
                                                                        data={data}
                                                                        images={data.flowData ? templateImages[data.id] : []}
                                                                        icons={data.flowData ? templateIcons[data.id] : []}
                                                                    />
                                                                </Badge>
                                                            )}
                                                            {!data.badge && (
                                                                <ItemCard
                                                                    onClick={() => openTemplate(data)}
                                                                    data={data}
                                                                    images={data.flowData ? templateImages[data.id] : []}
                                                                    icons={data.flowData ? templateIcons[data.id] : []}
                                                                />
                                                            )}
                                                        </Box>
                                                    ))}
                                            </Box>
                                        )}
                                    </>
                                ) : (
                                    <MarketplaceTable
                                        data={getAllCustomTemplatesApi.data}
                                        filterFunction={filterFlows}
                                        filterByType={filterByType}
                                        filterByBadge={filterByBadge}
                                        filterByFramework={filterByFramework}
                                        filterByUsecases={filterByUsecases}
                                        goToTool={goToTool}
                                        goToCanvas={goToCanvas}
                                        goToAssistant={goToAssistant}
                                        isLoading={isLoading}
                                        setError={setError}
                                        onDelete={hasPermission('templates:custom-delete') ? onDeleteCustomTemplate : null}
                                        onShare={hasPermission('templates:custom-share') ? share : null}
                                    />
                                )}
                                {!isLoading && (!getAllCustomTemplatesApi.data || getAllCustomTemplatesApi.data.length === 0) && (
                                    <Stack sx={{ alignItems: 'center', justifyContent: 'center' }} flexDirection='column'>
                                        <Box sx={{ p: 2, height: 'auto' }}>
                                            <img
                                                style={{ objectFit: 'cover', height: '25vh', width: 'auto' }}
                                                src={WorkflowEmptySVG}
                                                alt='WorkflowEmptySVG'
                                            />
                                        </Box>
                                        <div>No Saved Custom Templates</div>
                                    </Stack>
                                )}
                            </TabPanel>
                        </Available>
                    </Stack>
                )}
            </MainCard>
            <ToolDialog
                show={showToolDialog}
                dialogProps={toolDialogProps}
                onCancel={() => setShowToolDialog(false)}
                onConfirm={() => setShowToolDialog(false)}
                onUseTemplate={(tool) => onUseTemplate(tool)}
            ></ToolDialog>
            {showShareTemplateDialog && (
                <ShareWithWorkspaceDialog
                    show={showShareTemplateDialog}
                    dialogProps={shareTemplateDialogProps}
                    onCancel={() => setShowShareTemplateDialog(false)}
                    setError={setError}
                ></ShareWithWorkspaceDialog>
            )}
            <ConfirmDialog />
        </>
    )
}

export default Marketplace
