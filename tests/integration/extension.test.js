const assert = require('assert');
const vscode = require('vscode');

suite('Extension activation', () => {
  test('extension activates without throwing', async () => {
    const ext = vscode.extensions.getExtension('ai-development-harness.harness-navigator');
    assert.ok(ext, 'extension not found by id');
    await ext.activate();
    assert.strictEqual(ext.isActive, true);
  });
});
