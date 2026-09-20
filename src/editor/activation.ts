import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { HARNESS_MANIFEST_REL_PATH, resolveHarnessArtifactPath } from '../parser/artifactPaths';
import { getI18nService } from '../locales/activation';
import { parseManifest } from '../parser/yamlParser';
import type { ManifestData } from '../parser/types';
import { provideCompletionItems } from './autocomplete';
import { createCodeActions } from './codeActions';
import { createCodeLenses } from './codeLens';
import { createDefinitionProvider } from './definitionProvider';
import { provideHover } from './hoverProvider';
import { createEditorIndex, StepEditorIndex, validateStepDocument } from './validation';

// Runtime providers не знают layout: manifest-resolved index уже определяет artifacts.
// Static filename pattern остаётся только declarative ограничением VS Code contribution API.
export const stepEditorSelector: vscode.DocumentSelector = { language: 'harness-step' };

/**
 * Проверяет принадлежность документа ровно canonical taskDirectory из manifest.
 * `path.relative` сохраняет границу каталога: sibling `tasks-old` не может
 * пройти проверку как дочерний путь `tasks`.
 */
export function isCanonicalStepDocument(
  document: Pick<vscode.TextDocument, 'uri'>,
  workspaceRoot: string,
  manifest: ManifestData,
): boolean {
  const taskDirectory = path.resolve(workspaceRoot, manifest.protocol.taskDirectory);
  const documentPath = path.resolve(document.uri.fsPath);
  const relative = path.relative(taskDirectory, documentPath);
  const isDescendant = relative !== ''
    && relative !== '..'
    && !relative.startsWith(`..${path.sep}`)
    && !path.isAbsolute(relative);

  return isDescendant && /^STEP-.*\.md$/.test(path.basename(documentPath));
}

/**
 * Назначает custom language только canonical STEP из текущего manifest.
 * Pending-набор предотвращает дублирование до завершения API-вызова, а guard
 * languageId безопасно переживает close/open lifecycle самого VS Code.
 */
export class StepLanguageAssociationController implements vscode.Disposable {
  private disposed = false;
  private readonly pending = new Set<string>();

  constructor(
    private readonly workspaceRoot: string,
    private readonly getManifest: () => ManifestData,
    private readonly setLanguage: (document: vscode.TextDocument, languageId: string) => Thenable<vscode.TextDocument> = vscode.languages.setTextDocumentLanguage,
  ) {}

  associate(document: vscode.TextDocument): void {
    // Runtime association дополняет только Markdown: явный language mode пользователя
    // не заменяется даже для canonical STEP. `harness-step` остаётся idempotent no-op.
    if (this.disposed || document.languageId !== 'markdown' || !isCanonicalStepDocument(document, this.workspaceRoot, this.getManifest())) return;
    const key = document.uri.toString();
    if (this.pending.has(key)) return;

    this.pending.add(key);
    // API может бросить до возврата Thenable на lifecycle boundary. Начало цепочки
    // до вызова гарантирует локальное поглощение ошибки и очистку pending.
    void Promise.resolve().then(() => this.setLanguage(document, 'harness-step'))
      // Ошибка назначения не должна останавливать index, watcher или providers.
      .catch(() => undefined)
      .finally(() => this.pending.delete(key));
  }

  dispose(): void {
    this.disposed = true;
    this.pending.clear();
  }
}

/**
 * Объединяет частые editor events в одну проверку последнего документа.
 * Generation guard оставляет late callback inert после более нового изменения или dispose.
 */
export class ValidationController<T> implements vscode.Disposable {
  private timer: NodeJS.Timeout | undefined;
  private disposed = false;
  private generation = 0;

  constructor(
    private readonly validate: (value: T, isCurrent: () => boolean) => void,
    private readonly delayMs = 120,
  ) {}

  schedule(value: T): void {
    if (this.disposed) return;
    const generation = ++this.generation;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = undefined;
      if (!this.disposed && generation === this.generation) {
        this.validate(value, () => !this.disposed && generation === this.generation);
      }
    }, this.delayMs);
  }

  cancel(): void {
    ++this.generation;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
  }

  dispose(): void {
    this.disposed = true;
    this.cancel();
  }
}

/**
 * Связывает debounce с жизненным циклом конкретного документа, не смешивая
 * pending validation разных открытых STEP. Отдельный seam позволяет проверить
 * именно путь editor event -> publication, а не только timer controller.
 */
export class DocumentValidationScheduler<T extends { uri: { toString(): string } }> implements vscode.Disposable {
  private readonly controllers = new Map<string, ValidationController<T>>();

  constructor(private readonly validate: (document: T, isCurrent: () => boolean) => void) {}

  schedule(document: T): void {
    const key = document.uri.toString();
    let controller = this.controllers.get(key);
    if (!controller) {
      controller = new ValidationController(this.validate);
      this.controllers.set(key, controller);
    }
    controller.schedule(document);
  }

  close(document: T): void {
    const key = document.uri.toString();
    this.controllers.get(key)?.dispose();
    this.controllers.delete(key);
  }

