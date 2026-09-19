const assert = require('assert');
const vscode = require('vscode');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');

// Перехватываем реальные VSCode sinks до первой activation, чтобы regression
// проходил полный Command Palette → dispatcher → Output Channel/UI путь.
const outputLines = [];
const warningMessages = [];
const errorMessages = [];
const originalCreateOutputChannel = vscode.window.createOutputChannel.bind(vscode.window);
const originalShowWarningMessage = vscode.window.showWarningMessage.bind(vscode.window);
const originalShowErrorMessage = vscode.window.showErrorMessage.bind(vscode.window);
vscode.window.createOutputChannel = (...args) => {
  const channel = originalCreateOutputChannel(...args);
  const appendLine = channel.appendLine.bind(channel);
  channel.appendLine = (line) => {
    outputLines.push(String(line));
    return appendLine(line);
  };
  return channel;
};
vscode.window.showWarningMessage = (...args) => {
  warningMessages.push(args.map(String).join(' '));
  return originalShowWarningMessage(...args);
};
vscode.window.showErrorMessage = (...args) => {
  errorMessages.push(args.map(String).join(' '));
  return originalShowErrorMessage(...args);
};

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

  test('write-команда не запускает fake executor и cancel остаётся безопасным', async () => {
    const binDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'harness-extension-cancel-'));
    const marker = path.join(binDirectory, 'started');
    const executable = path.join(binDirectory, 'codex');
    await fs.writeFile(executable, `#!/bin/sh\nprintf '%s' started > "${marker}"\n`);
    await fs.chmod(executable, 0o755);
    await vscode.workspace.getConfiguration('harness').update('executables.codex', executable, true);
    const previousPath = process.env.PATH;
    process.env.PATH = `${binDirectory}${path.delimiter}${previousPath}`;
    try {
      await vscode.commands.executeCommand('harness.plan', 'STEP-1');
      await vscode.commands.executeCommand('harness.cancelAgent');
      await assert.rejects(fs.access(marker), /ENOENT/, 'ADR-008 не допускает spawn write executor');
    } finally {
      await vscode.workspace.getConfiguration('harness').update('executables.codex', '', true);
      process.env.PATH = previousPath;
      await fs.rm(binDirectory, { recursive: true, force: true });
    }
  });

  test('RU/EN FIX STEP показывает exact canonical command и полный localized handoff в обоих sink без context/spawn/reload fake Codex', async () => {
    const binDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'harness-extension-cli-'));
    const promptFile = path.join(binDirectory, 'prompt.txt');
    const executable = path.join(binDirectory, 'codex');
    const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
    const stepPath = path.join(workspaceRoot, 'planning', 'tasks', 'STEP-009.md');
    const fixture = await fs.readFile(path.join(workspaceRoot, 'planning', 'tasks', 'STEP-1.md'), 'utf8');
    await fs.writeFile(executable, `#!/bin/sh\ncat > "${promptFile}"\n`);
    await fs.chmod(executable, 0o755);
    await vscode.workspace.getConfiguration('harness').update('executables.codex', executable, true);
    const previousPath = process.env.PATH;
    process.env.PATH = `${binDirectory}${path.delimiter}${previousPath}`;
    try {
      // Реальный Command Palette path требует CTS-valid FIX target; общий
      // fixture содержит только terminal STEP-1, поэтому создаём его локально.
      await fs.writeFile(stepPath, fixture
        .replaceAll('STEP-1', 'STEP-009')
        .replace('**Статус:** Выполнено', '**Статус:** В работе')
        .replace('**Latest verdict:** PASS', '**Latest verdict:** FAIL'));
      for (const [language, manualFallback] of [
        ['ru', 'Автоматический запуск агента недоступен в MVP. Выполните команду вручную в контролируемом terminal: STEP FIX STEP-009'],
        ['en', 'Automatic agent invocation is unavailable in the MVP. Run the command manually in a terminal you control: STEP FIX STEP-009'],
      ]) {
        await vscode.commands.executeCommand('harness.changeLanguage', language);
        const outputStart = outputLines.length;
        const warningStart = warningMessages.length;
        const errorStart = errorMessages.length;
        await vscode.commands.executeCommand('harness.fix', 'STEP-009');
        const output = outputLines.slice(outputStart);
        const warnings = warningMessages.slice(warningStart);
        const errors = errorMessages.slice(errorStart);
        assert.deepStrictEqual(output, ['STEP FIX STEP-009'], `${language}: exact Output Channel command`);
        assert.deepStrictEqual(warnings, [manualFallback], `${language}: exact localized notification`);
        assert.deepStrictEqual(errors, [], `${language}: exact command must not show an error notification`);
      }
      await assert.rejects(fs.access(promptFile), /ENOENT/, 'manual fallback не передаёт prompt процессу');
    } finally {
      await vscode.commands.executeCommand('harness.changeLanguage', 'ru');
      await vscode.workspace.getConfiguration('harness').update('executables.codex', '', true);
      process.env.PATH = previousPath;
      await fs.rm(stepPath, { force: true });
      await fs.rm(binDirectory, { recursive: true, force: true });
    }
  });

  test('write-команда не запускает secondary Claude executor', async () => {
    const binDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'harness-extension-claude-'));
    const marker = path.join(binDirectory, 'claude-ran');
    const executable = path.join(binDirectory, 'claude');
    await fs.writeFile(executable, `#!/bin/sh\nprintf '%s' fallback > "${marker}"\n`);
    await fs.chmod(executable, 0o755);
    await vscode.workspace.getConfiguration('harness').update('executables.claude', executable, true);
    // Context builder также читает git status; symlink резолвится вне fixture и
    // сохраняет тест изолированным от реального PATH Extension Host.
    await fs.symlink('/usr/bin/git', path.join(binDirectory, 'git'));
    const previousPath = process.env.PATH;
    process.env.PATH = binDirectory;
    try {
      await vscode.commands.executeCommand('harness.plan', 'STEP-1');
      await assert.rejects(fs.access(marker), /ENOENT/, 'ADR-008 блокирует fallback CLI до spawn');
    } finally {
      await vscode.workspace.getConfiguration('harness').update('executables.claude', '', true);
      process.env.PATH = previousPath;
      await fs.rm(binDirectory, { recursive: true, force: true });
    }
  });

  test('RU/EN descriptor обеих text-команд не раскрывает pure-normal или hostile input в Output Channel/UI и не запускает CLI', async () => {
    const binDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'harness-extension-hostile-text-'));
    const codexMarker = path.join(binDirectory, 'codex-spawned');
    const claudeMarker = path.join(binDirectory, 'claude-spawned');
    const codex = path.join(binDirectory, 'codex');
    const claude = path.join(binDirectory, 'claude');
    const secret = 'real-secret-value';
    // Pure-normal marker доказывает never-echo boundary отдельно от redaction
    // secret/control payload, который проверяется второй fixture ниже.
    const ordinaryIntent = 'ordinary-intent-sentinel';
    const normalIntent = `add public roadmap card ${ordinaryIntent}`;
    const hostileIntent = `${ordinaryIntent} to\rken=${secret}\n\x1b[31mxoxb-1234567890-secret\u2028\u202e`;
    await fs.writeFile(codex, `#!/bin/sh\nprintf codex > "${codexMarker}"\n`);
    await fs.writeFile(claude, `#!/bin/sh\nprintf claude > "${claudeMarker}"\n`);
    await fs.chmod(codex, 0o755);
    await fs.chmod(claude, 0o755);
    await vscode.workspace.getConfiguration('harness').update('executables.codex', codex, true);
    await vscode.workspace.getConfiguration('harness').update('executables.claude', claude, true);
    try {
      for (const [command, descriptorPrefix] of [
        ['harness.addStep', 'STEP ADD'],
        ['harness.quickFix', 'PROJECT QUICK FIX'],
      ]) {
        for (const [language, descriptor, manualFallback] of [
          ['ru', `${descriptorPrefix}: неисполняемый шаблон; повторите описание вручную в agent CLI`, `Автоматический запуск агента недоступен в MVP. Выполните команду вручную в контролируемом terminal: ${descriptorPrefix}: неисполняемый шаблон; повторите описание вручную в agent CLI`],
          ['en', `${descriptorPrefix}: non-executable template; repeat the description manually in the agent CLI`, `Automatic agent invocation is unavailable in the MVP. Run the command manually in a terminal you control: ${descriptorPrefix}: non-executable template; repeat the description manually in the agent CLI`],
        ]) {
          for (const [fixture, input] of [['pure-normal', normalIntent], ['hostile', hostileIntent]]) {
            await vscode.commands.executeCommand('harness.changeLanguage', language);
            const outputStart = outputLines.length;
            const warningStart = warningMessages.length;
            const errorStart = errorMessages.length;
            await vscode.commands.executeCommand(command, input);
            const output = outputLines.slice(outputStart);
            const warnings = warningMessages.slice(warningStart);
            const errors = errorMessages.slice(errorStart);
            assert.deepStrictEqual(output, [descriptor], `${command}/${language}/${fixture}: exact Output Channel descriptor`);
            assert.deepStrictEqual(warnings, [manualFallback], `${command}/${language}/${fixture}: exact localized notification`);
            assert.deepStrictEqual(errors, [], `${command}/${language}/${fixture}: valid input must not show an error notification`);
            assert.ok(output.every((value) => !value.includes(ordinaryIntent) && !value.includes(secret) && !/xoxb-|[\r\n\x1b\u2028\u2029\u202e]/u.test(value)), `${command}/${language}/${fixture}: unsafe value reached Output Channel`);
            assert.ok(warnings.every((value) => !value.includes(ordinaryIntent) && !value.includes(secret) && !/xoxb-|[\r\n\x1b\u2028\u2029\u202e]/u.test(value)), `${command}/${language}/${fixture}: unsafe value reached notification`);
          }
        }
      }
      await assert.rejects(fs.access(codexMarker), /ENOENT/, 'manual handoff не должен запускать fake Codex');
      await assert.rejects(fs.access(claudeMarker), /ENOENT/, 'manual handoff не должен запускать fake Claude');
    } finally {
      await vscode.commands.executeCommand('harness.changeLanguage', 'ru');
      await vscode.workspace.getConfiguration('harness').update('executables.codex', '', true);
      await vscode.workspace.getConfiguration('harness').update('executables.claude', '', true);
      await fs.rm(binDirectory, { recursive: true, force: true });
    }
  });

  test('RU/EN invalid text input показывает точный blocker без handoff и запуска CLI', async () => {
    const binDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'harness-extension-invalid-text-'));
    const codexMarker = path.join(binDirectory, 'codex-spawned');
    const claudeMarker = path.join(binDirectory, 'claude-spawned');
    const codex = path.join(binDirectory, 'codex');
    const claude = path.join(binDirectory, 'claude');
    await fs.writeFile(codex, `#!/bin/sh\nprintf codex > "${codexMarker}"\n`);
    await fs.writeFile(claude, `#!/bin/sh\nprintf claude > "${claudeMarker}"\n`);
    await fs.chmod(codex, 0o755);
    await fs.chmod(claude, 0o755);
    await vscode.workspace.getConfiguration('harness').update('executables.codex', codex, true);
    await vscode.workspace.getConfiguration('harness').update('executables.claude', claude, true);
    try {
      for (const command of ['harness.addStep', 'harness.quickFix']) {
        for (const [language, blocker] of [
          ['ru', 'Невозможно собрать безопасный контекст агента: Команда должна содержать непустой корректный ввод без управляющих символов.'],
          ['en', 'Cannot build safe agent context: The command must contain a non-empty valid input without control characters.'],
        ]) {
          await vscode.commands.executeCommand('harness.changeLanguage', language);
          const outputStart = outputLines.length;
          const warningStart = warningMessages.length;
          const errorStart = errorMessages.length;
          for (const input of ['', ' \t ', '\u001b\u2028\u202e']) {
            await vscode.commands.executeCommand(command, input);
          }
          const output = outputLines.slice(outputStart);
          const warnings = warningMessages.slice(warningStart);
          const errors = errorMessages.slice(errorStart);
          assert.deepStrictEqual(errors, [blocker, blocker, blocker], `${command}/${language}: exact localized blocker`);
          assert.deepStrictEqual(output, [], `${command}/${language}: invalid input must stop before manual handoff`);
          assert.deepStrictEqual(warnings, [], `${command}/${language}: invalid input must not show handoff notification`);
        }
      }
      await assert.rejects(fs.access(codexMarker), /ENOENT/, 'invalid input не должен запускать fake Codex');
      await assert.rejects(fs.access(claudeMarker), /ENOENT/, 'invalid input не должен запускать fake Claude');
    } finally {
      await vscode.commands.executeCommand('harness.changeLanguage', 'ru');
      await vscode.workspace.getConfiguration('harness').update('executables.codex', '', true);
      await vscode.workspace.getConfiguration('harness').update('executables.claude', '', true);
      await fs.rm(binDirectory, { recursive: true, force: true });
    }
  });

  test('неполная Mutation policy даёт actionable pre-validation до manual handoff', async () => {
    const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
    const stepPath = path.join(workspaceRoot, 'planning', 'tasks', 'STEP-009.md');
    const fixture = await fs.readFile(path.join(workspaceRoot, 'planning', 'tasks', 'STEP-1.md'), 'utf8');
    const outputStart = outputLines.length;
    const warningStart = warningMessages.length;
    await fs.writeFile(stepPath, fixture.replace('STEP-1', 'STEP-009').replace('- docs/requirements/SPEC.md', ''));
    try {
      await vscode.commands.executeCommand('harness.plan', 'STEP-009');
      const output = outputLines.slice(outputStart);
      const warnings = warningMessages.slice(warningStart);
      assert.ok(output.includes('Pre-validation: неполная Mutation policy.'));
      assert.ok(warnings.some((value) => value.includes('Mutation policy Allowed')));
      assert.ok(!output.some((value) => value.includes('[manual fallback]')));
    } finally {
      await fs.rm(stepPath);
    }
  });

});
