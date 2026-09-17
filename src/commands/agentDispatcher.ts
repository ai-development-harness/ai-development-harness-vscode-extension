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

export interface AgentInvocationContext {
  readonly protocolName: string;
  readonly workspaceRoot: string;
  readonly stepId?: string;
  readonly freeText?: string;
}

export interface AgentInvocationResult {
  readonly ok: boolean;
  readonly messageKey: string;
  readonly params?: Record<string, string>;
}

export interface AgentDispatcher {
  invoke(ctx: AgentInvocationContext): Promise<AgentInvocationResult>;
}

export class NotImplementedAgentDispatcher implements AgentDispatcher {
  async invoke(ctx: AgentInvocationContext): Promise<AgentInvocationResult> {
    return {
      ok: false,
      messageKey: 'harness.agent.notImplemented',
      params: { command: ctx.protocolName },
    };
  }
}
