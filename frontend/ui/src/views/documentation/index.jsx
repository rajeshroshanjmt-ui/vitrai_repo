import { useMemo, useState } from 'react'

import { Box, Button, InputAdornment, Paper, Stack, TextField, Typography } from '@mui/material'
import { IconBook2, IconExternalLink, IconSearch } from '@tabler/icons-react'

import MainCard from '@/ui-component/cards/MainCard'
import ViewHeader from '@/layout/MainLayout/ViewHeader'
import StateView from '@/ui-component/states/StateView'
import { baseURL } from '@/store/constant'

const docSections = [
    {
        title: 'Getting Started',
        items: [
            {
                title: 'Platform Overview Guide',
                description: 'Core architecture, environments, permissions, and how Vetrai components fit together.',
                url: 'https://docs.vetrai.ai',
                keywords: ['platform', 'overview', 'architecture', 'environment']
            }
        ]
    },
    {
        title: 'Build Guides',
        items: [
            {
                title: 'Agent Builder Guide',
                description: 'How to design agents, choose tools, configure prompts, and ship production-ready assistants.',
                url: 'https://docs.vetrai.ai',
                keywords: ['agent', 'builder', 'assistant', 'prompt', 'tools']
            },
            {
                title: 'Workflow Guide',
                description: 'How to compose deterministic workflows, branching, retries, and execution monitoring.',
                url: 'https://docs.vetrai.ai',
                keywords: ['workflow', 'agentflow', 'branch', 'retry', 'execution']
            }
        ]
    },
    {
        title: 'API & Integration',
        items: [
            {
                title: 'API Documentation',
                description: 'OpenAPI reference for platform endpoints, authentication, schemas, and examples.',
                url: `${baseURL}/docs`,
                keywords: ['api', 'openapi', 'swagger', 'integration', 'schemas']
            },
            {
                title: 'Developer Reference',
                description: 'Codebase-level guides for local development, deployments, and extension points.',
                url: 'https://github.com/VetraiAI/vetrai',
                keywords: ['developer', 'deployment', 'integration', 'repository']
            }
        ]
    }
]

const Documentation = () => {
    const [search, setSearch] = useState('')

    const filteredSections = useMemo(() => {
        const keyword = search.trim().toLowerCase()
        if (!keyword) return docSections

        return docSections
            .map((section) => ({
                ...section,
                items: section.items.filter((item) => {
                    const haystack = [item.title, item.description, ...(item.keywords || [])].join(' ').toLowerCase()
                    return haystack.includes(keyword)
                })
            }))
            .filter((section) => section.items.length > 0)
    }, [search])

    return (
        <MainCard>
            <Stack sx={{ gap: 3 }}>
                <ViewHeader title='Documentation' description='Platform overview, build guides, workflow references, and API documentation' />

                <TextField
                    size='small'
                    fullWidth
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder='Search docs (platform, agent, workflow, api...)'
                    InputProps={{
                        startAdornment: (
                            <InputAdornment position='start'>
                                <IconSearch size={16} />
                            </InputAdornment>
                        )
                    }}
                />

                {filteredSections.length === 0 ? (
                    <StateView
                        mode='empty'
                        title='No documentation matches'
                        description='Try another keyword or clear the search filter.'
                        actionLabel='Clear Search'
                        onAction={() => setSearch('')}
                    />
                ) : (
                    filteredSections.map((section) => (
                        <Stack key={section.title} sx={{ gap: 1.25 }}>
                            <Typography variant='h4'>{section.title}</Typography>
                            <Stack sx={{ gap: 1.25 }}>
                                {section.items.map((item) => (
                                    <Paper key={item.title} variant='outlined' sx={{ p: 2, borderRadius: 2 }}>
                                        <Stack direction='row' justifyContent='space-between' alignItems='center' spacing={2}>
                                            <Stack sx={{ minWidth: 0 }}>
                                                <Stack direction='row' alignItems='center' spacing={1}>
                                                    <Box sx={{ display: 'grid', placeItems: 'center', width: 28, height: 28, borderRadius: 1, border: 1, borderColor: 'divider' }}>
                                                        <IconBook2 size={16} />
                                                    </Box>
                                                    <Typography variant='h5'>{item.title}</Typography>
                                                </Stack>
                                                <Typography variant='body2' color='text.secondary' sx={{ mt: 0.75 }}>
                                                    {item.description}
                                                </Typography>
                                            </Stack>
                                            <Button
                                                variant='outlined'
                                                endIcon={<IconExternalLink size={16} />}
                                                onClick={() => window.open(item.url, '_blank', 'noopener,noreferrer')}
                                            >
                                                Open
                                            </Button>
                                        </Stack>
                                    </Paper>
                                ))}
                            </Stack>
                        </Stack>
                    ))
                )}
            </Stack>
        </MainCard>
    )
}

export default Documentation
