import * as path from 'node:path';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import * as os from 'node:os';
import { parseManifest } from '../../../src/parser/yamlParser';
import { ManifestData } from '../../../src/parser/types';
import type { I18nService } from '../../../src/locales/activation';
import { HarnessTreeDataProvider } from '../../../src/explorer/treeProvider';
import * as actions from '../../../src/explorer/actions';

const vscode = require('vscode');

const INITIALIZED_MANIFEST = path.join(__dirname, '../../fixtures/manifest/initialized.manifest.yaml');
const UNINITIALIZED_MANIFEST = path.join(__dirname, '../../fixtures/manifest/uninitialized.manifest.yaml');

const i18n: I18nService = {
  t: (key, params) => (params ? `${key}:${JSON.stringify(params)}` : key),
  getLanguage: () => 'ru',
  onDidChangeLanguage: (() => ({ dispose: () => {} })) as I18nService['onDidChangeLanguage'],
};

const fakeProvider = { invalidate: jest.fn() } as unknown as HarnessTreeDataProvider;

async function loadManifest(file: string): Promise<ManifestData> {
  const parsed = await parseManifest(file);
  if (!parsed.ok) throw new Error('fixture manifest failed to parse');
  return parsed.value;
}

const STEP_TEMPLATE = (status: string, verdict: string, evidence: string): string => `# STEP-009 — Fixture

**Статус:** ${status}
**Type:** IMPLEMENTATION
**Приоритет:** Средний
**Фаза:** fixture
**Depends on:** —

## Requirements

- REQ-001

## ADR

- не требуется

## Risk flags

- none

## Goal

Fixture.

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

- N/A

## Verification

- N/A

## Deliverables

- N/A

## Implementation plan

**Plan status:** Planned
**Plan revision:** 1
**Planned at:** 2026-09-18

## Evidence

${evidence}

## Review status

**Latest verdict:** ${verdict}
**Latest report:** —

## Blocker / Failure reason

—
`;

/** Отдельный STEP, ссылающийся на STEP-009 через `Depends on` — для F-018 delete-кейсов. */
const REFERENCING_STEP_TEMPLATE = `# STEP-010 — Referencing fixture

**Статус:** Запланировано
**Type:** IMPLEMENTATION
**Приоритет:** Средний
**Фаза:** fixture
**Depends on:** STEP-009

## Requirements

- REQ-001

## ADR

- не требуется

## Risk flags

- none

## Goal

Fixture.

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

- N/A

## Verification

- N/A

## Deliverables

- N/A

## Implementation plan

**Plan status:** Planned
**Plan revision:** 1
**Planned at:** 2026-09-18

## Evidence



## Review status

**Latest verdict:** NOT REVIEWED
**Latest report:** —

## Blocker / Failure reason

—
`;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('FIX STEP-006 (F-002): mutating explorer actions honor the INIT guard', () => {
  it('markDone blocks and does not write when project.initialized is false', async () => {
    const manifest = await loadManifest(UNINITIALIZED_MANIFEST);
    await actions.markDone('/workspace', manifest, i18n, fakeProvider, 'STEP-001');

    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(expect.stringContaining('harness.error.notInitialized'));
    expect(vscode.workspace.fs.writeFile).not.toHaveBeenCalled();
    expect(vscode.window.showWarningMessage).not.toHaveBeenCalled();
  });

  it('flagBlocker blocks and does not write when project.initialized is false', async () => {
    const manifest = await loadManifest(UNINITIALIZED_MANIFEST);
    await actions.flagBlocker('/workspace', manifest, i18n, fakeProvider, 'STEP-001');

    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(expect.stringContaining('harness.error.notInitialized'));
    expect(vscode.workspace.fs.writeFile).not.toHaveBeenCalled();
    expect(vscode.window.showInputBox).not.toHaveBeenCalled();
  });

  it('deleteArtifact blocks and does not delete when project.initialized is false', async () => {
    const manifest = await loadManifest(UNINITIALIZED_MANIFEST);
    await actions.deleteArtifact('/workspace', manifest, i18n, fakeProvider, 'STEP-001');

    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(expect.stringContaining('harness.error.notInitialized'));
    expect(vscode.workspace.fs.delete).not.toHaveBeenCalled();
  });
});

