import * as vscode from 'vscode';
import { canonicalCommandMetadata, writeInvocationPolicy } from './commandPolicy';
import type { AgentDispatcher, AgentInvocationContext, AgentInvocationResult } from './types';
import { getI18nService, type I18nService } from '../locales/activation';

/**
 * Единственная VSCode-граница agent integration layer. Она не выводит prompt
 * целиком (контекст может содержать чувствительные данные), но показывает
 * пользователю только безопасный manual handoff или локализованный blocker.
 */
export class HarnessAgentDispatcher implements AgentDispatcher {
  private readonly output = vscode.window.createOutputChannel('Harness');

  async invoke(ctx: AgentInvocationContext): Promise<AgentInvocationResult> {
    const i18n = getI18nService();
    try {
      const metadata = canonicalCommandMetadata(ctx.protocolName);
      if (!metadata) {
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
      const label = manualHandoffLabel(metadata, i18n);
      this.output.show(true);
      // ADR-011: оба UI sink получают один уже безопасный label, а не command
      // с user-controlled free text. Так Output Channel не становится bypass
      // для boundary, который защищает notification ниже.
      this.output.appendLine(label);
      // ADR-010 запрещает automatic lifecycle в MVP. Policy проверяется до
      // handoff, чтобы неподдержанная mutation не выглядела read-only командой.
      return this.manualFallback(label);
    } catch {
      this.output.appendLine('[runtime]');
      return { ok: false, messageKey: 'harness.agent.runtime', params: { message: i18n.t('harness.agent.runtime.generic') } };
    }
  }

  /** ADR-010: manual handoff не передаёт user-controlled text в Output Channel или UI. */
  private manualFallback(label: string): AgentInvocationResult {
    return { ok: false, messageKey: 'harness.agent.manualFallback', params: { message: label } };
  }

  dispose(): void {
    this.output.dispose();
  }
}

/**
 * ADR-011 разрешает exact command, только когда ни один CTS segment не несёт
 * free text. Metadata берётся из CTS целиком, поэтому chain не обходит
 * never-echo boundary через text-command в позднем segment.
 */
export function manualHandoffLabel(metadata: NonNullable<ReturnType<typeof canonicalCommandMetadata>>, i18n: I18nService): string {
  return !metadata.hasFreeText
    ? metadata.command
    : i18n.t('harness.agent.manualHandoff.textCommand', { command: metadata.family });
}

export type { AgentDispatcher, AgentInvocationContext, AgentInvocationResult } from './types';
