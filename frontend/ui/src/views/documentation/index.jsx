import { Button, Paper, Stack, Typography } from '@mui/material'
import { IconExternalLink } from '@tabler/icons-react'

import MainCard from '@/ui-component/cards/MainCard'
import ViewHeader from '@/layout/MainLayout/ViewHeader'

const links = [
    {
        title: 'Product Guides',
        description: 'Workflows, agents, assistants, and RAG setup guides.',
        url: 'https://docs.vetrai.ai'
    },
    {
        title: 'API Documentation',
        description: 'Backend APIs and request/response contracts.',
        url: 'http://localhost:8000/docs'
    },
    {
        title: 'Developer Guides',
        description: 'Architecture, deployment, and integration references.',
        url: 'https://github.com/VetraiAI/vetrai'
    }
]

const Documentation = () => {
    return (
        <MainCard>
            <Stack sx={{ gap: 3 }}>
                <ViewHeader title='Documentation' description='Product guides, API docs, and developer references' />

                <Stack sx={{ gap: 2 }}>
                    {links.map((item) => (
                        <Paper key={item.title} sx={{ p: 2, borderRadius: 2 }}>
                            <Stack direction='row' justifyContent='space-between' alignItems='center' spacing={2}>
                                <Stack>
                                    <Typography variant='h4'>{item.title}</Typography>
                                    <Typography variant='body2' color='text.secondary'>
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
        </MainCard>
    )
}

export default Documentation
