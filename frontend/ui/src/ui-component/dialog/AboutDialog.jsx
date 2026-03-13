import { createPortal } from 'react-dom'
import { useState, useEffect } from 'react'
import PropTypes from 'prop-types'
import { Dialog, DialogContent, DialogTitle, TableContainer, Table, TableHead, TableRow, TableCell, TableBody, Paper } from '@mui/material'
import axios from 'axios'
import { baseURL } from '@/store/constant'
import packageJson from '../../../package.json'

const AboutDialog = ({ show, onCancel }) => {
    const [backendVersion, setBackendVersion] = useState('')
    const frontendVersion = packageJson?.version || '-'
    const environment = String(import.meta.env.VITE_APP_ENV || import.meta.env.MODE || 'development').toUpperCase()

    useEffect(() => {
        if (!show) {
            return
        }

        let isMounted = true

        const fetchVersion = async () => {
            try {
                const response = await axios.get(`${baseURL}/api/v1/version`, {
                    withCredentials: true,
                    headers: { 'Content-type': 'application/json', 'x-request-from': 'internal' }
                })

                if (isMounted) {
                    setBackendVersion(response.data?.version ?? '')
                }
            } catch (error) {
                console.error('Error fetching data:', error)
            }
        }

        fetchVersion()

        return () => {
            isMounted = false
        }
    }, [show])

    if (!show) {
        return null
    }

    const portalElement = document.getElementById('portal')
    if (!portalElement) {
        return null
    }

    const component = (
        <Dialog
            onClose={onCancel}
            open={show}
            fullWidth
            maxWidth='sm'
            aria-labelledby='about-dialog-title'
            aria-describedby='about-dialog-description'
        >
            <DialogTitle sx={{ fontSize: '1rem' }} id='about-dialog-title'>
                About Vetrai
            </DialogTitle>
            <DialogContent id='about-dialog-description'>
                <TableContainer component={Paper}>
                    <Table aria-label='simple table'>
                        <TableHead>
                            <TableRow>
                                <TableCell>Item</TableCell>
                                <TableCell>Value</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            <TableRow>
                                <TableCell component='th' scope='row'>
                                    Frontend Version
                                </TableCell>
                                <TableCell>{frontendVersion}</TableCell>
                            </TableRow>
                            <TableRow>
                                <TableCell component='th' scope='row'>
                                    Backend Version
                                </TableCell>
                                <TableCell>{backendVersion || '-'}</TableCell>
                            </TableRow>
                            <TableRow sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                                <TableCell component='th' scope='row'>
                                    Environment
                                </TableCell>
                                <TableCell>{environment}</TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>
                </TableContainer>
            </DialogContent>
        </Dialog>
    )

    return createPortal(component, portalElement)
}

AboutDialog.propTypes = {
    show: PropTypes.bool,
    onCancel: PropTypes.func
}

export default AboutDialog
