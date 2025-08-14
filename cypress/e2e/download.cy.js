
describe('Скачивание', () => {
    it('позволяет скачать загруженный файл', () => {
        cy.visit('/');
        cy.contains('File Sharer');
    });
});
