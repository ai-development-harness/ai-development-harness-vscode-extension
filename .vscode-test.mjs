import { defineConfig } from '@vscode/test-cli';

// В sandbox нет Snap mount, но процесс может унаследовать Snap-переменные.
// Без них Extension Host использует уже скачанный `.vscode-test` runtime и
// не пытается подписаться на отсутствующий `/snap/code`.
delete process.env.SNAP;
delete process.env.SNAP_NAME;
delete process.env.SNAP_REVISION;

export default defineConfig({
  files: 'tests/integration/**/*.test.js',
  // STEP-004: нужен реально открытый workspace, чтобы `activateI18n` мог
  // резолвить `.project/harness-config.json` внутри Extension Host.
  workspaceFolder: 'tests/fixtures/workspace',
  mocha: {
    timeout: 20000,
  },
});
