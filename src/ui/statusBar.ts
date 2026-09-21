import * as path from 'node:path';
import * as vscode from 'vscode';
import { computeProjectStatus } from '../commands/projectStatus';
import { listStepFiles } from '../commands/stepPicker';
import { selectNextStep } from '../commands/nextStepSelector';
import type { I18nService } from '../locales/activation';
import { HARNESS_MANIFEST_REL_PATH } from '../parser/artifactPaths';
import { parseManifest } from '../parser/yamlParser';

const REFRESH_DELAY_MS = 1_000;

export interface StatusBarDebugState {
  readonly initialized: string;
  readonly completion: string;
  readonly next: string;
  readonly warnings: string;
  readonly commands: Readonly<Record<'initialized' | 'completion' | 'next' | 'warnings', string | undefined>>;
  readonly commandArguments: Readonly<Record<'initialized' | 'completion' | 'next' | 'warnings', readonly unknown[] | undefined>>;
}

function commandId(command: vscode.Command | string | undefined): string | undefined {
  return typeof command === 'string' ? command : command?.command;
}

function commandArguments(command: vscode.Command | string | undefined): readonly unknown[] | undefined {
  return typeof command === 'string' ? undefined : command?.arguments;
}

/** Преобразует internal VS Code id в отображаемую каноническую Harness-команду. */
export function canonicalNextCommand(commandId: string, stepId: string): string {
  const action = commandId === 'harness.plan' ? 'PLAN' : commandId === 'harness.fix' ? 'FIX' : 'IMPLEMENT';
  return `STEP ${action} ${stepId}`;
}

export class StatusBarRefreshScheduler implements vscode.Disposable {
  private timer: NodeJS.Timeout | undefined; private disposed = false; private running = false; private pending = false; private generation = 0;
  constructor(private readonly refresh: () => Promise<void>, private readonly delayMs = REFRESH_DELAY_MS) {}
  schedule(): void { if (this.disposed) return; if (this.running) { this.pending = true; return; } if (!this.timer) this.timer = setTimeout(() => { this.timer = undefined; void this.run(); }, this.delayMs); }
  private async run(): Promise<void> { if (this.disposed || this.running) return; this.running = true; const generation = this.generation; try { await this.refresh(); } catch { /* background refresh must not become an unhandled rejection */ } finally { this.running = false; if (!this.disposed && generation === this.generation && this.pending) { this.pending = false; this.schedule(); } } }
  dispose(): void { this.disposed = true; ++this.generation; if (this.timer) clearTimeout(this.timer); }
}

