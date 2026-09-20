import * as vscode from 'vscode';
import type { I18nService } from '../locales/activation';
import { ManifestData, StepData } from '../parser/types';
import type { InitGuard } from './preDispatch';
import type { AgentDispatcher, AgentInvocationContext } from '../api/types';

/**
 * Общий контракт Command layer (REQ-001/ADR-003): все 11 MVP-команд реализуют
 * один и тот же pre-dispatch/dispatch hook. Сама pre-dispatch-логика — в
 * `preDispatch.ts` (чистый слой, без `vscode`), этот файл — только контракт и
 * общая vscode-часть dispatch для команд, вызывающих агента.
 */

export type InputKind = 'none' | 'text' | 'stepPicker';

export interface DispatchContext {
  readonly workspaceRoot: string;
  readonly manifest: ManifestData;
  readonly i18n: I18nService;
  readonly dispatcher: AgentDispatcher;
  readonly targetStep?: StepData;
  readonly freeText?: string;
}

export interface HarnessCommand {
  readonly id: string;
  readonly protocolName: string;
  readonly inputKind: InputKind;
  readonly initGuard: InitGuard;
  readonly stepScoped: boolean;
  dispatch(ctx: DispatchContext): Promise<void>;
}

/**
 * Общая реализация `dispatch()` для 9 из 11 команд, которым требуется
 * фактический вызов агента. `STATUS PROJECT`/`NEXT STEP` её не используют —
 * их семантика полностью покрывается Parser layer (см. `status.ts`/`nextStep.ts`).
 */
export async function dispatchViaAgent(ctx: DispatchContext, protocolName: string): Promise<void> {
  const command = ctx.targetStep
    ? protocolName.replace('STEP-NNN', ctx.targetStep.id)
    : ctx.freeText !== undefined
      ? `${protocolName}: ${ctx.freeText}`
      : protocolName;
  const invocationCtx: AgentInvocationContext = {
    protocolName: command,
    workspaceRoot: ctx.workspaceRoot,
    manifest: ctx.manifest,
    targetStep: ctx.targetStep,
    freeText: ctx.freeText,
  };
  const result = await ctx.dispatcher.invoke(invocationCtx);
  const message = ctx.i18n.t(result.messageKey, result.params);
  if (result.ok) {
    void vscode.window.showInformationMessage(message);
  } else {
    void vscode.window.showWarningMessage(message);
  }
}
