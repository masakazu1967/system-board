module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.spec.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: {
        moduleResolution: 'node',
      }
    }],
  },
  moduleNameMapper: {
    '^uuid$': require.resolve('uuid'),
  },
  transformIgnorePatterns: [
    'node_modules/(?!(uuid)/)',
  ],
  collectCoverage: true,
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/index.ts',
    '!src/structured-logger.ts',
    '!src/nestjs-integration.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches: 2,
      functions: 5,
      lines: 5,
      statements: 5,
    },
  },
  moduleFileExtensions: ['ts', 'js', 'json', 'node'],
  verbose: true,
};