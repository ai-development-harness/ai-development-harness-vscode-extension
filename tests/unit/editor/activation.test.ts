import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import * as vscode from 'vscode';
import {
  CodeLensRefreshController,
  DocumentValidationScheduler,
  isCanonicalStepDocument,
  loadIndex,
  registerValidationListeners,
  StepLanguageAssociationController,
  stepEditorSelector,
  stepEditorWatchPatterns,
  ValidationController,
} from '../../../src/editor/activation';
import type { ManifestData } from '../../../src/parser/types';

type IndexRevision = { revision: string };

const editorManifest: ManifestData = {
  harness: { version: '1', release: '0.4.0' },
  project: { initialized: true, name: 'test', initializedAt: '2026-01-01' },
  language: { default: 'ru', agentResponses: 'ru', documentation: 'ru', commitMessages: 'ru', codeComments: 'ru', testNames: 'ru', fixtures: 'ru', githubTemplates: 'ru', releaseNotes: 'ru' },
  sources: { localBrief: 'PROJECT_BRIEF.local.md', projectOverview: 'docs/PROJECT.md', requirements: 'docs/requirements/SPEC.md', architecture: 'docs/architecture.md', roadmap: 'planning/PLAN.md', status: 'planning/STATUS.md' },
  protocol: { file: 'planning/EXECUTION_PROTOCOL.md', taskDirectory: 'custom/steps', reviewDirectory: 'planning/reviews', auditDirectory: 'planning/audits', skillSearchDirectory: 'planning/skill-searches', skillRegistry: 'docs/skills/REGISTRY.md', harnessUpdateDirectory: 'planning/harness-updates' },
  repository: { gitPolicy: '.project/git-policy.toml', harnessPolicy: '.project/harness-policy.toml', harnessUpdatePolicy: '.project/harness-update.toml', harnessLock: '.project/harness.lock.json', harnessValidation: 'tools/harness/validate.py', harnessCI: '.github/workflows/harness-integrity.yml' },
};

const minimalStep = `# STEP-101 — Тест

**Статус:** Запланировано
**Type:** BUGFIX
**Приоритет:** Высокий
**Фаза:** MVP
**Depends on:** —

## Requirements

- REQ-001

## ADR

- ADR-001

## Risk flags

- none

## Goal

Тест

## Context

Тест

## Scope

- Тест

## Mutation policy

### Allowed

- src/editor

### Conditional

- —

### Forbidden

- —

## Out of scope

- —

## Acceptance criteria

- Тест

## Verification

- test

## Deliverables

- test

## Implementation plan

**Plan status:** Ready
**Plan revision:** 1
**Planned at:** 2026-01-01

## Evidence

Нет

## Review status

**Latest verdict:** NOT REVIEWED
**Latest report:** —

## Blocker / Failure reason

—`;