  dispose(): void {
    this.controllers.forEach((controller) => controller.dispose());
    this.controllers.clear();
  }
}

/** Реальный event boundary validation: change debounce, close отменяет pending publication. */
export function registerValidationListeners(
  context: vscode.ExtensionContext,
  scheduler: DocumentValidationScheduler<vscode.TextDocument>,
  diagnostics: vscode.DiagnosticCollection,
  validateNow: (document: vscode.TextDocument) => void,
): void {
  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument(validateNow),
    vscode.workspace.onDidChangeTextDocument((event) => scheduler.schedule(event.document)),
    vscode.workspace.onDidCloseTextDocument((document) => {
      scheduler.close(document);
      diagnostics.delete(document.uri);
    }),
    scheduler,
  );
}

/** Все filesystem watchers получают STEP glob только из manifest, включая custom layout. */
export function stepEditorWatchPatterns(manifest: ManifestData): string[] {
  const adrDirectory = resolveHarnessArtifactPath(manifest, 'adrDirectory');
  return [
    `${manifest.sources.requirements}/REQ-*.md`,
    `${manifest.protocol.taskDirectory}/STEP-*.md`,
    HARNESS_MANIFEST_REL_PATH,
    ...(adrDirectory ? [`${adrDirectory}/ADR-*.md`] : []),
  ];
}

/**
 * Отделяет debounce watcher от CodeLens cache invalidation.
 * Событие публикуется только после фактической замены index, поэтому ошибка
 * чтения сохраняет уже показанные lenses без ложной перерисовки.
 */
export class CodeLensRefreshController<T> implements vscode.Disposable {
  private readonly changes = new vscode.EventEmitter<void>();
  private timer: NodeJS.Timeout | undefined;
  private disposed = false;
  private generation = 0;
  readonly onDidChangeCodeLenses = this.changes.event;

  constructor(
    private readonly loadNextIndex: () => Promise<T | false>,
    private readonly applyNextIndex: (next: T) => void,
    private readonly delayMs = 200,
  ) {}

  schedule(): void {
    if (this.disposed) return;
    const generation = ++this.generation;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = undefined;
      void this.refresh(generation);
    }, this.delayMs);
  }

  private async refresh(generation: number): Promise<void> {
    try {
      const next = await this.loadNextIndex();
      // Поздний refresh не должен вернуть старый index поверх более нового watcher event.
      if (next !== false && !this.disposed && generation === this.generation) {
        this.applyNextIndex(next);
        this.changes.fire();
      }
    } catch {
      // Ошибка refresh не должна инвалидировать CodeLens, построенные по last-known-good index.
    }
  }

  dispose(): void {
    this.disposed = true;
    if (this.timer) clearTimeout(this.timer);
    this.changes.dispose();
  }
}

/** REQ-003: providers читают только индекс; manifest-resolved sources обновляют его через watcher. */
export async function registerStepEditor(context: vscode.ExtensionContext): Promise<void> {
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!folder) return;
  const root = folder.uri.fsPath;
  const i18n = getI18nService();
  const initialManifest = await parseManifest(path.join(root, HARNESS_MANIFEST_REL_PATH));
  if (!initialManifest.ok) return;
  let manifest = initialManifest.value;
  let index = await loadIndex(root, manifest);
  const diagnostics = vscode.languages.createDiagnosticCollection('harness-step');
  // VSCode caches CodeLens for open editors. An external artifact change only
  // refreshes our index, so the provider must explicitly invalidate that cache.
  context.subscriptions.push(diagnostics);
  const validate = (document: vscode.TextDocument, isCurrent: () => boolean = () => true): void => {
    if (document.languageId !== 'harness-step') return;
    const content = document.getText();
    const nextDiagnostics = validateStepDocument(content, index, i18n.t).map((item) => {
      const start = document.positionAt(item.offset);
      return new vscode.Diagnostic(new vscode.Range(start, document.positionAt(item.offset + item.length)), item.message, item.severity === 'error' ? vscode.DiagnosticSeverity.Error : vscode.DiagnosticSeverity.Warning);
    });
    // Validation синхронна, но guard сохраняет latest-only contract при re-entrant event.
    if (isCurrent()) diagnostics.set(document.uri, nextDiagnostics);
  };
  // Каждый открытый STEP получает свой debounce: изменение A не должно отменять
  // ожидающую диагностику независимого документа B.
  const validations = new DocumentValidationScheduler(validate);
  const languageAssociation = new StepLanguageAssociationController(root, () => manifest);
  const handleDocument = (document: vscode.TextDocument): void => {
    languageAssociation.associate(document);
    validate(document);
  };
  let sourceWatchers: vscode.Disposable[] = [];
  const disposeSourceWatchers = (): void => { sourceWatchers.forEach((watcher) => watcher.dispose()); sourceWatchers = []; };
  const codeLensRefresh = new CodeLensRefreshController(
    async () => {
      const next = await refreshIndex(root);
      return next ?? false;
    },
    (next) => {
      const manifestChanged = JSON.stringify(next.manifest) !== JSON.stringify(manifest);
      manifest = next.manifest;
      index = next.index;
      if (manifestChanged) rewatch();
      vscode.workspace.textDocuments.forEach(handleDocument);
    },
  );
  const refresh = (): void => codeLensRefresh.schedule();
  const rewatch = (): void => {
    disposeSourceWatchers();
    for (const pattern of stepEditorWatchPatterns(manifest)) {
      const watcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(folder, pattern));
      watcher.onDidCreate(refresh);
      watcher.onDidChange(refresh);
      watcher.onDidDelete(refresh);
      sourceWatchers.push(watcher);
    }
  };
  rewatch();
  context.subscriptions.push(codeLensRefresh, { dispose: disposeSourceWatchers }, languageAssociation);
  registerValidationListeners(context, validations, diagnostics, handleDocument);
  vscode.workspace.textDocuments.forEach(handleDocument);
  context.subscriptions.push(
    vscode.languages.registerCodeLensProvider(stepEditorSelector, {
      onDidChangeCodeLenses: codeLensRefresh.onDidChangeCodeLenses,
      provideCodeLenses: (document) => createCodeLenses(document, index, i18n.t),
    }),
    vscode.languages.registerDefinitionProvider(stepEditorSelector, createDefinitionProvider(() => index)),
    vscode.languages.registerHoverProvider(stepEditorSelector, { provideHover: (document, position) => provideHover(document, position, index, i18n.t) }),
    vscode.languages.registerCompletionItemProvider(stepEditorSelector, { provideCompletionItems: (document, position) => provideCompletionItems(document, position, index) }, '-'),
    vscode.languages.registerCodeActionsProvider(stepEditorSelector, { provideCodeActions: (document, range) => createCodeActions(document, range, i18n.t) }, { providedCodeActionKinds: [vscode.CodeActionKind.QuickFix] }),
    vscode.commands.registerCommand('harness.editor.openReference', (id: string) => openArtifact(index, id)),
    vscode.commands.registerCommand('harness.editor.openPlan', (id?: string) => openFile(vscode.Uri.file(path.join(root, manifest.sources.roadmap)), id))
  );
}

