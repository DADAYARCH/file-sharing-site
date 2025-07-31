/* eslint-env mocha, cypress */
import 'cypress-file-upload';

describe('Chunk upload flow', () => {
    it('завершает загрузку и показывает ссылку на скачивание (и до этого был прогресс)', () => {
        cy.visit('/');

        cy.intercept('POST', '/api/upload-chunk*').as('uploadChunk');

        cy.get('input[type=file]').should('exist').attachFile('small.txt', { force: true });

        cy.wait('@uploadChunk', { timeout: 10000 });

        cy.contains('100%', { timeout: 10000 }).should('be.visible');

        cy.contains('Перейти к странице скачивания', { timeout: 15000 }).should('be.visible');
    });
});