describe('CodeLensRefreshController', () => {
  it('публикует ровно одну инвалидацию после замены index и не публикует при ошибке', async () => {
    jest.useFakeTimers();
    const nextIndex: IndexRevision = { revision: 'новый' };
    const loadNextIndex = jest.fn<Promise<IndexRevision | false>, []>()
      .mockResolvedValueOnce(nextIndex)
      .mockRejectedValueOnce(new Error('index load failed'));
    const applyNextIndex = jest.fn();
    const controller = new CodeLensRefreshController(loadNextIndex, applyNextIndex, 200);
    const listener = jest.fn();
    controller.onDidChangeCodeLenses(listener);

    controller.schedule();
    await jest.advanceTimersByTimeAsync(200);
    expect(loadNextIndex).toHaveBeenCalledTimes(1);
    expect(applyNextIndex).toHaveBeenCalledWith(nextIndex);
    expect(listener).toHaveBeenCalledTimes(1);

    controller.schedule();
    await jest.advanceTimersByTimeAsync(200);
    expect(loadNextIndex).toHaveBeenCalledTimes(2);
    expect(applyNextIndex).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledTimes(1);
    controller.dispose();
    jest.useRealTimers();
  });

  it('после dispose не выполняет ожидающий refresh и игнорирует новые watcher events', async () => {
    jest.useFakeTimers();
    const loadNextIndex = jest.fn<Promise<IndexRevision | false>, []>().mockResolvedValue({ revision: 'новый' });
    const applyNextIndex = jest.fn();
    const controller = new CodeLensRefreshController(loadNextIndex, applyNextIndex, 200);
    const listener = jest.fn();
    controller.onDidChangeCodeLenses(listener);

    controller.schedule();
    controller.dispose();
    await jest.advanceTimersByTimeAsync(200);
    controller.schedule();
    await jest.advanceTimersByTimeAsync(200);
    expect(loadNextIndex).not.toHaveBeenCalled();
    expect(applyNextIndex).not.toHaveBeenCalled();
    expect(listener).not.toHaveBeenCalled();
    jest.useRealTimers();
  });

  it('не публикует завершившийся refresh, если extension был disposed во время загрузки index', async () => {
    jest.useFakeTimers();
    let completeRefresh: ((next: IndexRevision | false) => void) | undefined;
    const loadNextIndex = jest.fn(() => new Promise<IndexRevision | false>((resolve) => { completeRefresh = resolve; }));
    const applyNextIndex = jest.fn();
    const controller = new CodeLensRefreshController(loadNextIndex, applyNextIndex, 200);
    const listener = jest.fn();
    controller.onDidChangeCodeLenses(listener);

    controller.schedule();
    await jest.advanceTimersByTimeAsync(200);
    controller.dispose();
    completeRefresh?.({ revision: 'новый' });
    await Promise.resolve();
    expect(applyNextIndex).not.toHaveBeenCalled();
    expect(listener).not.toHaveBeenCalled();
    jest.useRealTimers();
  });

  it('сохраняет последний index, когда свежий B завершается раньше устаревшего A', async () => {
    jest.useFakeTimers();
    let resolveA: ((next: IndexRevision | false) => void) | undefined;
    let resolveB: ((next: IndexRevision | false) => void) | undefined;
    const loadNextIndex = jest.fn<Promise<IndexRevision | false>, []>()
      .mockImplementationOnce(() => new Promise<IndexRevision | false>((resolve) => { resolveA = resolve; }))
      .mockImplementationOnce(() => new Promise<IndexRevision | false>((resolve) => { resolveB = resolve; }));
    const applied: string[] = [];
    const controller = new CodeLensRefreshController(loadNextIndex, (next) => applied.push(next.revision), 200);
    const listener = jest.fn();
    controller.onDidChangeCodeLenses(listener);

    controller.schedule();
    await jest.advanceTimersByTimeAsync(200);
    controller.schedule();
    await jest.advanceTimersByTimeAsync(200);
    resolveB?.({ revision: 'B' });
    await Promise.resolve();
    resolveA?.({ revision: 'A' });
    await Promise.resolve();

    expect(applied).toEqual(['B']);
    expect(listener).toHaveBeenCalledTimes(1);
    controller.dispose();
    jest.useRealTimers();
  });

  it('не применяет resolved false после ошибки чтения index', async () => {
    jest.useFakeTimers();
    const loadNextIndex = jest.fn<Promise<IndexRevision | false>, []>().mockResolvedValue(false);
    const applyNextIndex = jest.fn();
    const controller = new CodeLensRefreshController(loadNextIndex, applyNextIndex, 200);
    const listener = jest.fn();
    controller.onDidChangeCodeLenses(listener);

    controller.schedule();
    await jest.advanceTimersByTimeAsync(200);
    expect(applyNextIndex).not.toHaveBeenCalled();
    expect(listener).not.toHaveBeenCalled();
    controller.dispose();
    jest.useRealTimers();
  });
});

describe('ValidationController', () => {
  it('объединяет частые изменения и проверяет только последний текст', async () => {
    jest.useFakeTimers();
    const validate = jest.fn();
    const controller = new ValidationController(validate, 120);

    controller.schedule('A');
    controller.schedule('B');
    await jest.advanceTimersByTimeAsync(120);

    expect(validate).toHaveBeenCalledTimes(1);
    expect(validate.mock.calls[0][0]).toBe('B');
    controller.dispose();
    jest.useRealTimers();
  });

  it('не публикует pending validation после dispose', async () => {
    jest.useFakeTimers();
    const validate = jest.fn();
    const controller = new ValidationController(validate, 120);

    controller.schedule('текст');
    controller.dispose();
    await jest.advanceTimersByTimeAsync(120);

    expect(validate).not.toHaveBeenCalled();
    jest.useRealTimers();
  });

  it('отменяет pending validation до закрытия документа', async () => {
    jest.useFakeTimers();
    const validate = jest.fn();
    const controller = new ValidationController(validate, 120);

    controller.schedule('текст');
    controller.cancel();
    await jest.advanceTimersByTimeAsync(120);

    expect(validate).not.toHaveBeenCalled();
    controller.dispose();
    jest.useRealTimers();
  });

  it('делает generation guard неактуальным после нового изменения', async () => {
    jest.useFakeTimers();
    let isCurrent: (() => boolean) | undefined;
    const controller = new ValidationController((_text, guard) => { isCurrent = guard; }, 120);

    controller.schedule('A');
    await jest.advanceTimersByTimeAsync(120);
    expect(isCurrent?.()).toBe(true);
    controller.schedule('B');
    expect(isCurrent?.()).toBe(false);
    controller.dispose();
    jest.useRealTimers();
  });
});