/** Ошибка refresh сохраняет последний корректный index и не создаёт unhandled rejection. */
async function refreshIndex(root: string): Promise<{ manifest: ManifestData; index: StepEditorIndex } | undefined> {
  const parsed = await parseManifest(path.join(root, HARNESS_MANIFEST_REL_PATH));
  if (!parsed.ok) return undefined;
  try { return { manifest: parsed.value, index: await loadIndex(root, parsed.value) }; } catch { return undefined; }
}

export async function loadIndex(root: string, manifest: ManifestData): Promise<StepEditorIndex> {
  const requirements = await readMarkdownDirectory(path.join(root, manifest.sources.requirements), /^REQ-\d+.*\.md$/);
  const steps = await readMarkdownDirectory(path.join(root, manifest.protocol.taskDirectory), /^STEP-\d+.*\.md$/);
  const adrDirectory = resolveHarnessArtifactPath(manifest, 'adrDirectory');
  const adrs = adrDirectory ? await readMarkdownDirectory(path.join(root, adrDirectory), /^ADR-\d+.*\.md$/) : [];
  return createEditorIndex({ requirements, steps, adrs });
}

async function readFileSafely(file: string): Promise<string | undefined> { try { return await fs.readFile(file, 'utf8'); } catch { return undefined; } }

/** Один исчезнувший между readdir/readFile artifact не должен отменять весь refresh. */
export async function readMarkdownDirectory(directory: string, pattern: RegExp, readFile: (file: string) => Promise<string | undefined> = readFileSafely): Promise<Array<{ content: string; uri: vscode.Uri }>> {
  try {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    const sources = await Promise.all(entries.filter((entry) => entry.isFile() && pattern.test(entry.name)).map(async (entry) => {
      const file = path.join(directory, entry.name);
      let content: string | undefined;
      try { content = await readFile(file); } catch { return undefined; }
      return content === undefined ? undefined : { content, uri: vscode.Uri.file(file) };
    }));
    return sources.filter((source): source is { content: string; uri: vscode.Uri } => source !== undefined);
  } catch { return []; }
}

async function openArtifact(index: StepEditorIndex, id: string): Promise<void> {
  const artifact = index.requirements.get(id) ?? index.steps.get(id) ?? index.adrs.get(id);
  if (artifact?.uri) await openFile(artifact.uri, id);
}

async function openFile(uri: vscode.Uri, id?: string): Promise<void> {
  try {
    const document = await vscode.workspace.openTextDocument(uri);
    const editor = await vscode.window.showTextDocument(document);
    const offset = Math.max(0, id ? document.getText().indexOf(id) : 0);
    const range = new vscode.Range(document.positionAt(offset), document.positionAt(offset + (id?.length ?? 0)));
    editor.revealRange(range);
    editor.selection = new vscode.Selection(range.start, range.end);
  } catch {
    // Target could disappear after indexing; navigation must fail locally.
  }
}
