const assert = require('assert');
const fs = require('fs/promises');
const path = require('path');
const vscode = require('vscode');

suite('i18n service (STEP-004)', () => {
  const configPath = () => {
    const folder = vscode.workspace.workspaceFolders?.[0];
    assert.ok(folder, 'ожидался открытый workspace (см. .vscode-test.mjs → workspaceFolder)');
    return path.join(folder.uri.fsPath, '.project', 'harness-config.json');
  };

  suiteTeardown(async () => {
    await fs.rm(path.dirname(configPath()), { recursive: true, force: true });
  });

  test('команда harness.changeLanguage зарегистрирована', async () => {
    const ext = vscode.extensions.getExtension('ai-development-harness.harness-navigator');
    await ext.activate();
    const commands = await vscode.commands.getCommands(true);
    assert.ok(commands.includes('harness.changeLanguage'), 'команда не найдена в реестре');
  });

  test('программный вызов с явным языком сохраняет выбор на диске', async () => {
    await vscode.commands.executeCommand('harness.changeLanguage', 'en');

    const raw = await fs.readFile(configPath(), 'utf8');
    assert.deepStrictEqual(JSON.parse(raw), { language: 'en' });
  });

  test('сохранённое значение читается независимо (эквивалент "переживает перезапуск")', async () => {
    const raw = await fs.readFile(configPath(), 'utf8');
    assert.deepStrictEqual(JSON.parse(raw), { language: 'en' });
  });
});
