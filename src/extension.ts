import * as vscode from 'vscode';
import { activateI18n } from './locales/activation';
import { registerHarnessCommands } from './commands/activation';
import { HarnessExplorerHandle, registerHarnessExplorer } from './explorer/activation';

/**
 * FIX STEP-006 (2-й проход): `explorerProvider` в `exports` — тестовая
 * инфраструктура, не product-контракт. Единственный способ проверить дерево
 * Sidebar Explorer (структуру групп, статус-иконки, `contextValue`, реакцию
 * на внешнюю правку файла) в реальном headless Extension Host, у которого нет
 * GUI для клика по дереву (`tests/integration/explorer.test.js`).
 */
export interface HarnessExtensionExports {
  explorerProvider?: HarnessExplorerHandle['provider'];
}

export async function activate(context: vscode.ExtensionContext): Promise<HarnessExtensionExports> {
  await activateI18n(context);
  registerHarnessCommands(context);
  const explorer = await registerHarnessExplorer(context);
  return { explorerProvider: explorer?.provider };
}

export function deactivate(): void {}
