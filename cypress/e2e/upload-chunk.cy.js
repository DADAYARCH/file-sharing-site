/* eslint-env mocha, cypress */

describe('Chunk upload flow', () => {
    it('показывает прогресс до 100%', () => {
        cy.visit('/')

        cy.fixture('small.txt', 'base64').then((content) => {
            const blob = Cypress.Blob.base64StringToBlob(content)
            const file = new File([blob], 'small.txt', { type: 'text/plain' })
            cy.get('input[type=file]').attachFile({ file, fileName: 'small.txt' })
        })

        cy.contains('100%').should('be.visible')
    })
})