/** REQ-004: один владелец UI и subscriptions, чтобы file/diagnostic bursts не блокировали editor. */
export class HarnessStatusBar implements vscode.Disposable {
  private disposed = false;
  private readonly initialized = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  private readonly completion = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 99);
  private readonly next = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 98);
  private readonly warnings = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  private readonly scheduler = new StatusBarRefreshScheduler(() => this.refresh());
  private readonly disposables: vscode.Disposable[] = [this.initialized, this.completion, this.next, this.warnings, this.scheduler];
  private artifactWatchers: vscode.Disposable[] = [];
  private artifactWatcherKey: string | undefined;
  constructor(private readonly workspaceRoot: string, private readonly i18n: I18nService) {}
  async start(): Promise<void> {
    for (const item of [this.initialized, this.completion, this.next, this.warnings]) item.show();
    const manifestWatcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(this.workspaceRoot, '.harness/manifest.yaml'));
    this.disposables.push(manifestWatcher, manifestWatcher.onDidChange(() => this.scheduler.schedule()), manifestWatcher.onDidCreate(() => this.scheduler.schedule()), manifestWatcher.onDidDelete(() => this.scheduler.schedule()), vscode.languages.onDidChangeDiagnostics(() => this.scheduler.schedule()), this.i18n.onDidChangeLanguage(() => this.scheduler.schedule()));
    await this.refresh();
  }
  private async refresh(): Promise<void> {
    const manifestPath = path.join(this.workspaceRoot, HARNESS_MANIFEST_REL_PATH); const parsed = await parseManifest(manifestPath);
    if (this.disposed) return;
    if (!parsed.ok || !parsed.value.project.initialized) { this.initialized.text = `$(error) ${this.i18n.t('harness.statusBar.uninitialized')}`; this.initialized.command = { command: 'vscode.open', title: '', arguments: [vscode.Uri.file(manifestPath)] }; this.completion.hide(); this.next.hide(); this.warnings.hide(); return; }
    const manifest = parsed.value; const entries = await listStepFiles(this.workspaceRoot, manifest); if (this.disposed) return; const summary = computeProjectStatus(entries.map((entry) => entry.data));
    this.attachArtifactWatchers(manifest.protocol.taskDirectory, manifest.sources.status);
    const done = summary.byStatus['Выполнено']?.length ?? 0; const percent = entries.length === 0 ? 0 : Math.round(done * 100 / entries.length); const taskRoot = path.resolve(this.workspaceRoot, manifest.protocol.taskDirectory) + path.sep; const count = vscode.languages.getDiagnostics().reduce((total, [uri, diagnostics]) => uri.fsPath.startsWith(taskRoot) ? total + diagnostics.filter((d) => d.severity !== vscode.DiagnosticSeverity.Information && d.severity !== vscode.DiagnosticSeverity.Hint).length : total, 0);
    this.initialized.text = `$(check) ${this.i18n.t('harness.statusBar.initialized')}`; this.initialized.command = { command: 'vscode.open', title: '', arguments: [vscode.Uri.file(manifestPath)] };
    this.completion.text = `$(graph) ${this.i18n.t('harness.statusBar.completion', { done: String(done), total: String(entries.length), percent: String(percent) })}`; this.completion.command = { command: 'vscode.open', title: '', arguments: [vscode.Uri.file(path.join(this.workspaceRoot, manifest.sources.status))] };
    const recommendation = selectNextStep(entries.map((entry) => entry.data)); this.next.text = `$(arrow-right) ${recommendation ? canonicalNextCommand(recommendation.suggestedCommandId, recommendation.step.id) : this.i18n.t('harness.statusBar.noNext')}`; this.next.command = recommendation ? { command: recommendation.suggestedCommandId, title: '', arguments: [recommendation.step.id] } : undefined;
    this.warnings.text = `$(warning) ${this.i18n.t('harness.statusBar.warnings', { count: String(count) })}`; this.warnings.command = 'workbench.action.problems.focus';
    for (const item of [this.completion, this.next, this.warnings]) item.show();
  }
  private attachArtifactWatchers(taskDirectory: string, statusPath: string): void {
    const watcherKey = `${taskDirectory}\u0000${statusPath}`;
    if (watcherKey === this.artifactWatcherKey) return;
    // Пересоздание watcher после каждого refresh образовывало окно, в котором
    // внешнее создание STEP терялось. Меняем subscriptions только при смене
    // manifest-resolved путей, а не при обработке обычного файлового события.
    for (const watcher of this.artifactWatchers) watcher.dispose();
    this.artifactWatchers = [];
    this.artifactWatcherKey = watcherKey;
    const patterns = [path.posix.join(taskDirectory, 'STEP-*.md'), statusPath];
    for (const pattern of patterns) {
      const watcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(this.workspaceRoot, pattern));
      this.artifactWatchers.push(watcher, watcher.onDidChange(() => this.scheduler.schedule()), watcher.onDidCreate(() => this.scheduler.schedule()), watcher.onDidDelete(() => this.scheduler.schedule()));
    }
  }
  /**
   * Снимок нужен только integration-тестам: headless Extension Host не даёт
   * прочитать native Status Bar, включая привязанные command и arguments.
   */
  getDebugState(): StatusBarDebugState { return { initialized: this.initialized.text, completion: this.completion.text, next: this.next.text, warnings: this.warnings.text, commands: { initialized: commandId(this.initialized.command), completion: commandId(this.completion.command), next: commandId(this.next.command), warnings: commandId(this.warnings.command) }, commandArguments: { initialized: commandArguments(this.initialized.command), completion: commandArguments(this.completion.command), next: commandArguments(this.next.command), warnings: commandArguments(this.warnings.command) } }; }
  dispose(): void { this.disposed = true; for (const disposable of [...this.disposables, ...this.artifactWatchers]) disposable.dispose(); }
}
