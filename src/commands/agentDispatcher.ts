/**
 * ADR-004 п.4: один интерфейс адаптера вызова агента, реализации подставляются
 * позже. Реальная реализация (Codex/Claude headless CLI) — STEP-009
 * (`src/api/**`), которого ещё не существует. До неё команды pre-dispatch-
 * валидны и зарегистрированы, но фактический вызов агента не реализован —
 * явная, не молчаливая деградация (`NotImplementedAgentDispatcher`).
 *
 * Единственная точка использования — `activation.ts`; STEP-009 переносит
 * интерфейс в `src/api/**` и подставляет реальную реализацию там, не меняя
 * ни один из 11 файлов команд (см. ADR-003 требование «одна точка регистрации»).
 */

import type { AgentDispatcher, AgentInvocationContext, AgentInvocationResult } from '../api/types';

export type { AgentDispatcher, AgentInvocationContext, AgentInvocationResult } from '../api/types';

export class NotImplementedAgentDispatcher implements AgentDispatcher {
  cancel(): void {}

  async invoke(ctx: AgentInvocationContext): Promise<AgentInvocationResult> {
    return {
      ok: false,
      messageKey: 'harness.agent.notImplemented',
      params: { command: ctx.protocolName },
    };
  }
}
