/* eslint-env mocha, cypress */

describe('Chunk upload flow', () => {
    it('показывает прогресс до 100%', () => {
        cy.visit('/')

        cy.get('input[type=file]').attachFile('small.txt')

        cy.contains('100%').should('be.visible')
    })
})
