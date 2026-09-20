import * as path from 'node:path';
import * as vscode from 'vscode';
import { getI18nService } from '../locales/activation';
import { HARNESS_MANIFEST_REL_PATH } from '../parser/artifactPaths';
import { parseManifest } from '../parser/yamlParser';
import type { ManifestData, ManifestError } from '../parser/types';
import * as actions from './actions';
import { HarnessNode } from './model';
import { createWatchers, WatcherHandle } from './refresh';
import { HarnessTreeDataProvider } from './treeProvider';
import { createVscodeArtifactReader } from './vscodeReader';

/**
 * REQ-002 Implementation plan п.11. Той же обработкой ошибок манифеста, что
 * `src/commands/activation.ts` (`manifestErrorKey`/`manifestErrorParams`
 * переиспользуются по духу, не копируются вслепую — здесь только explorer-
 * специфичная обвязка: `TreeView`, watcher'ы, `harness.explorer.*` команды).
 */
function manifestErrorKey(kind: ManifestError['kind']): string {
  switch (kind) {
    case 'not-found':
      return 'harness.error.manifestNotFound';
    case 'invalid-yaml':
      return 'harness.error.manifestInvalid';
    case 'missing-field':
      return 'harness.error.manifestMissingField';
  }
}

function manifestErrorParams(error: ManifestError): Record<string, string> {
  switch (error.kind) {
    case 'not-found':
      return { path: error.path };
    case 'invalid-yaml':
      return { path: error.path, message: error.message };
    case 'missing-field':
      return { path: error.path, field: error.field };
  }
}

function toStepOrNodeArg(arg: unknown): string | HarnessNode | undefined {
  if (typeof arg === 'string') return arg;
  if (arg && typeof arg === 'object' && 'kind' in arg) return arg as HarnessNode;
  return undefined;
}

/**
 * FIX STEP-006 (2-й проход, handoff `REVIEW-2026-09-18T1500.md` п.1):
 * возвращает `provider`, если explorer реально активировался — это не
 * product-функциональность (VSCode `activate()` может возвращать
 * произвольные `exports`), а единственный способ для
 * `tests/integration/explorer.test.js` проверить структуру дерева,
 * иконки/`contextValue` и реакцию `FileSystemWatcher` на внешнюю правку
 * файла в реальном headless Extension Host, не открывая GUI.
 */
export interface HarnessExplorerHandle {
  provider: HarnessTreeDataProvider;
}

export async function registerHarnessExplorer(
  context: vscode.ExtensionContext
): Promise<HarnessExplorerHandle | undefined> {
  const i18n = getI18nService();
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!folder) {
    // FIX STEP-006 (F-012): без setContext здесь `harness.isHarnessProject`
    // остаётся undefined, `viewsWelcome.when: "... == false"` не срабатывает,
    // и панель показывается пустой без объяснения.
    void vscode.commands.executeCommand('setContext', 'harness.isHarnessProject', false);
    return undefined; // без открытого workspace explorer не активируется (командный слой уже сообщает об этом)
  }
  const workspaceRoot = folder.uri.fsPath;

  const manifestResult = await parseManifest(path.join(workspaceRoot, HARNESS_MANIFEST_REL_PATH));
  void vscode.commands.executeCommand('setContext', 'harness.isHarnessProject', manifestResult.ok);
  if (!manifestResult.ok) {
    void vscode.window.showWarningMessage(
      i18n.t(manifestErrorKey(manifestResult.error.kind), manifestErrorParams(manifestResult.error))
    );
    return undefined;
  }
  let manifest: ManifestData = manifestResult.value;

  const reader = createVscodeArtifactReader(workspaceRoot);
  const provider = new HarnessTreeDataProvider(workspaceRoot, manifest, reader, i18n);
  const treeView = vscode.window.createTreeView('harness.artifacts', { treeDataProvider: provider, showCollapseAll: true });
  context.subscriptions.push(treeView);

  const updateViewDescription = (): void => {
    treeView.description = actions.filtersDescription(i18n, provider.getFilterState());
    void vscode.commands.executeCommand('setContext', 'harness.explorer.hasFilters', treeView.description !== undefined);
  };
  provider.onDidChangeTreeData(updateViewDescription);
  updateViewDescription();

  let watchers: WatcherHandle[] = [];
  const attachWatchers = (): void => {
    for (const w of watchers) w.dispose();
    watchers = createWatchers(
      workspaceRoot,
      manifest,
      (groupId) => provider.invalidate(groupId),
      async () => {
        const reparsed = await parseManifest(path.join(workspaceRoot, HARNESS_MANIFEST_REL_PATH));
        if (reparsed.ok) {
          manifest = reparsed.value;
          // FIX STEP-006 (F-013): `setManifest` пересчитывает `sources`
          // провайдера и сам инвалидирует дерево — простого `invalidate()`
          // было недостаточно, т.к. провайдер продолжал бы читать по старым
          // путям (см. `treeProvider.ts`).
          provider.setManifest(manifest);
          attachWatchers();
        }
      }
    );
    context.subscriptions.push(...watchers);
  };
  attachWatchers();

  const register = (id: string, handler: (arg?: unknown) => unknown): void => {
    context.subscriptions.push(vscode.commands.registerCommand(id, handler));
  };

  register('harness.explorer.refresh', () => actions.refresh(provider));
  register('harness.explorer.clearFilters', () => actions.clearFilters(provider));
  register('harness.explorer.filterByStatus', (arg) => actions.filterByStatus(provider, i18n, arg as string[] | undefined));
  register('harness.explorer.filterByType', (arg) =>
    actions.filterByType(provider, i18n, workspaceRoot, manifest, arg as string[] | undefined)
  );
  register('harness.explorer.filterByPriority', (arg) =>
    actions.filterByPriority(provider, i18n, workspaceRoot, manifest, arg as string[] | undefined)
  );
  register('harness.explorer.filterByRiskFlag', (arg) =>
    actions.filterByRiskFlag(provider, i18n, workspaceRoot, manifest, arg as string[] | undefined)
  );
  register('harness.explorer.search', (arg) => actions.search(provider, i18n, arg as string | undefined));
  register('harness.explorer.openFile', (arg) => actions.openFile(workspaceRoot, toStepOrNodeArg(arg)));
  register('harness.explorer.viewInExplorer', (arg) => actions.viewInExplorer(workspaceRoot, toStepOrNodeArg(arg)));
  register('harness.explorer.markDone', (arg) => actions.markDone(workspaceRoot, manifest, i18n, provider, toStepOrNodeArg(arg)));
  register('harness.explorer.flagBlocker', (arg) => actions.flagBlocker(workspaceRoot, manifest, i18n, provider, toStepOrNodeArg(arg)));
  register('harness.explorer.createFollowUpStep', (arg) => actions.createFollowUpStep(i18n, toStepOrNodeArg(arg)));
  register('harness.explorer.delete', (arg) => actions.deleteArtifact(workspaceRoot, manifest, i18n, provider, toStepOrNodeArg(arg)));

  return { provider };
}
