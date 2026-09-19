import type { ManifestData, StepData } from '../parser/types';
import type { GitSnapshot } from '../git/gitHelper';

export interface AgentInvocationContext {
  /** Каноническая команда CTS, уже с подставленным target/free text. */
  readonly protocolName: string;
  readonly workspaceRoot: string;
  readonly manifest: ManifestData;
  readonly targetStep?: StepData;
  readonly freeText?: string;
}

export interface WriteInvocationPolicy {
  readonly requiresWrite: boolean;
  readonly command: string;
  readonly allowedPaths: readonly string[];
}

export interface AgentInvocationResult {
  readonly ok: boolean;
  readonly messageKey: string;
  readonly params?: Record<string, string>;
  readonly nextCommand?: string;
  readonly changedFiles?: readonly string[];
}

export interface AgentContextBundle {
  readonly prompt: string;
  readonly git: GitSnapshot;
  readonly artifactPaths: readonly string[];
}

export type AgentErrorKind = 'pre-validation' | 'unavailable' | 'spawn' | 'agent' | 'malformed' | 'too-large' | 'cancelled';

export interface ExecutorResult {
  readonly ok: boolean;
  readonly cancelled?: boolean;
  readonly summary?: string;
  readonly changedFiles?: readonly string[];
  readonly nextCommand?: string;
  readonly errorKind?: AgentErrorKind;
  readonly message?: string;
}

export interface AgentDispatcher {
  invoke(ctx: AgentInvocationContext): Promise<AgentInvocationResult>;
  cancel(): void;
}
