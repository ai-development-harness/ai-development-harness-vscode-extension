/** @type {import('jest').Config} */
export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests/unit'],
  testMatch: ['**/*.test.ts'],
  collectCoverageFrom: ['src/**/*.ts'],
  passWithNoTests: true,
  // FIX STEP-006 (F-001): lets treeProvider.test.ts exercise the real
  // vscode-facing `HarnessTreeDataProvider` against a minimal stub, instead
  // of leaving that layer with zero test coverage.
  moduleNameMapper: {
    '^vscode$': '<rootDir>/tests/mocks/vscode.ts',
  },
};