describe('editor validation event wiring', () => {
  it('debounce-путь change event публикует только последний текст, не смешивает документы и отменяется при close', async () => {
    jest.useFakeTimers();
    const diagnostics = { set: jest.fn(), delete: jest.fn() } as unknown as vscode.DiagnosticCollection;
    const scheduler = new DocumentValidationScheduler<{ uri: { toString(): string }; text: string }>((document, isCurrent) => {
      if (isCurrent()) diagnostics.set(document.uri as unknown as vscode.Uri, [document.text] as unknown as vscode.Diagnostic[]);
    });
    const context = { subscriptions: [] as vscode.Disposable[] } as unknown as vscode.ExtensionContext;
    const workspace = vscode.workspace as unknown as {
      onDidChangeTextDocument: jest.Mock;
      onDidCloseTextDocument: jest.Mock;
      onDidOpenTextDocument: jest.Mock;
    };
    workspace.onDidOpenTextDocument.mockClear();
    workspace.onDidChangeTextDocument.mockClear();
    workspace.onDidCloseTextDocument.mockClear();
    registerValidationListeners(context, scheduler as unknown as DocumentValidationScheduler<vscode.TextDocument>, diagnostics, jest.fn());

    const change = workspace.onDidChangeTextDocument.mock.calls[0][0] as (event: { document: unknown }) => void;
    const close = workspace.onDidCloseTextDocument.mock.calls[0][0] as (document: unknown) => void;
    const first = { uri: { toString: () => 'file:///A.md' }, text: 'A-устаревший' };
    const latest = { uri: { toString: () => 'file:///A.md' }, text: 'A-последний' };
    const independent = { uri: { toString: () => 'file:///B.md' }, text: 'B-независимый' };

    change({ document: first });
    change({ document: latest });
    change({ document: independent });
    await jest.advanceTimersByTimeAsync(120);
    expect((diagnostics.set as jest.Mock).mock.calls).toEqual(expect.arrayContaining([
      [latest.uri, ['A-последний']],
      [independent.uri, ['B-независимый']],
    ]));
    expect(diagnostics.set).toHaveBeenCalledTimes(2);

    change({ document: { uri: latest.uri, text: 'A-после-close' } });
    close(latest);
    await jest.advanceTimersByTimeAsync(120);
    expect(diagnostics.set).toHaveBeenCalledTimes(2);
    expect(diagnostics.delete).toHaveBeenCalledWith(latest.uri);
    scheduler.dispose();
    jest.useRealTimers();
  });
});

