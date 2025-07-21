
describe('Главная страница', () => {
    it('загружается без ошибок', () => {
        cy.visit('/');
        cy.contains('File Sharer');
    });
});
