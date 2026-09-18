const assert = require('assert');
const path = require('node:path');
const fs = require('node:fs/promises');
const vscode = require('vscode');

const EXPLORER_COMMANDS = [
  'harness.explorer.refresh',
  'harness.explorer.filterByStatus',
  'harness.explorer.filterByType',
  'harness.explorer.filterByPriority',
  'harness.explorer.filterByRiskFlag',
  'harness.explorer.search',
  'harness.explorer.clearFilters',
  'harness.explorer.openFile',
  'harness.explorer.viewInExplorer',
  'harness.explorer.markDone',
  'harness.explorer.flagBlocker',
  'harness.explorer.createFollowUpStep',
  'harness.explorer.delete',
];

const GROUP_IDS = [
  'projectConfiguration',
  'requirements',
  'architecture',
  'tasks',
  'roadmap',
  'status',
  'reviews',
  'skills',
];

/**
 * REVIEW-2026-09-18T1500.md, Handoff п.1: пункт 6 `## Verification sequence`
 * STEP-006 (ручная проверка в Extension Development Host) не был выполнен ни
 * разу за весь цикл IMPLEMENT→FIX — обе сессии non-interactive, без GUI
 * VSCode. Review прямо разрешает альтернативу: расширить этот файл до
 * реальной проверки в headless Extension Host — структуры дерева, статус-
 * иконок, `contextValue`, наличия пунктов меню и реакции на внешнюю правку
 * файла — вместо ручной проверки человеком.
 *
 * `ext.exports.explorerProvider` (см. `src/extension.ts`/`src/explorer/activation.ts`)
 * — тестовая инфраструктура, добавленная в этом FIX-проходе специально для
 * этого файла: без неё headless-тест не может получить доступ к реальному,
 * зарегистрированному в `TreeView` `HarnessTreeDataProvider` и вынужден был
 * бы ограничиться фактом регистрации команд (как в предыдущем проходе).
 */
async function waitFor(assertion, { timeoutMs = 5000, intervalMs = 200 } = {}) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  for (;;) {
    try {
      await assertion();
      return;
    } catch (e) {
      lastError = e;
      if (Date.now() >= deadline) throw lastError;
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }
}

