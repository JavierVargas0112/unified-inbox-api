import type { Config } from 'jest';

/**
 * What CI runs: unit and e2e suites together, with one coverage report.
 * Adapters and rules are covered by unit tests, services and controllers by
 * e2e tests against PostgreSQL; the threshold applies to the sum.
 */
const config: Config = {
  projects: ['<rootDir>/jest.config.ts', '<rootDir>/test/jest-e2e.config.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/main.ts',
    '!src/**/*.spec.ts',
    '!src/database/data-source.ts',
    // Executed by TypeORM against the database, verified by the schema drift check.
    '!src/database/migrations/**',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text-summary', 'lcov', 'json-summary'],
  coverageThreshold: {
    global: { branches: 90, functions: 90, lines: 90, statements: 90 },
  },
};

export default config;
