import { StepData } from '../parser/types';

/**
 * Чистый слой (без `vscode`) для `STEP NEXT` (§15 `EXECUTION_PROTOCOL.md`).
 */

export interface NextStepResult {
  readonly step: StepData;
  readonly reasonKey: string;
  readonly reasonParams: Record<string, string>;
  readonly suggestedCommandId: string;
}

const PRIORITY_RANK: Record<string, number> = {
  Критический: 0,
  Высокий: 1,
  Средний: 2,
  Низкий: 3,
};

const ACTIONABLE_STATUSES = new Set(['Запланировано', 'В работе']);
const DONE_STATUS = 'Выполнено';

function priorityRank(priority: string): number {
  return PRIORITY_RANK[priority] ?? Number.POSITIVE_INFINITY;
}

function stepNumber(id: string): number {
  const match = /(\d+)/.exec(id);
  return match ? Number(match[1]) : Number.POSITIVE_INFINITY;
}

/**
 * Исключает выполненные/отменённые/заблокированные и STEP с незавершёнными
 * hard dependencies; учитывает priority и roadmap order (номер STEP как proxy
 * для phase/critical path — точный critical-path анализ вне MVP-скоупа
 * STEP-005, не выдумывается).
 */
export function selectNextStep(steps: StepData[]): NextStepResult | undefined {
  const byId = new Map(steps.map((step) => [step.id, step] as const));

  const candidates = steps.filter((step) => {
    if (!ACTIONABLE_STATUSES.has(step.status)) return false;
    return step.dependsOn.every((depId) => byId.get(depId)?.status === DONE_STATUS);
  });

  candidates.sort((a, b) => {
    const rankDiff = priorityRank(a.priority) - priorityRank(b.priority);
    return rankDiff !== 0 ? rankDiff : stepNumber(a.id) - stepNumber(b.id);
  });

  const step = candidates[0];
  if (!step) return undefined;

  if (step.implementationPlan.status !== 'Planned') {
    return {
      step,
      reasonKey: 'harness.nextStep.reason.needsPlan',
      reasonParams: { step: step.id },
      suggestedCommandId: 'harness.plan',
    };
  }
  if (step.reviewStatus.latestVerdict === 'FAIL') {
    return {
      step,
      reasonKey: 'harness.nextStep.reason.needsFix',
      reasonParams: { step: step.id },
      suggestedCommandId: 'harness.fix',
    };
  }
  return {
    step,
    reasonKey: 'harness.nextStep.reason.needsImplement',
    reasonParams: { step: step.id },
    suggestedCommandId: 'harness.implement',
  };
}
