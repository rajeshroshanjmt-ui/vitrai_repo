import {
    IconLayoutDashboard,
    IconHierarchy,
    IconUsersGroup,
    IconRobot,
    IconListCheck,
    IconTool,
    IconFiles,
    IconDatabase,
    IconTestPipe,
    IconChartHistogram,
    IconLock,
    IconVariable,
    IconKey,
    IconBuildingStore,
    IconSettings,
    IconFileText,
    IconLogout
} from '@tabler/icons-react'

const icons = {
    IconLayoutDashboard,
    IconHierarchy,
    IconUsersGroup,
    IconRobot,
    IconListCheck,
    IconTool,
    IconFiles,
    IconDatabase,
    IconTestPipe,
    IconChartHistogram,
    IconLock,
    IconVariable,
    IconKey,
    IconBuildingStore,
    IconSettings,
    IconFileText,
    IconLogout
}

const dashboard = {
    id: 'main-nav',
    title: '',
    type: 'group',
    children: [
        {
            id: 'dashboard',
            title: 'Dashboard',
            type: 'item',
            url: '/dashboard',
            icon: icons.IconLayoutDashboard,
            breadcrumbs: true
        },
        {
            id: 'build',
            title: 'BUILD',
            type: 'group',
            children: [
                {
                    id: 'chatflows',
                    title: 'Chatflows',
                    type: 'item',
                    url: '/chatflows',
                    icon: icons.IconHierarchy,
                    permission: 'chatflows:view'
                },
                {
                    id: 'agentflows',
                    title: 'Agentflows',
                    type: 'item',
                    url: '/agentflows',
                    icon: icons.IconUsersGroup,
                    permission: 'agentflows:view'
                },
                {
                    id: 'assistants',
                    title: 'Assistants',
                    type: 'item',
                    url: '/assistants',
                    icon: icons.IconRobot,
                    permission: 'assistants:view'
                }
            ]
        },
        {
            id: 'run',
            title: 'RUN',
            type: 'group',
            children: [
                {
                    id: 'executions',
                    title: 'Executions',
                    type: 'item',
                    url: '/executions',
                    icon: icons.IconListCheck,
                    permission: 'executions:view'
                }
            ]
        },
        {
            id: 'ai-resources',
            title: 'AI RESOURCES',
            type: 'group',
            children: [
                {
                    id: 'tools',
                    title: 'Tools',
                    type: 'item',
                    url: '/tools',
                    icon: icons.IconTool,
                    permission: 'tools:view'
                },
                {
                    id: 'document-stores',
                    title: 'Document Stores',
                    type: 'item',
                    url: '/document-stores',
                    icon: icons.IconFiles,
                    permission: 'documentStores:view'
                },
                {
                    id: 'datasets',
                    title: 'Datasets',
                    type: 'item',
                    url: '/datasets',
                    icon: icons.IconDatabase,
                    display: 'feat:datasets',
                    permission: 'datasets:view'
                }
            ]
        },
        {
            id: 'evaluation',
            title: 'EVALUATION',
            type: 'group',
            children: [
                {
                    id: 'evaluators',
                    title: 'Evaluators',
                    type: 'item',
                    url: '/evaluators',
                    icon: icons.IconTestPipe,
                    display: 'feat:evaluators',
                    permission: 'evaluators:view'
                },
                {
                    id: 'evaluations',
                    title: 'Evaluations',
                    type: 'item',
                    url: '/evaluations',
                    icon: icons.IconChartHistogram,
                    display: 'feat:evaluations',
                    permission: 'evaluations:view'
                }
            ]
        },
        {
            id: 'security',
            title: 'SECURITY',
            type: 'group',
            children: [
                {
                    id: 'credentials',
                    title: 'Credentials',
                    type: 'item',
                    url: '/credentials',
                    icon: icons.IconLock,
                    permission: 'credentials:view'
                },
                {
                    id: 'variables',
                    title: 'Variables',
                    type: 'item',
                    url: '/variables',
                    icon: icons.IconVariable,
                    permission: 'variables:view'
                },
                {
                    id: 'apikey',
                    title: 'API Keys',
                    type: 'item',
                    url: '/apikey',
                    icon: icons.IconKey,
                    permission: 'apikeys:view'
                }
            ]
        },
        {
            id: 'marketplace',
            title: 'MARKETPLACE',
            type: 'group',
            children: [
                {
                    id: 'marketplaces',
                    title: 'Marketplaces',
                    type: 'item',
                    url: '/marketplaces',
                    icon: icons.IconBuildingStore,
                    permission: 'templates:marketplace,templates:custom'
                }
            ]
        },
        {
            id: 'account-group',
            title: 'ACCOUNT',
            type: 'group',
            children: [
                {
                    id: 'account',
                    title: 'Account Settings',
                    type: 'item',
                    url: '/account',
                    icon: icons.IconSettings,
                    display: 'feat:account'
                }
            ]
        },
        {
            id: 'help',
            title: 'HELP',
            type: 'group',
            children: [
                {
                    id: 'documentation',
                    title: 'Documentation',
                    type: 'item',
                    url: '/documentation',
                    icon: icons.IconFileText
                }
            ]
        },
        {
            id: 'session',
            title: 'SESSION',
            type: 'group',
            children: [
                {
                    id: 'logout',
                    title: 'Logout',
                    type: 'item',
                    url: '/logout',
                    icon: icons.IconLogout
                }
            ]
        }
    ]
}

export default dashboard
