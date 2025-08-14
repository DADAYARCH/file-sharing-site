const { defaults: tsjPreset } = require('ts-jest/presets')

module.exports = {
    ...tsjPreset.esm,

    extensionsToTreatAsEsm: ['.ts', '.tsx'],

    testEnvironment: 'jsdom',

    transform: {
        '^.+\\.[tj]sx?$': ['ts-jest', { useESM: true }],
        '^.+\\.jsx?$': 'babel-jest'
    },

    moduleNameMapper: {
        '^(\\.{1,2}/.*)\\.js$': '$1'
    },

    moduleFileExtensions: ['ts','tsx','js','jsx','json'],

    setupFilesAfterEnv: ['<rootDir>/src/setupTests.ts'],

    collectCoverage: true,
    coverageDirectory: 'coverage',
    coverageThreshold: {
        global: {
            branches: 50,
            functions: 50,
            lines: 50,
            statements: 50
        }
    }
}