describe('editor language compatibility', () => {
  const documentAt = (fsPath: string, languageId = 'markdown') => ({
    uri: { fsPath, toString: () => `file://${fsPath}` },
    languageId,
  }) as unknown as vscode.TextDocument;

  it('назначает language только STEP внутри custom taskDirectory', () => {
    const root = path.join(path.sep, 'workspace');

    expect(isCanonicalStepDocument(documentAt(path.join(root, 'custom', 'steps', 'STEP-101.md')), root, editorManifest)).toBe(true);
    expect(isCanonicalStepDocument(documentAt(path.join(root, 'custom', 'outside', 'STEP-101.md')), root, editorManifest)).toBe(false);
    expect(isCanonicalStepDocument(documentAt(path.join(root, 'custom', 'steps-old', 'STEP-101.md')), root, editorManifest)).toBe(false);
    expect(isCanonicalStepDocument(documentAt(path.join(root, 'custom', 'steps', 'README.md')), root, editorManifest)).toBe(false);
  });

  it('не повторяет assignment для harness-step, pending lifecycle и dispose', async () => {
    const root = path.join(path.sep, 'workspace');
    const document = documentAt(path.join(root, 'custom', 'steps', 'STEP-101.md'));
    let completeAssignment: ((document: vscode.TextDocument) => void) | undefined;
    const setLanguage = jest.fn(() => new Promise<vscode.TextDocument>((resolve) => { completeAssignment = resolve; }));
    const controller = new StepLanguageAssociationController(root, () => editorManifest, setLanguage);

    controller.associate(document);
    controller.associate(document);
    await Promise.resolve();
    expect(setLanguage).toHaveBeenCalledTimes(1);
    completeAssignment?.(document);
    await Promise.resolve();

    controller.associate(documentAt(path.join(root, 'custom', 'steps', 'STEP-101.md'), 'harness-step'));
    expect(setLanguage).toHaveBeenCalledTimes(1);
    controller.dispose();
    controller.associate(documentAt(path.join(root, 'custom', 'steps', 'STEP-102.md')));
    expect(setLanguage).toHaveBeenCalledTimes(1);
  });

  it('не назначает runtime language для non-Markdown документа', () => {
    const root = path.join(path.sep, 'workspace');
    const setLanguage = jest.fn();
    const controller = new StepLanguageAssociationController(root, () => editorManifest, setLanguage);

    controller.associate(documentAt(path.join(root, 'custom', 'steps', 'STEP-101.md'), 'plaintext'));

    expect(setLanguage).not.toHaveBeenCalled();
    controller.dispose();
  });

  it('локально поглощает rejected runtime assignment', async () => {
    const root = path.join(path.sep, 'workspace');
    const setLanguage = jest.fn(() => Promise.reject(new Error('language assignment failed')));
    const controller = new StepLanguageAssociationController(root, () => editorManifest, setLanguage);

    controller.associate(documentAt(path.join(root, 'custom', 'steps', 'STEP-101.md')));
    await Promise.resolve();
    await Promise.resolve();
    expect(setLanguage).toHaveBeenCalledTimes(1);
    controller.dispose();
  });

  it('локально поглощает synchronous throw, очищает pending и допускает retry', async () => {
    const root = path.join(path.sep, 'workspace');
    const document = documentAt(path.join(root, 'custom', 'steps', 'STEP-101.md'));
    const setLanguage = jest
      .fn<Thenable<vscode.TextDocument>, [vscode.TextDocument, string]>()
      .mockImplementationOnce(() => { throw new Error('language assignment failed synchronously'); })
      .mockResolvedValueOnce(document);
    const controller = new StepLanguageAssociationController(root, () => editorManifest, setLanguage);

    expect(() => controller.associate(document)).not.toThrow();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    controller.associate(document);
    await Promise.resolve();
    expect(setLanguage).toHaveBeenCalledTimes(2);
    controller.dispose();
  });

  it('оставляет runtime selector language-only, а index читает custom manifest taskDirectory', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'harness-editor-'));
    try {
      await fs.mkdir(path.join(root, 'custom', 'steps'), { recursive: true });
      await fs.writeFile(path.join(root, 'custom', 'steps', 'STEP-101.md'), minimalStep, 'utf8');
      const index = await loadIndex(root, editorManifest);

      expect(stepEditorSelector).toEqual({ language: 'harness-step' });
      expect(index.steps.get('STEP-101')?.content).toBe(minimalStep);
      expect(stepEditorWatchPatterns(editorManifest)).toContain('custom/steps/STEP-*.md');
      expect(stepEditorWatchPatterns(editorManifest)).not.toContain('planning/tasks/STEP-*.md');
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it('задаёт парный HTML block comment и композирует стандартный Markdown scope', async () => {
    const root = path.resolve(__dirname, '../../..');
    const [configuration, grammar, manifest] = await Promise.all([
      fs.readFile(path.join(root, 'language-configuration.json'), 'utf8'),
      fs.readFile(path.join(root, 'syntaxes', 'harness-step.tmLanguage.json'), 'utf8'),
      fs.readFile(path.join(root, 'package.json'), 'utf8'),
    ]);
    const languageConfiguration = JSON.parse(configuration) as { comments: Record<string, unknown> };
    const grammarConfiguration = JSON.parse(grammar) as { patterns: Array<Record<string, string>> };
    const packageConfiguration = JSON.parse(manifest) as { contributes: { languages: Array<{ id: string; filenamePatterns: string[] }> } };

    expect(languageConfiguration.comments).toEqual({ blockComment: ['<!--', '-->'] });
    expect(grammarConfiguration.patterns.at(-1)).toEqual({ include: 'text.html.markdown' });
    expect(grammarConfiguration.patterns.slice(0, -1)).toEqual(expect.arrayContaining([expect.objectContaining({ name: 'keyword.control.harness-step' })]));
    expect(packageConfiguration.contributes.languages.find((language) => language.id === 'harness-step')?.filenamePatterns).toEqual(['**/planning/tasks/STEP-*.md']);
  });
});
