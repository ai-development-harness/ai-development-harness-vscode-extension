import { ValidationResult } from '../commands/preDispatch';
import { AdrData, ReqData, StepData } from '../parser/types';

/**
 * REQ-002 Implementation plan п.7: переиспользует `ValidationResult` из
 * `src/commands/preDispatch.ts` (Mutation policy → Forbidden: не дублировать
 * pre-dispatch валидацию), добавляя только специфичные для мутирующих
 * действий дерева проверки.
 */
const OK: ValidationResult = { ok: true };

/**
 * FIX STEP-006 (2-й проход, F-016): единственный набор терминальных статусов
 * внутри `src/explorer/**`, экспортируется и переиспользуется в
 * `treeItem.ts` — до этого прохода тот же список был продублирован инлайн в
 * `treeItem.ts:48`. Полная дедупликация с третьей копией
 * (`src/commands/preDispatch.ts`) вне scope этого STEP (см. Evidence),
 * остаётся отдельным поводом (F-008).
 */
export const TERMINAL_STATUSES = new Set(['Отменено', 'Заменено']);

/**
 * `Выполнено` разрешено только при `reviewStatus.latestVerdict === 'PASS'` и
 * непустом `evidence` — прямое следствие §3 протокола и `AGENTS.md` §8/§11:
 * однокликовое «Mark as done» в обход review было бы обходом deterministic
 * gate.
 */
export function canMarkDone(step: StepData): ValidationResult {
  if (step.reviewStatus.latestVerdict !== 'PASS') {
    return { ok: false, messageKey: 'harness.explorer.error.markDoneNoPass', params: { step: step.id } };
  }
  if (step.evidence.trim().length === 0) {
    return { ok: false, messageKey: 'harness.explorer.error.markDoneNoEvidence', params: { step: step.id } };
  }
  return OK;
}

/** Запрещено для терминальных статусов (`Отменено`/`Заменено`), требует непустого текста причины. */
export function canFlagBlocker(step: StepData, reasonText: string): ValidationResult {
  if (TERMINAL_STATUSES.has(step.status)) {
    return {
      ok: false,
      messageKey: 'harness.explorer.error.flagBlockerTerminal',
      params: { step: step.id, status: step.status },
    };
  }
  if (reasonText.trim().length === 0) {
    return { ok: false, messageKey: 'harness.explorer.error.flagBlockerEmptyReason', params: { step: step.id } };
  }
  return OK;
}

/**
 * Удаление запрещено, если на артефакт есть входящие ссылки (`Depends on`
 * других STEP, traceability REQ/ADR). Основание — §1 протокола: ID стабилен и
 * не переиспользуется; тихое удаление порождает dangling-ссылки (тот же класс
 * дефектов, что закрывал `FIX STEP-005 F-001`).
 *
 * FIX STEP-006 (F-004): Implementation plan п.7 требовал traceability REQ/ADR,
 * но реализация проверяла только REQ — `allAdrs` добавлен, чтобы STEP,
 * упомянутый лишь в `## Traceability` какого-то ADR, тоже блокировал удаление.
 */
export function canDelete(targetId: string, allSteps: StepData[], allReqs: ReqData[], allAdrs: AdrData[]): ValidationResult {
  const referencingSteps = allSteps.filter((s) => s.id !== targetId && s.dependsOn.includes(targetId)).map((s) => s.id);
  const referencingReqs = allReqs.filter((r) => r.traceability.step.includes(targetId)).map((r) => r.id);
  const referencingAdrs = allAdrs.filter((a) => a.traceability.step.includes(targetId)).map((a) => a.id);
  const refs = [...referencingSteps, ...referencingReqs, ...referencingAdrs];
  if (refs.length > 0) {
    return {
      ok: false,
      messageKey: 'harness.explorer.error.deleteHasReferences',
      params: { step: targetId, refs: refs.join(', ') },
    };
  }
  return OK;
}
