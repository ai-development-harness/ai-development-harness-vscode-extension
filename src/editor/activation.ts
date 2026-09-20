import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { resolveHarnessArtifactPath } from '../parser/artifactPaths';
import { getI18nService } from '../locales/activation';
import { parseManifest } from '../parser/yamlParser';
import type { ManifestData } from '../parser/types';
import { provideCompletionItems } from './autocomplete';
import { createCodeActions } from './codeActions';
import { createCodeLenses } from './codeLens';
import { createDefinitionProvider } from './definitionProvider';
import { provideHover } from './hoverProvider';
import { createEditorIndex, StepEditorIndex, validateStepDocument } from './validation';

const selector: vscode.DocumentSelector = { language: 'harness-step', pattern: '**/planning/tasks/STEP-*.md' };

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
  const initialManifest = await parseManifest(path.join(root, '.project', 'manifest.yaml'));
  if (!initialManifest.ok) return;
  let manifest = initialManifest.value;
  let index = await loadIndex(root, manifest);
  const diagnostics = vscode.languages.createDiagnosticCollection('harness-step');
  // VSCode caches CodeLens for open editors. An external artifact change only
  // refreshes our index, so the provider must explicitly invalidate that cache.
  context.subscriptions.push(diagnostics);
  const validate = (document: vscode.TextDocument): void => {
    if (document.languageId !== 'harness-step') return;
    diagnostics.set(document.uri, validateStepDocument(document.getText(), index, i18n.t).map((item) => {
      const start = document.positionAt(item.offset);
      return new vscode.Diagnostic(new vscode.Range(start, document.positionAt(item.offset + item.length)), item.message, item.severity === 'error' ? vscode.DiagnosticSeverity.Error : vscode.DiagnosticSeverity.Warning);
    }));
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
      vscode.workspace.textDocuments.forEach(validate);
    },
  );
  const refresh = (): void => codeLensRefresh.schedule();
  const rewatch = (): void => {
    disposeSourceWatchers();
    const adrDirectory = resolveHarnessArtifactPath(manifest, 'adrDirectory');
    const patterns = [manifest.sources.requirements, `${manifest.protocol.taskDirectory}/STEP-*.md`, '.project/manifest.yaml', ...(adrDirectory ? [`${adrDirectory}/ADR-*.md`] : [])];
    for (const pattern of patterns) {
      const watcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(folder, pattern));
      watcher.onDidCreate(refresh);
      watcher.onDidChange(refresh);
      watcher.onDidDelete(refresh);
      sourceWatchers.push(watcher);
    }
  };
  rewatch();
  context.subscriptions.push(codeLensRefresh, { dispose: disposeSourceWatchers });
  context.subscriptions.push(vscode.workspace.onDidOpenTextDocument(validate), vscode.workspace.onDidChangeTextDocument((event) => validate(event.document)), vscode.workspace.onDidCloseTextDocument((document) => diagnostics.delete(document.uri)));
  vscode.workspace.textDocuments.forEach(validate);
  context.subscriptions.push(
    vscode.languages.registerCodeLensProvider(selector, {
      onDidChangeCodeLenses: codeLensRefresh.onDidChangeCodeLenses,
      provideCodeLenses: (document) => createCodeLenses(document, index, i18n.t),
    }),
    vscode.languages.registerDefinitionProvider(selector, createDefinitionProvider(() => index)),
    vscode.languages.registerHoverProvider(selector, { provideHover: (document, position) => provideHover(document, position, index, i18n.t) }),
    vscode.languages.registerCompletionItemProvider(selector, { provideCompletionItems: (document, position) => provideCompletionItems(document, position, index) }, '-'),
    vscode.languages.registerCodeActionsProvider(selector, { provideCodeActions: (document, range) => createCodeActions(document, range, i18n.t) }, { providedCodeActionKinds: [vscode.CodeActionKind.QuickFix] }),
    vscode.commands.registerCommand('harness.editor.openReference', (id: string) => openArtifact(index, id)),
    vscode.commands.registerCommand('harness.editor.openPlan', (id?: string) => openFile(vscode.Uri.file(path.join(root, manifest.sources.roadmap)), id))
  );
}

/** Ошибка refresh сохраняет последний корректный index и не создаёт unhandled rejection. */
async function refreshIndex(root: string): Promise<{ manifest: ManifestData; index: StepEditorIndex } | undefined> {
  const parsed = await parseManifest(path.join(root, '.project', 'manifest.yaml'));
  if (!parsed.ok) return undefined;
  try { return { manifest: parsed.value, index: await loadIndex(root, parsed.value) }; } catch { return undefined; }
}

export async function loadIndex(root: string, manifest: ManifestData): Promise<StepEditorIndex> {
  const requirementsPath = path.join(root, manifest.sources.requirements);
  const requirements = await readFileSafely(requirementsPath);
  const steps = await readMarkdownDirectory(path.join(root, manifest.protocol.taskDirectory), /^STEP-\d+.*\.md$/);
  const adrDirectory = resolveHarnessArtifactPath(manifest, 'adrDirectory');
  const adrs = adrDirectory ? await readMarkdownDirectory(path.join(root, adrDirectory), /^ADR-\d+.*\.md$/) : [];
  return createEditorIndex({ requirements, requirementsUri: vscode.Uri.file(requirementsPath), steps, adrs });
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
