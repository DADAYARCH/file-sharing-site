describe('Скачивание', () => {
    it('позволяет скачать загруженный файл', () => {
        cy.visit('/');

        cy.intercept('POST', '/api/upload-chunk*').as('uploadChunk');
        cy.intercept('POST', '/api/link').as('createLink');
        cy.intercept('GET', '/api/link/*').as('validateLink');
        cy.intercept('GET', /\/api\/files\/[^/]+$/).as('fileInfo');

        cy.get('input[type=file]').should('exist').attachFile('small.txt', { force: true });

        cy.wait('@uploadChunk', { timeout: 10000 });
        cy.contains('100%', { timeout: 10000 }).should('be.visible');

        cy.wait('@createLink', { timeout: 10000 });

        cy.get('[data-testid=link-for-share]')
            .should('contain','/download/')
            .invoke('attr', 'href')
            .then((href)=>{
                expect(href, 'download page href').to.match(/^\/download\//);
                cy.visit(href);
            });

        cy.wait('@validateLink').its('response.statusCode').should('eq', 200);
        cy.wait('@fileInfo').its('response.statusCode').should('eq', 200);

        cy.contains('Скачать файл')
            .should('have.attr', 'href')
            .then((fileHref) => {
                cy.request({
                    url: fileHref,
                    encoding: 'binary',
                    followRedirect: true,
                }).then((resp) => {
                    expect(resp.status).to.eq(200);

                    const cd = resp.headers['content-disposition'] || '';
                    expect(cd).to.include('small.txt');
                    expect(resp.body, 'file body length').to.have.length.greaterThan(0);
                });
            });
    });
});
