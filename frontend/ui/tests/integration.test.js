/**
 * Frontend Integration Tests for Vetrai Phase 1-3 implementations
 * Tests critical UI elements, data-testid attributes, and feature interactions
 */

describe('Vetrai Frontend Integration Tests', () => {
    const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000'

    beforeEach(() => {
        cy.visit(BASE_URL)
    })

    describe('Data-testid Attributes (Phase 3.1)', () => {
        it('should have data-testid on chatflows screen', () => {
            cy.visit(`${BASE_URL}/chatflows`)
            cy.get('[data-testid="chatflows-add-new"]').should('be.visible')
            cy.get('[data-testid="chatflows-grid"]').should('exist').or('[data-testid="chatflows-table"]').should('exist')
        })

        it('should have data-testid on agentflows screen', () => {
            cy.visit(`${BASE_URL}/agentflows`)
            cy.get('[data-testid="agentflows-add-new"]').should('be.visible')
            cy.get('[data-testid="agentflows-grid"]').should('exist').or('[data-testid="agentflows-table"]').should('exist')
        })

        it('should have data-testid on evaluations screen', () => {
            cy.visit(`${BASE_URL}/evaluations`)
            cy.get('[data-testid="evaluations-add-new"]').should('be.visible')
            cy.get('[data-testid="evaluations-table"]').should('exist')
        })

        it('should have data-testid on assistants screen', () => {
            cy.visit(`${BASE_URL}/assistants`)
            cy.get('[data-testid="assistants-grid"]').should('be.visible')
            cy.get('[data-testid="assistants-card-0"]').should('exist')
        })

        it('should have data-testid on docstore screen', () => {
            cy.visit(`${BASE_URL}/document-stores`)
            cy.get('[data-testid="docstore-add-new"]').should('be.visible')
            cy.get('[data-testid="docstore-grid"]').should('exist').or('[data-testid="docstore-table"]').should('exist')
        })

        it('should have data-testid on API code dialog', () => {
            // Navigate to a chatflow and open the API dialog
            cy.visit(`${BASE_URL}/chatflows`)
            cy.get('button').contains('API').first().click()
            cy.get('[data-testid="api-code-dialog"]').should('be.visible')
            cy.get('[data-testid="api-code-dialog-title"]').should('contain', 'API')
        })
    })

    describe('Feature Flags (Phase 1-2)', () => {
        it('should have files feature enabled', () => {
            cy.visit(`${BASE_URL}/files`)
            cy.location('pathname').should('not.contain', '404')
        })

        it('should have login activity feature enabled', () => {
            cy.visit(`${BASE_URL}/login-activity`)
            cy.location('pathname').should('not.contain', '404')
        })

        it('should have SSO config feature enabled', () => {
            cy.visit(`${BASE_URL}/sso-config`)
            cy.location('pathname').should('not.contain', '404')
        })

        it('should have users management feature enabled', () => {
            cy.visit(`${BASE_URL}/users`)
            cy.location('pathname').should('not.contain', '404')
        })

        it('should have workspace feature enabled', () => {
            cy.visit(`${BASE_URL}/workspace`)
            cy.location('pathname').should('not.contain', '404')
        })
    })

    describe('User Management (Phase 1.1)', () => {
        it('should display users table with backend data', () => {
            cy.visit(`${BASE_URL}/users`)
            // Wait for data to load
            cy.get('table', { timeout: 5000 }).should('be.visible')
            // Should have at least header row
            cy.get('th').should('have.length.greaterThan', 0)
        })

        it('should be able to invite a user', () => {
            cy.visit(`${BASE_URL}/users`)
            cy.get('button').contains('Invite User').click()
            cy.get('input[name="email"]').type('newuser@test.com')
            cy.get('select[name="role"]').select('viewer')
            cy.get('button').contains('Invite').click()
            cy.get('.snackbar, .toast').should('contain', 'success')
        })
    })

    describe('File Management (Phase 1.3)', () => {
        it('should display files page', () => {
            cy.visit(`${BASE_URL}/files`)
            cy.get('[data-testid="files-container"]').should('be.visible')
        })

        it('should upload a file', () => {
            cy.visit(`${BASE_URL}/files`)
            cy.get('input[type="file"]').selectFile('cypress/fixtures/sample.txt')
            cy.get('button').contains('Upload').click()
            cy.get('.snackbar, .toast').should('contain', 'success')
        })
    })

    describe('Workspace Management (Phase 1.5)', () => {
        it('should display workspace page', () => {
            cy.visit(`${BASE_URL}/workspace`)
            cy.get('table, [data-testid*="workspace"]').should('be.visible')
        })

        it('should allow workspace creation', () => {
            cy.visit(`${BASE_URL}/workspace`)
            cy.get('button').contains('New Workspace').click()
            cy.get('input[name="name"]').type('Test Workspace')
            cy.get('button').contains('Create').click()
            cy.get('.snackbar, .toast').should('contain', 'success')
        })
    })

    describe('RBAC Permissions (Phase 1.2)', () => {
        it('should load permissions from backend', () => {
            // Check that permissions are loaded in localStorage
            cy.window().then((win) => {
                const permissions = JSON.parse(win.localStorage.getItem('permissions') || '[]')
                expect(permissions.length).to.be.greaterThan(0)
            })
        })

        it('should enforce viewer role restrictions', () => {
            // Logout and login as viewer
            cy.visit(`${BASE_URL}/login`)
            cy.get('input[name="email"]').type('viewer@test.com')
            cy.get('input[name="password"]').type('password')
            cy.get('button[type="submit"]').click()

            // Check that admin buttons are disabled/hidden
            cy.visit(`${BASE_URL}/users`)
            cy.get('button').contains('Invite User').should('not.exist')
        })
    })

    describe('Marketplace Templates (Phase 2.1)', () => {
        it('should display marketplace with templates', () => {
            cy.visit(`${BASE_URL}/marketplace`)
            cy.get('[data-testid*="template"]').should('have.length.greaterThan', 0)
        })

        it('should use a marketplace template', () => {
            cy.visit(`${BASE_URL}/marketplace`)
            cy.get('button').contains('Use Template').first().click()
            // Should redirect to canvas with new flow
            cy.location('pathname').should('contain', '/canvas')
            cy.get('[data-testid="canvas-container"]').should('be.visible')
        })
    })

    describe('Accessibility & Performance', () => {
        it('should not have critical accessibility issues', () => {
            cy.visit(`${BASE_URL}/chatflows`)
            cy.injectAxe()
            cy.checkA11y(null, { runOnly: { type: 'critical' } })
        })

        it('should split chunks in vite build', () => {
            // Check that multiple chunks are loaded (not a single bundle)
            cy.visit(`${BASE_URL}`)
            cy.window().then((win) => {
                const scripts = Array.from(win.document.querySelectorAll('script[src]'))
                const chunkScripts = scripts.filter(s => s.src.includes('.js'))
                expect(chunkScripts.length).to.be.greaterThan(1)
            })
        })
    })

    describe('Error Handling', () => {
        it('should handle 404 errors gracefully', () => {
            cy.visit(`${BASE_URL}/nonexistent-page`, { failOnStatusCode: false })
            cy.get('text').should('contain', '404').or('contain', 'Not Found')
        })

        it('should show error messages for failed API calls', () => {
            cy.intercept('GET', '*/api/users', { statusCode: 500, body: { error: 'Server error' } })
            cy.visit(`${BASE_URL}/users`)
            cy.get('.error, .alert').should('be.visible')
        })
    })
})
