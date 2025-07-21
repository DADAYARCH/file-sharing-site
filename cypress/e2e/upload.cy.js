/* eslint-env mocha, cypress */
describe('Файлозагрузчик', () => {
    it('показывает область drag-n-drop', () => {
        cy.visit('/');
        cy.contains('Перетащите файл сюда').should('be.visible');
    });
});