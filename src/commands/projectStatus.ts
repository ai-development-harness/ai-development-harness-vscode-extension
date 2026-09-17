import type { I18nService } from '../locales/activation';
import { StepData } from '../parser/types';

/**
 * Чистая агрегация для `STATUS PROJECT` (§14 `EXECUTION_PROTOCOL.md`).
 * `formatStatusSummary` принимает `I18nService` только как параметр (type-only
 * import — elided в компиляции), сам модуль не импортирует `vscode`.
 */

export interface ProjectStatusSummary {
  readonly byStatus: Record<string, StepData[]>;
  readonly blocked: { step: StepData }[];
  readonly unmetDependency: { step: StepData; blockingStepId: string }[];
}

const DONE_STATUS = 'Выполнено';
const BLOCKED_STATUS = 'Заблокировано';

export function computeProjectStatus(steps: StepData[]): ProjectStatusSummary {
  const byStatus: Record<string, StepData[]> = {};
  for (const step of steps) {
    (byStatus[step.status] ??= []).push(step);
  }

  const blocked = (byStatus[BLOCKED_STATUS] ?? []).map((step) => ({ step }));

  const byId = new Map(steps.map((step) => [step.id, step] as const));
  const unmetDependency: { step: StepData; blockingStepId: string }[] = [];
  for (const step of steps) {
    for (const depId of step.dependsOn) {
      const dep = byId.get(depId);
      // FIX STEP-005 (F-001): нерезолвленная зависимость (файла нет вовсе) —
      // тоже блокер, не пропуск; см. preDispatch.ts checkHardDependencies.
      if (!dep || dep.status !== DONE_STATUS) {
        unmetDependency.push({ step, blockingStepId: depId });
        break;
      }
    }
  }

  return { byStatus, blocked, unmetDependency };
}

export function formatStatusSummary(summary: ProjectStatusSummary, i18n: I18nService): string {
  const counts = Object.entries(summary.byStatus)
    .map(([status, steps]) => `${status}: ${steps.length}`)
    .join(' · ');
  const parts = [counts.length > 0 ? counts : i18n.t('harness.status.empty')];
  if (summary.blocked.length > 0) {
    parts.push(
      i18n.t('harness.status.blockedSuffix', {
        steps: summary.blocked.map((b) => b.step.id).join(', '),
      })
    );
  }
  if (summary.unmetDependency.length > 0) {
    parts.push(
      i18n.t('harness.status.unmetSuffix', {
        steps: summary.unmetDependency.map((u) => u.step.id).join(', '),
      })
    );
  }
  return parts.join(' — ');
}
