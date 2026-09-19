import * as vscode from 'vscode';
import { isCanonicalCommand, sanitizeExternalText, writeInvocationPolicy } from './executors';
import type { AgentDispatcher, AgentInvocationContext, AgentInvocationResult } from './types';
import { getI18nService, type I18nService } from '../locales/activation';

/**
 * Единственная VSCode-граница agent integration layer. Она не выводит prompt
 * целиком (контекст может содержать чувствительные данные), но показывает
 * пользователю этап, executor и безопасную диагностическую причину сбоя.
 */
export class HarnessAgentDispatcher implements AgentDispatcher {
  private active = false;
  private controller: AbortController | undefined;
  private readonly output = vscode.window.createOutputChannel('Harness');

  cancel(): void {
    this.controller?.abort();
  }

  async invoke(ctx: AgentInvocationContext): Promise<AgentInvocationResult> {
    if (this.active) return { ok: false, messageKey: 'harness.agent.busy' };
    this.active = true;
    const controller = new AbortController();
    const i18n = getI18nService();
    this.controller = controller;
    void vscode.commands.executeCommand('setContext', 'harness.agent.running', true);
    try {
      if (!isCanonicalCommand(ctx.protocolName) || hasEmptyTextInput(ctx.protocolName)) {
        this.output.show(true);
        this.output.appendLine(i18n.t('harness.agent.output.invalidCommand'));
        return { ok: false, messageKey: 'harness.agent.preValidation', params: { message: i18n.t('harness.agent.preValidation.invalidCommand') } };
      }
      const policy = writeInvocationPolicy(ctx.protocolName, ctx.targetStep);
      if (!policy) {
        this.output.show(true);
        this.output.appendLine(i18n.t('harness.agent.output.incompletePolicy'));
        return { ok: false, messageKey: 'harness.agent.preValidation', params: { message: i18n.t('harness.agent.preValidation.incompletePolicy') } };
      }
      const label = manualHandoffLabel(policy.command, i18n);
      this.output.show(true);
      // ADR-011: оба UI sink получают один уже безопасный label, а не command
      // с user-controlled free text. Так Output Channel не становится bypass
      // для boundary, который защищает notification ниже.
      this.output.appendLine(label);
      if (controller.signal.aborted) return this.cancelledResult();
      // ADR-010 запрещает любой automatic lifecycle в MVP. Проверяем policy
      // до context builder, чтобы prompt и workspace данные не дошли до CLI.
      return this.manualFallback(label);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const safeMessage = sanitizeExternalText(message);
      this.output.appendLine(`[runtime] ${safeMessage}`);
      return { ok: false, messageKey: 'harness.agent.runtime', params: { message: safeMessage } };
    } finally {
      this.active = false;
      if (this.controller === controller) this.controller = undefined;
      void vscode.commands.executeCommand('setContext', 'harness.agent.running', false);
    }
  }

  /** ADR-010: manual handoff не передаёт user-controlled text в Output Channel или UI. */
  private manualFallback(label: string): AgentInvocationResult {
    return { ok: false, messageKey: 'harness.agent.manualFallback', params: { message: label } };
  }

  private cancelledResult(): AgentInvocationResult {
    this.output.appendLine('[result] cancelled');
    return { ok: false, messageKey: 'harness.agent.cancelled' };
  }

  dispose(): void {
    this.cancel();
    this.output.dispose();
  }
}

/**
 * ADR-011 разрешает exact command только операциям без free text. В MVP text
 * input есть у STEP ADD и PROJECT QUICK FIX; original intent не передаётся ни
 * одному UI sink и пользователь повторяет его в самостоятельно открытом CLI.
 */
export function manualHandoffLabel(command: string, i18n: I18nService): string {
  const textCommand = command.match(/^(STEP ADD|PROJECT QUICK FIX):/);
  return textCommand
    ? i18n.t('harness.agent.manualHandoff.textCommand', { command: textCommand[1] })
    : sanitizeExternalText(command);
}

/** Даже при прямом вызове dispatcher control-only text не образует handoff. */
function hasEmptyTextInput(command: string): boolean {
  const textCommand = command.match(/^(?:STEP ADD|PROJECT QUICK FIX):([\s\S]*)$/);
  return Boolean(textCommand && !textCommand[1].replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu, ' ').trim());
}

export type { AgentDispatcher, AgentInvocationContext, AgentInvocationResult } from './types';
