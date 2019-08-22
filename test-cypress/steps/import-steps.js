/**
 * Reusable functions for interacting with the import page.
 */
class ImportSteps {

    static visitUserImport(repository) {
        ImportSteps.visitImport('user', repository);
    }

    static visitServerImport(repository) {
        ImportSteps.visitImport('server', repository);
    }

    static visitImport(type, repository) {
        cy.visit('/import#' + type);

        if (repository) {
            cy.selectRepo(repository);
        }

        cy.get('#import-' + type).should('be.visible');

        return ImportSteps;
    }

    static openImportURLDialog(importURL) {
        cy.get('#import-user .import-from-url-btn').click();
        cy.get('.url-import-form input[name="dataUrl"]').type(importURL).should('have.value', importURL);

        return ImportSteps;
    }

    static openImportTextSnippetDialog() {
        cy.get('#import-user .import-rdf-snippet-btn').click();
        ImportSteps.getSnippetTextarea().should('be.visible');

        return ImportSteps;
    }

    static clickImportUrlButton() {
        cy.get('#wb-import-importUrl').click();

        return ImportSteps;
    }

    static selectRDFFormat(rdfFormat) {
        cy.get('.modal-footer .import-format-dropdown').within(() => {
            cy.get('.import-format-dropdown-btn').click();
            cy.get('.dropdown-item').contains(rdfFormat).click().should('not.be.visible');
        });

        return ImportSteps;
    }

    static fillRDFTextSnippet(snippet) {
        ImportSteps.getSnippetTextarea().type(snippet).should('have.value', snippet);

        return ImportSteps;
    }

    static pasteRDFTextSnippet(snippet) {
        ImportSteps.getSnippetTextarea().invoke('val', snippet).trigger('change');

        return ImportSteps;
    }

    static clickImportTextSnippetButton() {
        cy.get('#wb-import-importText').click();

        return ImportSteps;
    }

    static removeUploadedFiles() {
        ImportSteps.selectAllUserFiles();
        cy.get('#wb-import-removeEntries').click();
        cy.get('#wb-import-fileInFiles').should('be.hidden');

        return ImportSteps;
    }

    static selectAllUserFiles() {
        cy.get('#import-user .select-all-files').check();

        return ImportSteps;
    }

    static getSnippetTextarea() {
        return cy.get('#wb-import-textarea');
    }

    static selectServerFile(filename) {
        ImportSteps.getServerFileElement(filename).find('.import-file-checkbox').click();

        return ImportSteps;
    }

    static selectAllServerFiles() {
        cy.get('#import-server .select-all-files').check();

        return ImportSteps;
    }

    static importServerFiles(changeSettings) {
        if (changeSettings) {
            // TODO: Check for dialog?
            cy.get('#import-server .import-btn').click();
        } else {
            cy.get('#import-server .import-dropdown-btn').click();
            cy.get('#import-server .import-without-change-btn').click();
        }

        return ImportSteps;
    }

    static importFromSettingsDialog() {
        // TODO: cy.confirmDialog() ?
        // Dialog should disappear
        cy.get('.modal-footer > .btn-primary').click().should('not.exist');

        return ImportSteps;
    }

    static getSettingsForm() {
        return cy.get('.modal .settings-form');
    }

    static fillBaseURI(baseURI) {
        ImportSteps.getSettingsForm().find('input[name="baseURI"]').type(baseURI).should('have.value', baseURI);

        return ImportSteps;
    }

    static selectNamedGraph() {
        ImportSteps.getSettingsForm().find('.named-graph-option').check();

        return ImportSteps;
    }

    static fillNamedGraph(namedGraph) {
        ImportSteps.getSettingsForm().find('.named-graph-input').type(namedGraph).should('have.value', namedGraph);

        return ImportSteps;
    }

    static expandAdvancedSettings() {
        ImportSteps.getSettingsForm().within(() => {
            cy.get('.toggle-advanced-settings').click();
            cy.get('.advanced-settings').should('be.visible');
        });

        return ImportSteps;
    }

    static enablePreserveBNodes() {
        ImportSteps.getSettingsForm().find('input[name="preserveBNodeIDs"]').check();

        return ImportSteps;
    }

    static resetStatusOfUploadedFiles() {
        // Button should disappear
        cy.get('#import-server #wb-import-clearStatuses').click().should('not.be.visible');

        return ImportSteps;
    }

    static resetStatusOfUploadedFile(filename) {
        // List is re-rendered -> ensure it is detached
        ImportSteps
            .getServerFileElement(filename)
            .find('.import-status .import-status-reset')
            .click()
            .should('not.exist');

        return ImportSteps;
    }

    static verifyImportStatusDetails(fileToSelect, details) {
        ImportSteps.getServerFileElement(fileToSelect).find('.import-status .import-status-info').then(infoIconEl => {
            cy.wrap(infoIconEl).should('be.visible');
            cy.wrap(infoIconEl).trigger('mouseover');

            cy.get('.popover-content').then(content => {
                cy.wrap(content).should('be.visible');

                if (details instanceof Array) {
                    details.forEach(text => {
                        cy.wrap(content).should('contain', text);
                    })
                } else {
                    cy.wrap(content).should('contain', details);
                }
            });

            cy.wrap(infoIconEl).trigger('mouseout');
            cy.get('.popover-content').should('not.be.visible').and('not.exist');
        });

        return ImportSteps;
    }

    static verifyImportStatus(filename, message) {
        // Increase the default timeout to allow longer imports to finish
        ImportSteps
            .getServerFileElement(filename)
            .find('.import-status .import-status-message', {timeout: 30000})
            .should('be.visible').and('contain', message);

        return ImportSteps;
    }

    static verifyNoImportStatus(filename) {
        ImportSteps
            .getServerFileElement(filename)
            .find('.import-status')
            .should('not.be.visible');

        return ImportSteps;
    }

    static getServerFileElement(filename) {
        // Find the element containing the filename and get then the parent row element
        return cy.get('#wb-import-fileInFiles .import-file-header')
            .contains(filename)
            .parentsUntil('.import-file-row')
            .parent();
    }
}

export default ImportSteps;