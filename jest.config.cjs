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
            branches: 0,
            functions: 0,
            lines: 0,
            statements: 0
        }
    }
}
