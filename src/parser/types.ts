/**
 * Общие типы Parser layer (ADR-001, ADR-002).
 * Ожидаемые ошибки (нет манифеста, битый YAML, нераспознанная секция) —
 * значения `Result`, не исключения: явная ошибка вместо падения/угадывания.
 */

export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

/** Нераспознанное/пустое необязательное поле — не блокирует результат. */
export interface ParseWarning {
  field: string;
  reason: string;
}

// ---------------------------------------------------------------------------
// Manifest (.harness/manifest.yaml) — ADR-001 / STEP-024
// ---------------------------------------------------------------------------

export interface HarnessManifestInfo {
  version: string;
  release: string;
}

export interface ProjectManifestInfo {
  initialized: boolean;
  name: string | null;
  initializedAt: string | null;
}

export interface LanguageManifestInfo {
  default: string;
  agentResponses: string;
  documentation: string;
  commitMessages: string;
  codeComments: string;
  testNames: string;
  fixtures: string;
  githubTemplates: string;
  releaseNotes: string;
}

export interface SourcesManifestInfo {
  localBrief: string;
  projectOverview: string;
  requirements: string;
  architecture: string;
  roadmap: string;
  status: string;
}

export interface ProtocolManifestInfo {
  file: string;
  taskDirectory: string;
  reviewDirectory: string;
  auditDirectory: string;
  skillSearchDirectory: string;
  skillRegistry: string;
  harnessUpdateDirectory: string;
}

export interface RepositoryManifestInfo {
  gitPolicy: string;
  harnessPolicy: string;
  harnessUpdatePolicy: string;
  harnessLock: string;
  harnessValidation: string;
  harnessCI: string;
}

export interface ManifestData {
  harness: HarnessManifestInfo;
  project: ProjectManifestInfo;
  language: LanguageManifestInfo;
  sources: SourcesManifestInfo;
  protocol: ProtocolManifestInfo;
  repository: RepositoryManifestInfo;
}

export type ManifestError =
  | { kind: 'not-found'; path: string }
  | { kind: 'invalid-yaml'; path: string; message: string }
  | { kind: 'missing-field'; path: string; field: string };

// ---------------------------------------------------------------------------
// STEP/REQ/ADR labeled markdown — ADR-002
// ---------------------------------------------------------------------------

export type MarkdownParseError =
  | { kind: 'empty-content' }
  | { kind: 'missing-heading' }
  | { kind: 'missing-table' }
  | { kind: 'multiple-headings' };

export interface StepMutationPolicy {
  allowed: string[];
  conditional: string[];
  forbidden: string[];
}

export interface StepImplementationPlan {
  status: string;
  revision: string;
  plannedAt: string;
  body: string;
}

export interface StepReviewStatus {
  latestVerdict: string;
  latestReport: string;
}

export interface StepData {
  id: string;
  title: string;
  status: string;
  type: string;
  priority: string;
  phase: string;
  dependsOn: string[];
  requirements: string[];
  adr: string[];
  riskFlags: string[];
  goal: string;
  context: string;
  scope: string[];
  mutationPolicy: StepMutationPolicy;
  outOfScope: string[];
  acceptanceCriteria: string[];
  verification: string[];
  deliverables: string[];
  implementationPlan: StepImplementationPlan;
  evidence: string;
  reviewStatus: StepReviewStatus;
  blocker: string;
}

export interface ReqTraceability {
  step: string[];
  adr: string[];
}

export interface ReqData {
  id: string;
  title: string;
  priority: string;
  source: string;
  requirement: string;
  rationale: string;
  acceptance: string[];
  traceability: ReqTraceability;
}

/**
 * Строка таблицы `docs/requirements/STATUS.md` — единственный canonical
 * источник lifecycle-статуса REQ (`AGENTS.md` §10). Отдельный тип от `ReqData`
 * (который остаётся «разобранное из `SPEC.md`»), чтобы не смешивать источники.
 */
export interface ReqStatusEntry {
  id: string;
  title: string;
  status: string;
  steps: string[];
  evidence: string;
}

export interface AdrAlternative {
  title: string;
  body: string;
}

export interface AdrTraceability {
  req: string[];
  step: string[];
}

export interface AdrData {
  id: string;
  title: string;
  status: string;
  date: string;
  deciders: string;
  supersedes: string;
  supersededBy: string;
  context: string;
  problem: string;
  decision: string;
  alternativesConsidered: AdrAlternative[];
  consequences: string;
  securityImplications: string;
  dataMigrationImplications: string;
  compatibilityImplications: string;
  traceability: AdrTraceability;
}

// ---------------------------------------------------------------------------
// planning/EXECUTION_PROTOCOL.md
// ---------------------------------------------------------------------------

export interface ExecutionProtocolCommand {
  name: string;
  sectionTitle: string;
}

export interface ExecutionProtocolData {
  stepTypes: string[];
  stepStatuses: string[];
  requiredStepFields: string[];
  riskFlags: string[];
  commands: ExecutionProtocolCommand[];
}
