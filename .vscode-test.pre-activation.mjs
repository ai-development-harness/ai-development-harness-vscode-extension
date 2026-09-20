import { defineConfig } from '@vscode/test-cli';

// В sandbox нет Snap mount, но процесс может унаследовать Snap-переменные.
// Без них isolated Extension Host использует `.vscode-test` runtime и не
// пытается подписаться на отсутствующий `/snap/code`.
delete process.env.SNAP;
delete process.env.SNAP_NAME;
delete process.env.SNAP_REVISION;

export default defineConfig({
  files: 'tests/integration/**/*.pre-activation.test.js',
  // Отдельный process гарантирует, что документ открывается до первой
  // activation extension, а не после already-active основной suite.
  workspaceFolder: 'tests/fixtures/workspace',
  mocha: {
    timeout: 20000,
  },
});
