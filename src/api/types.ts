import type { ManifestData, StepData } from '../parser/types';

export interface AgentInvocationContext {
  /** Каноническая команда CTS, уже с подставленным target/free text. */
  readonly protocolName: string;
  readonly workspaceRoot: string;
  readonly manifest: ManifestData;
  readonly targetStep?: StepData;
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
