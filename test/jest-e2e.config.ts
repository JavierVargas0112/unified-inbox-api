import type { Config } from 'jest';

// End-to-end tests: the real app against a real PostgreSQL. Needs DATABASE_URL.
const config: Config = {
  displayName: 'e2e',
  rootDir: '..',
  testEnvironment: 'node',
  moduleFileExtensions: ['js', 'json', 'ts'],
  testRegex: 'test/.*\\.e2e-spec\\.ts$',
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }] },
};

export default config;
