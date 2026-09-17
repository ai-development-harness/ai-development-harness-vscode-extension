const assert = require('assert');
const vscode = require('vscode');

const EXPECTED_COMMANDS = [
  'harness.init',
  'harness.addStep',
  'harness.plan',
  'harness.implement',
  'harness.review',
  'harness.fix',
  'harness.run',
  'harness.nextStep',
  'harness.status',
  'harness.quickFix',
  'harness.reconcile',
];

suite('Harness commands (STEP-005)', () => {
  test('все 11 MVP-команд зарегистрированы под harness.*', async () => {
    const ext = vscode.extensions.getExtension('ai-development-harness.harness-navigator');
    await ext.activate();
    const commands = await vscode.commands.getCommands(true);
    for (const id of EXPECTED_COMMANDS) {
      assert.ok(commands.includes(id), `команда ${id} не найдена в реестре`);
    }
  });

  test('STATUS PROJECT — реальный read-only вызов не бросает исключение', async () => {
    // Не интерактивна (`inputKind: 'none'`, дальше — showInformationMessage без
    // ожидания ответа), поэтому безопасна для автоматического прогона в
    // Extension Host без риска зависнуть на модальном UI.
    await vscode.commands.executeCommand('harness.status');
  });
});
