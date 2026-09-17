import { defineConfig } from '@vscode/test-cli';

export default defineConfig({
  files: 'tests/integration/**/*.test.js',
  // STEP-004: нужен реально открытый workspace, чтобы `activateI18n` мог
  // резолвить `.project/harness-config.json` внутри Extension Host.
  workspaceFolder: 'tests/fixtures/workspace',
  mocha: {
    timeout: 20000,
  },
});
