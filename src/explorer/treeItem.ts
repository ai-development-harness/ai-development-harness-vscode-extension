import * as path from 'node:path';
import * as vscode from 'vscode';
import type { I18nService } from '../locales/activation';
import { HarnessNode } from './model';
import { statusPresentation } from './statusIcon';
import { canMarkDone, TERMINAL_STATUSES } from './guards';

function groupLabelKey(id: string): string {
  return `harness.explorer.group.${id}`;
}

/**
 * REQ-002 Implementation plan п.8: `vscode.TreeItem` — единственное место,
 * где `HarnessNode` превращается в vscode-специфичный объект; `iconPath` из
 * `statusPresentation` (чистый модуль). `contextValue` кодирует возможности
 * (`harness.step.canMarkDone`/`harness.step.terminal`), но реальное решение
 * всё равно принимают guard'ы (defense in depth) при выполнении действия.
 */
export function toTreeItem(node: HarnessNode, workspaceRoot: string, i18n: I18nService): vscode.TreeItem {
  switch (node.kind) {
    case 'group': {
      const item = new vscode.TreeItem(i18n.t(groupLabelKey(node.id)), vscode.TreeItemCollapsibleState.Collapsed);
      item.contextValue = 'harness.group';
      return item;
    }
    case 'message': {
      const item = new vscode.TreeItem(i18n.t(node.messageKey, node.params), vscode.TreeItemCollapsibleState.None);
      item.contextValue = 'harness.message';
      item.iconPath = new vscode.ThemeIcon('info');
      return item;
    }
    case 'file': {
      const uri = vscode.Uri.file(path.join(workspaceRoot, node.uri));
      const item = new vscode.TreeItem(node.label, vscode.TreeItemCollapsibleState.None);
      item.resourceUri = uri;
      item.command = { command: 'vscode.open', title: 'Open', arguments: [uri] };
      item.contextValue = 'harness.file';
      return item;
    }
    case 'step': {
      const uri = vscode.Uri.file(path.join(workspaceRoot, node.uri));
      const presentation = statusPresentation(node.data.status);
      const item = new vscode.TreeItem(`${node.data.id} — ${node.data.title}`, vscode.TreeItemCollapsibleState.None);
      item.description = node.data.status;
      item.tooltip = `${node.data.id}\n${node.data.status} / ${node.data.type} / ${node.data.priority}`;
      item.iconPath = new vscode.ThemeIcon(presentation.icon, presentation.color ? new vscode.ThemeColor(presentation.color) : undefined);
      item.command = { command: 'vscode.open', title: 'Open', arguments: [uri] };
      // FIX STEP-006 (2-й проход, F-016): переиспользует единый набор из
      // `guards.ts` вместо собственной инлайн-копии терминальных статусов.
      const terminal = TERMINAL_STATUSES.has(node.data.status);
      const contextValues = ['harness.step'];
      if (canMarkDone(node.data).ok) contextValues.push('harness.step.canMarkDone');
      if (terminal) contextValues.push('harness.step.terminal');
      item.contextValue = contextValues.join(' ');
      return item;
    }
    case 'req': {
      const uri = vscode.Uri.file(path.join(workspaceRoot, node.uri));
      const item = new vscode.TreeItem(`${node.data.id} — ${node.data.title}`, vscode.TreeItemCollapsibleState.None);
      item.description = node.data.status;
      item.command = { command: 'vscode.open', title: 'Open', arguments: [uri] };
      item.contextValue = 'harness.req';
      return item;
    }
    case 'adr': {
      const uri = vscode.Uri.file(path.join(workspaceRoot, node.uri));
      const item = new vscode.TreeItem(`${node.data.id} — ${node.data.title}`, vscode.TreeItemCollapsibleState.None);
      item.description = node.data.status;
      item.command = { command: 'vscode.open', title: 'Open', arguments: [uri] };
      item.contextValue = 'harness.adr';
      return item;
    }
  }
}
