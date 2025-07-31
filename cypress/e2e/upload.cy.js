/* eslint-env mocha, cypress */
describe('Файлозагрузчик', () => {
    it('показывает область drag-n-drop', () => {
        cy.visit('/');
        cy.contains('Перетащите файлы сюда или нажмите').should('be.visible');
    });
});