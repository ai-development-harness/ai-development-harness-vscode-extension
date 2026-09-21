import * as vscode from 'vscode';
import { activateI18n } from './locales/activation';
import { registerHarnessCommands } from './commands/activation';
import { HarnessExplorerHandle, registerHarnessExplorer } from './explorer/activation';
import { registerStepEditor } from './editor/activation';
import { HarnessStatusBar } from './ui/statusBar';

/**
 * FIX STEP-006 (2-й проход): `explorerProvider` в `exports` — тестовая
 * инфраструктура, не product-контракт. Единственный способ проверить дерево
 * Sidebar Explorer (структуру групп, статус-иконки, `contextValue`, реакцию
 * на внешнюю правку файла) в реальном headless Extension Host, у которого нет
 * GUI для клика по дереву (`tests/integration/explorer.test.js`).
 */
export interface HarnessExtensionExports {
  explorerProvider?: HarnessExplorerHandle['provider'];
  /** Тестовый seam состояния native Status Bar в headless Extension Host. */
  statusBar?: HarnessStatusBar;
}

export async function activate(context: vscode.ExtensionContext): Promise<HarnessExtensionExports> {
  const i18n = await activateI18n(context);
  registerHarnessCommands(context);
  const explorer = await registerHarnessExplorer(context);
  await registerStepEditor(context);
  const folder = vscode.workspace.workspaceFolders?.[0];
  let statusBar: HarnessStatusBar | undefined;
  if (folder) {
    statusBar = new HarnessStatusBar(folder.uri.fsPath, i18n);
    await statusBar.start();
    context.subscriptions.push(statusBar);
  }
  return { explorerProvider: explorer?.provider, statusBar };
}

export function deactivate(): void {}