describe('FIX STEP-006 (F-003): markDone/flagBlocker re-read the STEP file before guarding', () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(path.join(os.tmpdir(), 'harness-explorer-f003-'));
    await mkdir(path.join(root, 'planning/tasks'), { recursive: true });
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('markDone refuses when the on-disk verdict is FAIL, even if the passed node claims PASS', async () => {
    const manifest = await loadManifest(INITIALIZED_MANIFEST);
    await writeFile(path.join(root, 'planning/tasks/STEP-009.md'), STEP_TEMPLATE('В работе', 'FAIL', 'доказано'), 'utf8');

    // Simulates a tree node cached from before a FIX/REVIEW cycle flipped the
    // verdict to FAIL on disk (the exact F-001/F-003 interaction the review
    // called out).
    const staleNode = {
      kind: 'step' as const,
      uri: 'planning/tasks/STEP-009.md',
      groupId: 'tasks' as const,
      data: { id: 'STEP-009', reviewStatus: { latestVerdict: 'PASS', latestReport: 'x' }, evidence: 'доказано' },
    };

    await actions.markDone(root, manifest, i18n, fakeProvider, staleNode as never);

    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(expect.stringContaining('harness.explorer.error.markDoneNoPass'));
    expect(vscode.workspace.fs.writeFile).not.toHaveBeenCalled();
  });

  it('flagBlocker refuses when the on-disk status is terminal, even if the passed node claims a non-terminal status', async () => {
    const manifest = await loadManifest(INITIALIZED_MANIFEST);
    await writeFile(path.join(root, 'planning/tasks/STEP-009.md'), STEP_TEMPLATE('Заменено', 'NOT REVIEWED', ''), 'utf8');
    vscode.window.showInputBox.mockResolvedValue('причина');

    const staleNode = {
      kind: 'step' as const,
      uri: 'planning/tasks/STEP-009.md',
      groupId: 'tasks' as const,
      data: { id: 'STEP-009', status: 'В работе' },
    };

    await actions.flagBlocker(root, manifest, i18n, fakeProvider, staleNode as never);

    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(expect.stringContaining('harness.explorer.error.flagBlockerTerminal'));
    expect(vscode.workspace.fs.writeFile).not.toHaveBeenCalled();
  });
});

/**
 * FIX STEP-006 (2-й проход, F-015): до фикса `markDone`/`flagBlocker`
 * молчаливо завершались (`if (!step) return;`), если STEP-файл был
 * переименован/удалён/повреждён между загрузкой группы дерева и кликом по
 * пункту меню — пользователь видел «ничего не произошло» без объяснения.
 */
describe('FIX STEP-006 (F-015): markDone/flagBlocker show an error when the STEP file is unreadable at click time', () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(path.join(os.tmpdir(), 'harness-explorer-f015-'));
    await mkdir(path.join(root, 'planning/tasks'), { recursive: true });
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('markDone shows harness.explorer.error.stepUnreadable when the file no longer exists on disk', async () => {
    const manifest = await loadManifest(INITIALIZED_MANIFEST);
    // Узел дерева ссылается на STEP-009, но файл на диске никогда не
    // создавался (эквивалент «удалён между загрузкой группы и кликом»).
    const staleNode = {
      kind: 'step' as const,
      uri: 'planning/tasks/STEP-009.md',
      groupId: 'tasks' as const,
      data: { id: 'STEP-009', reviewStatus: { latestVerdict: 'PASS', latestReport: 'x' }, evidence: 'доказано' },
    };

    await actions.markDone(root, manifest, i18n, fakeProvider, staleNode as never);

    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
      expect.stringContaining('harness.explorer.error.stepUnreadable')
    );
    expect(vscode.workspace.fs.writeFile).not.toHaveBeenCalled();
  });

  it('flagBlocker shows harness.explorer.error.stepUnreadable when the file is corrupted (unparseable) on disk', async () => {
    const manifest = await loadManifest(INITIALIZED_MANIFEST);
    await writeFile(path.join(root, 'planning/tasks/STEP-009.md'), '', 'utf8'); // parseStepFile: empty-content
    vscode.window.showInputBox.mockResolvedValue('причина');

    const staleNode = {
      kind: 'step' as const,
      uri: 'planning/tasks/STEP-009.md',
      groupId: 'tasks' as const,
      data: { id: 'STEP-009', status: 'В работе' },
    };

    await actions.flagBlocker(root, manifest, i18n, fakeProvider, staleNode as never);

    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
      expect.stringContaining('harness.explorer.error.stepUnreadable')
    );
    expect(vscode.workspace.fs.writeFile).not.toHaveBeenCalled();
  });
});

