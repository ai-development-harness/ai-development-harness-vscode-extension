import { defineConfig } from '@vscode/test-cli';

export default defineConfig({
  files: 'tests/integration/**/*.test.js',
  mocha: {
    timeout: 20000,
  },
});
