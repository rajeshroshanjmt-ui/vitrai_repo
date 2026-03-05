import { useEffect } from 'react'

import accountApi from '@/api/account.api'
import MainCard from '@/ui-component/cards/MainCard'

const Logout = () => {
    useEffect(() => {
        const run = async () => {
            try {
                await accountApi.logout()
            } finally {
                window.location.href = '/login'
            }
        }

        run()
    }, [])

    return <MainCard>Signing out...</MainCard>
}

export default Logout