/**
 * STEP-014 (F-018): между guard'ом на чтении №1 (`readFreshStep`/пред-диалоговый
 * `canDelete`) и фактической записью/удалением стоит модальное подтверждение
 * без ограничения по времени — файл на диске может измениться. Эти тесты
 * воспроизводят гонку и проверяют, что перепроверка guard'а на чтении №2
 * (внутри `writeStepFile`/непосредственно перед `fs.delete`) блокирует
 * устаревшую запись тем же локализованным сообщением, без второго диалога.
 */
describe('STEP-014 (F-018): guard перепроверяется на свежем контенте непосредственно перед записью', () => {
  let root: string;
  const YES = () => i18n.t('harness.explorer.confirm.yes');

  const staleNode = (id: string): unknown => ({
    kind: 'step' as const,
    uri: `planning/tasks/${id}.md`,
    groupId: 'tasks' as const,
    data: { id },
  });

  beforeEach(async () => {
    root = await mkdtemp(path.join(os.tmpdir(), 'harness-explorer-f018-'));
    await mkdir(path.join(root, 'planning/tasks'), { recursive: true });
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('markDone: verdict меняется на FAIL во время модалки — запись блокируется', async () => {
    const manifest = await loadManifest(INITIALIZED_MANIFEST);
    const stepPath = path.join(root, 'planning/tasks/STEP-009.md');
    await writeFile(stepPath, STEP_TEMPLATE('В работе', 'PASS', 'доказано'), 'utf8');

    vscode.window.showWarningMessage.mockImplementation(async () => {
      // Симулирует headless-агента (ADR-004), переворачивающего вердикт на
      // FAIL, пока пользователь ещё не ответил на модалку.
      await writeFile(stepPath, STEP_TEMPLATE('В работе', 'FAIL', 'доказано'), 'utf8');
      return YES();
    });

    await actions.markDone(root, manifest, i18n, fakeProvider, staleNode('STEP-009') as never);

    expect(vscode.workspace.fs.writeFile).not.toHaveBeenCalled();
    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
      expect.stringContaining('harness.explorer.error.markDoneNoPass')
    );
    const onDisk = await readFile(stepPath, 'utf8');
    expect(onDisk).not.toContain('**Статус:** Выполнено');
  });

  it('markDone: Evidence опустошается во время модалки — запись блокируется', async () => {
    const manifest = await loadManifest(INITIALIZED_MANIFEST);
    const stepPath = path.join(root, 'planning/tasks/STEP-009.md');
    await writeFile(stepPath, STEP_TEMPLATE('В работе', 'PASS', 'доказано'), 'utf8');

    vscode.window.showWarningMessage.mockImplementation(async () => {
      await writeFile(stepPath, STEP_TEMPLATE('В работе', 'PASS', ''), 'utf8');
      return YES();
    });

    await actions.markDone(root, manifest, i18n, fakeProvider, staleNode('STEP-009') as never);

    expect(vscode.workspace.fs.writeFile).not.toHaveBeenCalled();
    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
      expect.stringContaining('harness.explorer.error.markDoneNoEvidence')
    );
    const onDisk = await readFile(stepPath, 'utf8');
    expect(onDisk).not.toContain('**Статус:** Выполнено');
  });

  it('markDone: файл удалён/повреждён во время модалки — stepUnreadable, без unhandled rejection', async () => {
    const manifest = await loadManifest(INITIALIZED_MANIFEST);
    const stepPath = path.join(root, 'planning/tasks/STEP-009.md');
    await writeFile(stepPath, STEP_TEMPLATE('В работе', 'PASS', 'доказано'), 'utf8');

    vscode.window.showWarningMessage.mockImplementation(async () => {
      await rm(stepPath, { force: true });
      return YES();
    });

    await expect(
      actions.markDone(root, manifest, i18n, fakeProvider, staleNode('STEP-009') as never)
    ).resolves.toBeUndefined();

    expect(vscode.workspace.fs.writeFile).not.toHaveBeenCalled();
    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
      expect.stringContaining('harness.explorer.error.stepUnreadable')
    );
  });

  it('markDone: файл заменяется нечитаемым (unparseable) контентом во время модалки — stepUnreadable', async () => {
    const manifest = await loadManifest(INITIALIZED_MANIFEST);
    const stepPath = path.join(root, 'planning/tasks/STEP-009.md');
    await writeFile(stepPath, STEP_TEMPLATE('В работе', 'PASS', 'доказано'), 'utf8');

    vscode.window.showWarningMessage.mockImplementation(async () => {
      await writeFile(stepPath, '', 'utf8');
      return YES();
    });

    await actions.markDone(root, manifest, i18n, fakeProvider, staleNode('STEP-009') as never);

    expect(vscode.workspace.fs.writeFile).not.toHaveBeenCalled();
    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
      expect.stringContaining('harness.explorer.error.stepUnreadable')
    );
  });

  it('markDone: файл подменяется другим STEP-id во время модалки — stepUnreadable', async () => {
    const manifest = await loadManifest(INITIALIZED_MANIFEST);
    const stepPath = path.join(root, 'planning/tasks/STEP-009.md');
    await writeFile(stepPath, STEP_TEMPLATE('В работе', 'PASS', 'доказано'), 'utf8');

    vscode.window.showWarningMessage.mockImplementation(async () => {
      // Путь по-прежнему STEP-009.md, но содержимое — другой STEP (F-019 не
      // в scope, здесь проверяется только защита по `expectedStepId`).
      await writeFile(stepPath, REFERENCING_STEP_TEMPLATE, 'utf8');
      return YES();
    });

    await actions.markDone(root, manifest, i18n, fakeProvider, staleNode('STEP-009') as never);

    expect(vscode.workspace.fs.writeFile).not.toHaveBeenCalled();
    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
      expect.stringContaining('harness.explorer.error.stepUnreadable')
    );
  });

  it('markDone: контрольный кейс — без изменений во время модалки запись проходит ровно один раз', async () => {
    const manifest = await loadManifest(INITIALIZED_MANIFEST);
    const stepPath = path.join(root, 'planning/tasks/STEP-009.md');
    await writeFile(stepPath, STEP_TEMPLATE('В работе', 'PASS', 'доказано'), 'utf8');

    vscode.window.showWarningMessage.mockResolvedValue(YES());

    await actions.markDone(root, manifest, i18n, fakeProvider, staleNode('STEP-009') as never);

    expect(vscode.workspace.fs.writeFile).toHaveBeenCalledTimes(1);
    const onDisk = await readFile(stepPath, 'utf8');
    expect(onDisk).toContain('**Статус:** Выполнено');
  });

  it('deleteArtifact: входящая ссылка появляется во время модалки — удаление блокируется', async () => {
    const manifest = await loadManifest(INITIALIZED_MANIFEST);
    const targetPath = path.join(root, 'planning/tasks/STEP-009.md');
    const referencerPath = path.join(root, 'planning/tasks/STEP-010.md');
    await writeFile(targetPath, STEP_TEMPLATE('В работе', 'NOT REVIEWED', ''), 'utf8');

    const targetUri = { fsPath: targetPath };
    const referencerUri = { fsPath: referencerPath };
    vscode.workspace.findFiles
      .mockResolvedValueOnce([targetUri]) // пред-диалоговый evaluateDeleteGuard
      .mockResolvedValueOnce([targetUri, referencerUri]); // повторный, перед fs.delete

    vscode.window.showWarningMessage.mockImplementation(async () => {
      // Headless-агент (ADR-004) создаёт STEP с `Depends on: STEP-009`, пока
      // модалка ещё открыта.
      await writeFile(referencerPath, REFERENCING_STEP_TEMPLATE, 'utf8');
      return YES();
    });

    await actions.deleteArtifact(root, manifest, i18n, fakeProvider, staleNode('STEP-009') as never);

    expect(vscode.workspace.fs.delete).not.toHaveBeenCalled();
    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
      expect.stringContaining('harness.explorer.error.deleteHasReferences')
    );
  });

  it('deleteArtifact: контрольный кейс — без новых ссылок удаление проходит через useTrash', async () => {
    const manifest = await loadManifest(INITIALIZED_MANIFEST);
    const targetPath = path.join(root, 'planning/tasks/STEP-009.md');
    await writeFile(targetPath, STEP_TEMPLATE('В работе', 'NOT REVIEWED', ''), 'utf8');

    const targetUri = { fsPath: targetPath };
    vscode.workspace.findFiles.mockResolvedValueOnce([targetUri]).mockResolvedValueOnce([targetUri]);
    vscode.window.showWarningMessage.mockResolvedValue(YES());

    await actions.deleteArtifact(root, manifest, i18n, fakeProvider, staleNode('STEP-009') as never);

    expect(vscode.workspace.fs.delete).toHaveBeenCalledWith(
      expect.objectContaining({ fsPath: targetPath }),
      { useTrash: true }
    );
    expect(vscode.window.showErrorMessage).not.toHaveBeenCalled();
  });

  it('flagBlocker: регрессия — валидный сценарий через guarded-write делает ровно одну запись', async () => {
    const manifest = await loadManifest(INITIALIZED_MANIFEST);
    const stepPath = path.join(root, 'planning/tasks/STEP-009.md');
    await writeFile(stepPath, STEP_TEMPLATE('В работе', 'NOT REVIEWED', ''), 'utf8');
    vscode.window.showInputBox.mockResolvedValue('сеть недоступна');

    await actions.flagBlocker(root, manifest, i18n, fakeProvider, staleNode('STEP-009') as never);

    expect(vscode.workspace.fs.writeFile).toHaveBeenCalledTimes(1);
    const onDisk = await readFile(stepPath, 'utf8');
    expect(onDisk).toContain('**Статус:** Заблокировано');
    expect(onDisk).toContain('сеть недоступна');
  });

  it('flagBlocker (F-005): статус становится терминальным между readFreshStep и чтением №2 в writeStepFile — запись блокируется', async () => {
    const manifest = await loadManifest(INITIALIZED_MANIFEST);
    const stepPath = path.join(root, 'planning/tasks/STEP-009.md');
    await writeFile(stepPath, STEP_TEMPLATE('В работе', 'NOT REVIEWED', ''), 'utf8');
    vscode.window.showInputBox.mockResolvedValue('сеть недоступна');

    // flagBlocker не ждёт модалки, но между `readFreshStep` (чтение №1, guard
    // проходит) и чтением №2 внутри `writeStepFile` остаётся асинхронный
    // зазор (F-018 п.3 «Расхождений» / F-005). Второй вызов `readFile`
    // симулирует headless-агента, переводящего STEP в терминальный статус
    // ровно в этом зазоре.
    let readCount = 0;
    vscode.workspace.fs.readFile.mockImplementation(async (uri: { fsPath: string }) => {
      readCount += 1;
      if (readCount === 2) {
        await writeFile(stepPath, STEP_TEMPLATE('Отменено', 'NOT REVIEWED', ''), 'utf8');
      }
      return new Uint8Array(await readFile(uri.fsPath));
    });

    await actions.flagBlocker(root, manifest, i18n, fakeProvider, staleNode('STEP-009') as never);

    expect(vscode.workspace.fs.writeFile).not.toHaveBeenCalled();
    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
      expect.stringContaining('harness.explorer.error.flagBlockerTerminal')
    );
  });
});