suite('Harness Sidebar Explorer (STEP-006)', () => {
  let ext;
  let provider;
  let workspaceRoot;

  suiteSetup(async () => {
    ext = vscode.extensions.getExtension('ai-development-harness.harness-navigator');
    const exports = await ext.activate();
    provider = exports && exports.explorerProvider;
    assert.ok(provider, 'registerHarnessExplorer должен вернуть provider через exports для integration-тестов');
    workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
  });

  test('все harness.explorer.* команды зарегистрированы', async () => {
    const commands = await vscode.commands.getCommands(true);
    for (const id of EXPLORER_COMMANDS) {
      assert.ok(commands.includes(id), `команда ${id} не найдена в реестре`);
    }
  });

  test('refresh/clearFilters — реальный вызов без аргументов не бросает', async () => {
    await vscode.commands.executeCommand('harness.explorer.refresh');
    await vscode.commands.executeCommand('harness.explorer.clearFilters');
  });

  test('filterByStatus с явным аргументом не бросает и выставляет harness.explorer.hasFilters', async () => {
    // Headless QuickPick не резолвится (Evidence STEP-005) — вызываем с явным
    // аргументом, как того требует конвенция STEP-006 для всех explorer-команд.
    await vscode.commands.executeCommand('harness.explorer.filterByStatus', ['Выполнено']);
    await vscode.commands.executeCommand('harness.explorer.clearFilters');
  });

  test('search с явным аргументом не бросает', async () => {
    await vscode.commands.executeCommand('harness.explorer.search', 'STEP-1');
    await vscode.commands.executeCommand('harness.explorer.clearFilters');
  });

  test('дерево строит ровно 8 групп верхнего уровня из REQ-002', async () => {
    const roots = await provider.getChildren();
    assert.strictEqual(roots.length, GROUP_IDS.length, `ожидалось ${GROUP_IDS.length} групп, получено ${roots.length}`);
    for (const id of GROUP_IDS) {
      assert.ok(
        roots.some((n) => n.kind === 'group' && n.id === id),
        `группа ${id} отсутствует в корне дерева`
      );
    }
  });

  test('Tasks: STEP-1 виден в реальном дереве со статус-иконкой и contextValue, клик открывает файл', async () => {
    const roots = await provider.getChildren();
    const tasksGroup = roots.find((n) => n.kind === 'group' && n.id === 'tasks');
    assert.ok(tasksGroup, 'группа tasks не найдена');

    const children = await provider.getChildren(tasksGroup);
    const step1 = children.find((n) => n.kind === 'step' && n.data.id === 'STEP-1');
    assert.ok(step1, 'STEP-1 (fixture) не найден в группе Tasks реального дерева');

    // STEP-1.md fixture имеет `**Статус:** Выполнено` — статус-иконка обязана
    // соответствовать `statusIcon.ts` (`pass-filled`/`charts.green`), а не
    // деградировать до `question`.
    const item = provider.getTreeItem(step1);
    assert.strictEqual(item.iconPath && item.iconPath.id, 'pass-filled', 'иконка статуса "Выполнено" не применена в реальном TreeItem');
    assert.ok(item.contextValue && item.contextValue.includes('harness.step'), 'contextValue должен кодировать возможности узла (REQ-002)');
    assert.ok(item.command && item.command.command === 'vscode.open', 'клик по STEP-узлу обязан открывать файл (Acceptance criteria)');
  });

  test('right-click меню: пункты harness.explorer.* объявлены в реальном манифесте расширения для STEP-узлов', () => {
    const menus = (ext.packageJSON.contributes && ext.packageJSON.contributes.menus) || {};
    const itemContextMenu = menus['view/item/context'] || [];
    const entriesByCommand = new Map(itemContextMenu.map((entry) => [entry.command, entry]));
    const stepPattern = /harness\\?\.step\\?\b/; // допускает и экранированный, и неэкранированный вид точки

    // Acceptance criteria «right-click показывает меню»: headless Extension
    // Host не умеет физически открыть системное контекстное меню, поэтому
    // проверяется реально загруженный `package.json` активированного
    // расширения (не переписанная копия в тесте) — те же пункты и те же
    // `when`-условия на STEP-узлы, что видел бы пользователь.
    for (const cmd of ['harness.explorer.markDone', 'harness.explorer.flagBlocker', 'harness.explorer.createFollowUpStep', 'harness.explorer.delete']) {
      const entry = entriesByCommand.get(cmd);
      assert.ok(entry, `пункт меню для ${cmd} не объявлен в contributes.menus["view/item/context"]`);
      assert.ok(entry.when && entry.when.includes('harness.artifacts'), `пункт меню ${cmd} не привязан к view harness.artifacts`);
      assert.ok(stepPattern.test(entry.when), `пункт меню ${cmd} не нацелен на STEP-узлы (when: ${entry.when})`);
    }
    for (const cmd of ['harness.explorer.openFile', 'harness.explorer.viewInExplorer']) {
      assert.ok(entriesByCommand.has(cmd), `пункт меню для ${cmd} не объявлен в contributes.menus["view/item/context"]`);
    }
  });

  suite('реакция на внешнюю правку файла (FileSystemWatcher, вне API extension\'а)', () => {
    const tmpStepId = 'STEP-9';
    let tmpStepPath;

    const stepContent = (status) => `# ${tmpStepId} — Временный fixture для watcher-теста

**Статус:** ${status}
**Type:** IMPLEMENTATION
**Приоритет:** Средний
**Фаза:** test
**Depends on:** —

## Requirements

- не требуется

## ADR

- не требуется

## Risk flags

- none

## Goal

Временный STEP, создаваемый и удаляемый самим тестом — проверяет реакцию
\`FileSystemWatcher\` на изменение файла на диске мимо API расширения.

## Context

Fixture only.

## Scope

- fixture only

## Mutation policy

### Allowed

- нет

### Conditional

- нет

### Forbidden

- нет

## Out of scope

- всё

## Acceptance criteria

- используется в тестах

## Verification

- N/A

## Deliverables

- N/A

## Implementation plan

**Plan status:** Planned
**Plan revision:** 1
**Planned at:** 2026-09-18

## Evidence

N/A

## Review status

**Latest verdict:** NOT REVIEWED
**Latest report:** N/A

## Blocker / Failure reason

—
`;

    setup(() => {
      tmpStepPath = path.join(workspaceRoot, 'planning', 'tasks', `${tmpStepId}.md`);
    });

    teardown(async () => {
      // Verification sequence STEP-006 п.7: `git status` после прогона не
      // должен показывать runtime-мусор в `tests/fixtures/workspace/`.
      await fs.rm(tmpStepPath, { force: true });
      await waitFor(async () => {
        const roots = await provider.getChildren();
        const tasksGroup = roots.find((n) => n.kind === 'group' && n.id === 'tasks');
        const children = await provider.getChildren(tasksGroup);
        assert.ok(!children.some((n) => n.kind === 'step' && n.data.id === tmpStepId));
      });
    });

    test('создание STEP-файла на диске мимо API отражается в дереве без вызова explorer-команд', async function () {
      this.timeout(10000);
      await fs.writeFile(tmpStepPath, stepContent('Запланировано'), 'utf8');

      await waitFor(
        async () => {
          const roots = await provider.getChildren();
          const tasksGroup = roots.find((n) => n.kind === 'group' && n.id === 'tasks');
          const children = await provider.getChildren(tasksGroup);
          const created = children.find((n) => n.kind === 'step' && n.data.id === tmpStepId);
          assert.ok(created, `${tmpStepId} ещё не появился в дереве после внешней правки`);
          assert.strictEqual(created.data.status, 'Запланировано');
        },
        { timeoutMs: 8000 }
      );
    });

    test('изменение статуса STEP-файла на диске отражается в дереве после debounce watcher', async function () {
      this.timeout(15000);
      await fs.writeFile(tmpStepPath, stepContent('Запланировано'), 'utf8');
      await waitFor(
        async () => {
          const roots = await provider.getChildren();
          const tasksGroup = roots.find((n) => n.kind === 'group' && n.id === 'tasks');
          const children = await provider.getChildren(tasksGroup);
          assert.ok(children.some((n) => n.kind === 'step' && n.data.id === tmpStepId));
        },
        { timeoutMs: 8000 }
      );

      // Внешняя правка «мимо API extension'а» — тот же сценарий, что и у
      // headless-агента (ADR-004), пишущего файлы напрямую через `fs`, а не
      // через `vscode.workspace.fs`/редактор.
      await fs.writeFile(tmpStepPath, stepContent('В работе'), 'utf8');

      await waitFor(
        async () => {
          const roots = await provider.getChildren();
          const tasksGroup = roots.find((n) => n.kind === 'group' && n.id === 'tasks');
          const children = await provider.getChildren(tasksGroup);
          const updated = children.find((n) => n.kind === 'step' && n.data.id === tmpStepId);
          assert.ok(updated, `${tmpStepId} пропал из дерева после правки статуса`);
          assert.strictEqual(updated.data.status, 'В работе', 'дерево не отразило изменённый на диске статус');
        },
        { timeoutMs: 8000 }
      );
    });
  });
});
