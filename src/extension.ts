import * as vscode from 'vscode';
import { activateI18n } from './locales/activation';
import { registerHarnessCommands } from './commands/activation';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  await activateI18n(context);
  registerHarnessCommands(context);
}

export function deactivate(): void {}
