module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'jsdom',
    moduleFileExtensions: ['ts','tsx','js','jsx','json'],
    transform: {
        '^.+\\.[jt]sx?$': 'ts-jest'
    },
    collectCoverage: true,
    coverageDirectory: 'coverage',
    coverageThreshold: {
        global: {
            branches: 0,
            functions: 0,
            lines: 0,
            statements: 0
        }
    },
    setupFilesAfterEnv: ['<rootDir>/src/setupTests.ts'],
};
