const assert = require('assert');
const fs = require('fs/promises');
const path = require('path');
const vscode = require('vscode');

suite('STEP editor (STEP-007)', () => {
  test('открывает STEP-*.md как harness-step и публикует non-blocking diagnostics', async () => {
    const ext = vscode.extensions.getExtension('ai-development-harness.harness-navigator');
    await ext.activate();
    const root = vscode.workspace.workspaceFolders[0].uri.fsPath;
    const target = path.join(root, 'planning', 'tasks', 'STEP-007.md');
    const fixture = await fs.readFile(path.join(root, 'planning', 'tasks', 'STEP-1.md'), 'utf8');
    try {
      await fs.writeFile(target, fixture.replace('STEP-1', 'STEP-007').replace('не требуется', 'REQ-999'));
      const document = await vscode.workspace.openTextDocument(vscode.Uri.file(target));
      await vscode.window.showTextDocument(document);
      await new Promise((resolve) => setTimeout(resolve, 300));
      assert.strictEqual(document.languageId, 'harness-step');
      assert.ok(vscode.languages.getDiagnostics(document.uri).some((item) => item.message.includes('REQ-999')));
    } finally {
      await fs.rm(target, { force: true });
    }
  });

  test('ADR completion в реальном Extension Host заменяет prefix и хранит описание в documentation', async () => {
    const ext = vscode.extensions.getExtension('ai-development-harness.harness-navigator');
    await ext.activate();
    const root = vscode.workspace.workspaceFolders[0].uri.fsPath;
    const target = path.join(root, 'planning', 'tasks', 'STEP-008.md');
    const fixture = await fs.readFile(path.join(root, 'planning', 'tasks', 'STEP-1.md'), 'utf8');
    try {
      await fs.writeFile(target, `${fixture}\nADR-`, 'utf8');
      const document = await vscode.workspace.openTextDocument(vscode.Uri.file(target));
      const position = new vscode.Position(document.lineCount - 1, 4);
      const completionList = await vscode.commands.executeCommand('vscode.executeCompletionItemProvider', document.uri, position);
      const item = completionList.items.find((candidate) => candidate.label === 'ADR-001');

      assert.ok(item, 'ADR-001 не найден в completion list');
      assert.strictEqual(item.detail, undefined, 'описание ADR не должно попадать в строку списка');
      assert.ok(item.documentation && item.documentation.value.includes('Архитектура editor fixture'));
      assert.strictEqual(item.insertText, 'ADR-001');
      assert.strictEqual(item.range.start.character, 0);
      assert.strictEqual(item.range.end.character, 4);
    } finally {
      await fs.rm(target, { force: true });
    }
  });

  test('Definition Provider ведёт по REQ, ADR и STEP reference в prose и списке', async () => {
    const ext = vscode.extensions.getExtension('ai-development-harness.harness-navigator');
    await ext.activate();
    const root = vscode.workspace.workspaceFolders[0].uri.fsPath;
    const target = path.join(root, 'planning', 'tasks', 'STEP-009.md');
    const fixture = await fs.readFile(path.join(root, 'planning', 'tasks', 'STEP-1.md'), 'utf8');
    try {
      await fs.writeFile(target, `${fixture}\nREQ-001 ADR-001 STEP-1\n- REQ-001 ADR-001 STEP-1`, 'utf8');
      const document = await vscode.workspace.openTextDocument(vscode.Uri.file(target));
      const locationsFor = async (id, line) => {
        const character = document.lineAt(line).text.indexOf(id) + 1;
        return vscode.commands.executeCommand('vscode.executeDefinitionProvider', document.uri, new vscode.Position(line, character));
      };

      // FIX STEP-026: navigation не зависит от TextMate scopes, но оба контекста
      // остаются regression boundary, чтобы visual fix не затронул Definition Provider.
      for (const line of [document.lineCount - 2, document.lineCount - 1]) {
        const req = await locationsFor('REQ-001', line);
        const adr = await locationsFor('ADR-001', line);
        const step = await locationsFor('STEP-1', line);
        assert.ok(req.some((location) => location.uri.fsPath.endsWith(path.join('docs', 'requirements', 'REQ-001-editor-definition.md'))));
        assert.ok(adr.some((location) => location.uri.fsPath.endsWith(path.join('docs', 'adr', 'ADR-001-editor-fixture.md'))));
        assert.ok(step.some((location) => location.uri.fsPath.endsWith(path.join('planning', 'tasks', 'STEP-1.md'))));
      }
    } finally {
      await fs.rm(target, { force: true });
    }
  });

  test('PLAN CodeLens открывает roadmap на строке текущего STEP', async () => {
    const ext = vscode.extensions.getExtension('ai-development-harness.harness-navigator');
    await ext.activate();
    const root = vscode.workspace.workspaceFolders[0].uri.fsPath;
    const target = path.join(root, 'planning', 'tasks', 'STEP-007.md');
    const plan = path.join(root, 'planning', 'PLAN.md');
    const fixture = await fs.readFile(path.join(root, 'planning', 'tasks', 'STEP-1.md'), 'utf8');
    try {
      await fs.writeFile(target, fixture.replace('STEP-1', 'STEP-007'));
      await fs.writeFile(plan, '# PLAN\n\n- STEP-001\n- STEP-007 — целевая строка\n');
      const document = await vscode.workspace.openTextDocument(vscode.Uri.file(target));
      const lenses = await vscode.commands.executeCommand('vscode.executeCodeLensProvider', document.uri);
      const planLens = lenses.find((lens) => lens.command.command === 'harness.editor.openPlan');
      assert.deepStrictEqual(planLens.command.arguments, ['STEP-007']);
      await vscode.commands.executeCommand(planLens.command.command, ...planLens.command.arguments);
      assert.ok(vscode.window.activeTextEditor.document.uri.fsPath.endsWith(path.join('planning', 'PLAN.md')));
      assert.strictEqual(vscode.window.activeTextEditor.selection.start.line, 3);
    } finally { await Promise.all([fs.rm(target, { force: true }), fs.rm(plan, { force: true })]); }
  });

  test('применяет CodeAction к canonical plain acceptance bullet без изменения соседних строк', async () => {
    const ext = vscode.extensions.getExtension('ai-development-harness.harness-navigator');
    await ext.activate();
    const root = vscode.workspace.workspaceFolders[0].uri.fsPath;
    const target = path.join(root, 'planning', 'tasks', 'STEP-006.md');
    const template = await fs.readFile(path.join(ext.extensionPath, 'planning', 'tasks', 'TEMPLATE.md'), 'utf8');
    try {
      await fs.writeFile(target, template.replace('STEP-NNN', 'STEP-006'));
      const document = await vscode.workspace.openTextDocument(vscode.Uri.file(target));
      const acceptanceHeading = Array.from({ length: document.lineCount }, (_, lineNumber) => lineNumber).find((lineNumber) => document.lineAt(lineNumber).text === '## Acceptance criteria');
      const line = Array.from({ length: document.lineCount - acceptanceHeading - 1 }, (_, offset) => acceptanceHeading + offset + 1).find((lineNumber) => /^- (?!\[)/.test(document.lineAt(lineNumber).text));
      assert.notStrictEqual(line, undefined);
      const before = document.getText();
      const originalLine = document.lineAt(line).text;
      const actions = await vscode.commands.executeCommand('vscode.executeCodeActionProvider', document.uri, new vscode.Range(line, 0, line, 0));
      const action = actions.find((candidate) => candidate.edit);
      assert.ok(action && action.edit, 'canonical plain bullet должен получить mark action');
      await vscode.workspace.applyEdit(action.edit);
      assert.strictEqual(document.lineAt(line).text, originalLine.replace(/^- /, '- [x] '));
      const expected = before.split('\n');
      expected[line] = originalLine.replace(/^- /, '- [x] ');
      assert.strictEqual(document.getText(), expected.join('\n'));
    } finally { await fs.rm(target, { force: true }); }
  });

  test('обновляет index после внешнего create/delete и хранит canonical URI suffix/exact filenames', async () => {
    const ext = vscode.extensions.getExtension('ai-development-harness.harness-navigator');
    await ext.activate();
    const root = vscode.workspace.workspaceFolders[0].uri.fsPath;
    const task = path.join(root, 'planning', 'tasks', 'STEP-022-description.md');
    const adr = path.join(root, 'docs', 'adr', 'ADR-002.md');
    const target = path.join(root, 'planning', 'tasks', 'STEP-023.md');
    const fixture = await fs.readFile(path.join(root, 'planning', 'tasks', 'STEP-1.md'), 'utf8');
    try {
      await fs.writeFile(task, fixture.replace('STEP-1', 'STEP-022'));
      await fs.writeFile(adr, (await fs.readFile(path.join(root, 'docs', 'adr', 'ADR-001-editor-fixture.md'), 'utf8')).replace('ADR-001', 'ADR-002'));
      await fs.writeFile(target, `${fixture.replace('STEP-1', 'STEP-023')}\nSTEP-022 ADR-002\nSTEP-`);
      const document = await vscode.workspace.openTextDocument(vscode.Uri.file(target));
      await new Promise((resolve) => setTimeout(resolve, 600));
      const completions = await vscode.commands.executeCommand('vscode.executeCompletionItemProvider', document.uri, new vscode.Position(document.lineCount - 1, 5));
      assert.ok(completions.items.some((item) => item.label === 'STEP-022'));
      const locationsFor = async (id) => vscode.commands.executeCommand('vscode.executeDefinitionProvider', document.uri, new vscode.Position(document.lineCount - 2, document.lineAt(document.lineCount - 2).text.indexOf(id) + 1));
      assert.ok((await locationsFor('STEP-022')).some((location) => location.uri.fsPath.endsWith('STEP-022-description.md')));
      assert.ok((await locationsFor('ADR-002')).some((location) => location.uri.fsPath.endsWith('ADR-002.md')));
      await fs.rm(task);
      await new Promise((resolve) => setTimeout(resolve, 600));
      const afterDelete = await vscode.commands.executeCommand('vscode.executeCompletionItemProvider', document.uri, new vscode.Position(document.lineCount - 1, 5));
      assert.ok(!afterDelete.items.some((item) => item.label === 'STEP-022'));
    } finally { await Promise.all([fs.rm(task, { force: true }), fs.rm(adr, { force: true }), fs.rm(target, { force: true })]); }
  });

  test('инвалидирует CodeLens открытого STEP после внешнего create/delete ADR', async () => {
    const ext = vscode.extensions.getExtension('ai-development-harness.harness-navigator');
    await ext.activate();
    const root = vscode.workspace.workspaceFolders[0].uri.fsPath;
    const target = path.join(root, 'planning', 'tasks', 'STEP-024.md');
    const adr = path.join(root, 'docs', 'adr', 'ADR-998.md');
    const fixture = await fs.readFile(path.join(root, 'planning', 'tasks', 'STEP-1.md'), 'utf8');
    const adrFixture = await fs.readFile(path.join(root, 'docs', 'adr', 'ADR-001-editor-fixture.md'), 'utf8');
    const referenceLenses = async (document) => (await vscode.commands.executeCommand('vscode.executeCodeLensProvider', document.uri))
      .filter((lens) => lens.command.command === 'harness.editor.openReference' && lens.command.arguments[0] === 'ADR-998');
    try {
      await fs.writeFile(target, `${fixture.replace('STEP-1', 'STEP-024')}\nADR-998`);
      const document = await vscode.workspace.openTextDocument(vscode.Uri.file(target));
      await vscode.window.showTextDocument(document);
      await new Promise((resolve) => setTimeout(resolve, 300));
      assert.strictEqual((await referenceLenses(document)).length, 0);

      await fs.writeFile(adr, adrFixture.replace('ADR-001', 'ADR-998'));
      await new Promise((resolve) => setTimeout(resolve, 600));
      assert.strictEqual((await referenceLenses(document)).length, 1);

      await fs.rm(adr);
      await new Promise((resolve) => setTimeout(resolve, 600));
      assert.strictEqual((await referenceLenses(document)).length, 0);
    } finally { await Promise.all([fs.rm(target, { force: true }), fs.rm(adr, { force: true })]); }
  });
});
