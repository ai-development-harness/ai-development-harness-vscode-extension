import * as path from 'node:path';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
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
