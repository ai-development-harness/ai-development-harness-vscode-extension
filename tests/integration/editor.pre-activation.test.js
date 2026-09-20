const assert = require('assert');
const fs = require('fs/promises');
const path = require('path');
const vscode = require('vscode');

suite('STEP editor pre-activation (STEP-023)', () => {
  test('обрабатывает открытый до первой activation STEP в custom manifest taskDirectory', async () => {
    const ext = vscode.extensions.getExtension('ai-development-harness.harness-navigator');
    const root = vscode.workspace.workspaceFolders[0].uri.fsPath;
    const manifestPath = path.join(root, '.harness', 'manifest.yaml');
    const targetDirectory = path.join(root, 'custom', 'steps');
    const target = path.join(targetDirectory, 'STEP-101.md');
    const originalManifest = await fs.readFile(manifestPath, 'utf8');
    const fixture = await fs.readFile(path.join(root, 'planning', 'tasks', 'STEP-1.md'), 'utf8');

    try {
      await fs.mkdir(targetDirectory, { recursive: true });
      await fs.writeFile(manifestPath, originalManifest.replace('taskDirectory: planning/tasks', 'taskDirectory: custom/steps'));
      await fs.writeFile(target, fixture.replace('STEP-1', 'STEP-101').replace('не требуется', 'REQ-999'));

      const document = await vscode.workspace.openTextDocument(vscode.Uri.file(target));
      await vscode.window.showTextDocument(document);
      // Custom path не покрывается static filenamePatterns. Отдельный Extension
      // Host гарантирует, что initial sweep выполняется при первой activation.
      assert.strictEqual(document.languageId, 'markdown');
      await ext.activate();
      await new Promise((resolve) => setTimeout(resolve, 400));
      const assigned = vscode.workspace.textDocuments.find((candidate) => candidate.uri.fsPath === target) ?? document;
      assert.strictEqual(assigned.languageId, 'harness-step');
      assert.ok(vscode.languages.getDiagnostics(assigned.uri).some((item) => item.message.includes('REQ-999')));
    } finally {
      try {
        await fs.writeFile(manifestPath, originalManifest);
      } finally {
        // Cleanup не зависит от результата восстановления manifest: следующий
        // isolated run всегда получает исходное fixture-состояние без custom STEP.
        await fs.rm(target, { force: true });
        await fs.rmdir(targetDirectory).catch(() => undefined);
        await fs.rmdir(path.join(root, 'custom')).catch(() => undefined);
      }
    }
  });
});
