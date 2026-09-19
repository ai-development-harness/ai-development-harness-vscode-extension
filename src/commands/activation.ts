import * as path from 'node:path';
import * as vscode from 'vscode';
import { getI18nService } from '../locales/activation';
import { parseManifest } from '../parser/yamlParser';
import type { ManifestError } from '../parser/types';
import { DispatchContext, HarnessCommand } from './baseCommand';
import { HarnessAgentDispatcher } from '../api/agentDispatcher';
import { StepFileEntry, listStepFiles, pickStep } from './stepPicker';
import { resolveDependencySteps, runPreDispatchChecks } from './preDispatch';
import { initCommand } from './init';
import { addStepCommand } from './addStep';
import { planCommand } from './plan';
import { implementCommand } from './implement';
import { reviewCommand } from './review';
import { fixCommand } from './fix';
import { runCommand } from './run';
import { nextStepCommand } from './nextStep';
import { statusCommand } from './status';
import { quickFixCommand } from './quickFix';
import { reconcileCommand } from './reconcile';

const ALL_COMMANDS: HarnessCommand[] = [
  initCommand,
  addStepCommand,
  planCommand,
  implementCommand,
  reviewCommand,
  fixCommand,
  runCommand,
  nextStepCommand,
  statusCommand,
  quickFixCommand,
  reconcileCommand,
];

/**
 * Единственная точка использования `AgentDispatcher` (см. `baseCommand.ts`) —
 * STEP-009 подставит сюда реальную реализацию, не трогая 11 файлов команд.
 */
const dispatcher = new HarnessAgentDispatcher();

export function registerHarnessCommands(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    dispatcher,
    vscode.commands.registerCommand('harness.cancelAgent', () => dispatcher.cancel())
  );
  for (const command of ALL_COMMANDS) {
    context.subscriptions.push(
      vscode.commands.registerCommand(command.id, (explicitArg?: string) => handleCommand(command, explicitArg))
    );
  }
}

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

async function handleCommand(command: HarnessCommand, explicitArg?: string): Promise<void> {
  const i18n = getI18nService();
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!folder) {
    void vscode.window.showErrorMessage(i18n.t('harness.error.noWorkspace'));
    return;
  }
  const workspaceRoot = folder.uri.fsPath;
  const manifestResult = await parseManifest(path.join(workspaceRoot, '.project', 'manifest.yaml'));
  if (!manifestResult.ok) {
    void vscode.window.showErrorMessage(
      i18n.t(manifestErrorKey(manifestResult.error.kind), manifestErrorParams(manifestResult.error))
    );
    return;
  }
  const manifest = manifestResult.value;

  let entries: StepFileEntry[] = [];
  let targetStep: DispatchContext['targetStep'];
  let freeText: string | undefined;

  if (command.inputKind === 'stepPicker') {
    entries = await listStepFiles(workspaceRoot, manifest);
    targetStep = explicitArg ? entries.find((entry) => entry.data.id === explicitArg)?.data : undefined;
    if (!targetStep) {
      const picked = await pickStep(entries, i18n, command.protocolName);
      if (!picked) return; // отмена пользователем
      targetStep = picked.data;
    }
  } else if (command.inputKind === 'text') {
    freeText =
      explicitArg ??
      (await vscode.window.showInputBox({
        prompt: i18n.t('harness.command.textInput.prompt', { command: command.protocolName }),
      }));
    if (freeText === undefined) return; // отмена пользователем
    // Пустой или состоящий только из control/format input не образует CTS-команду.
    if (!freeText.replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu, ' ').trim()) {
      // Используем общий catalog blocker, чтобы Command Palette и direct dispatcher
      // не расходились по локализации и actionable тексту. См. ADR-011 Decision 5.
      void vscode.window.showErrorMessage(
        i18n.t('harness.agent.preValidation', {
          message: i18n.t('harness.agent.preValidation.invalidCommand'),
        })
      );
      return;
    }
  }

  const dependencySteps =
    command.stepScoped && targetStep
      ? resolveDependencySteps(targetStep, entries.map((entry) => entry.data))
      : undefined;

  const validation = runPreDispatchChecks(command, { manifest, targetStep, dependencySteps });
  if (!validation.ok) {
    void vscode.window.showErrorMessage(i18n.t(validation.messageKey, validation.params));
    return;
  }

  await command.dispatch({ workspaceRoot, manifest, i18n, dispatcher, targetStep, freeText });
}
