import { StepData, ManifestData } from '../parser/types';

/**
 * REQ-001/ADR-003: чистый pre-dispatch слой, без импорта `vscode` — тот же
 * приём, что и `i18n.ts` в STEP-004 (vscode-обёртка живёт отдельно, в
 * `activation.ts`), чтобы pre-dispatch правила были напрямую тестируемы в
 * Jest без мока `vscode`.
 */

export type InitGuard = 'require-initialized' | 'require-uninitialized' | 'none';

export type ValidationResult =
  | { ok: true }
  | { ok: false; messageKey: string; params?: Record<string, string> };

const OK: ValidationResult = { ok: true };

export function checkInitGuard(manifest: ManifestData, guard: InitGuard): ValidationResult {
  if (guard === 'require-initialized' && !manifest.project.initialized) {
    return { ok: false, messageKey: 'harness.error.notInitialized' };
  }
  if (guard === 'require-uninitialized' && manifest.project.initialized) {
    return { ok: false, messageKey: 'harness.error.alreadyInitialized' };
  }
  return OK;
}

/**
 * FIX STEP-005 (F-001, REVIEW-2026-09-17T2330): зависимость, для которой не
 * нашлось STEP-файла (опечатка в `Depends on`, ещё не созданный corrective
 * STEP, переименованный/удалённый файл), — это НЕ отсутствие блокера, а
 * неверифицируемый hard dependency: fail-closed, не fail-open. Поэтому вход —
 * полный `dependsOn` целевого STEP, а не уже отфильтрованный список найденных
 * зависимостей (последний давал бы `{ok: true}` на пустом результате
 * `resolveDependencySteps`, молча теряя нерезолвленные id).
 */
export function checkHardDependencies(dependsOn: string[], dependencySteps: StepData[]): ValidationResult {
  const byId = new Map(dependencySteps.map((step) => [step.id, step] as const));
  for (const depId of dependsOn) {
    const dep = byId.get(depId);
    if (!dep) {
      return { ok: false, messageKey: 'harness.error.missingDependency', params: { step: depId } };
    }
    if (dep.status !== 'Выполнено') {
      return { ok: false, messageKey: 'harness.error.unmetDependency', params: { step: dep.id } };
    }
  }
  return OK;
}

const TERMINAL_STATUSES = new Set(['Отменено', 'Заменено']);
const IMPLEMENTABLE_TYPES = new Set([
  'IMPLEMENTATION',
  'BUGFIX',
  'REFACTOR',
  'HARDENING',
  'DOCUMENTATION',
  'RELEASE',
]);

/**
 * Только текстуально обоснованные `planning/EXECUTION_PROTOCOL.md` правила
 * (§3/§9/§11/§25). Сознательно не проверяется, попадают ли файлы, которые
 * тронет агент, в Mutation policy Allowed целевого STEP: на этапе pre-dispatch
 * эти файлы ещё не известны (агент выбирает их во время выполнения) — плагин
 * физически не может проверить это раньше. Не кодировать несуществующую
 * гарантию.
 */
export function checkMutationBoundary(commandId: string, target: StepData): ValidationResult {
  if (TERMINAL_STATUSES.has(target.status)) {
    return {
      ok: false,
      messageKey: 'harness.error.terminalStatus',
      params: { step: target.id, status: target.status },
    };
  }
  if (commandId === 'harness.implement' && !IMPLEMENTABLE_TYPES.has(target.type)) {
    return {
      ok: false,
      messageKey: 'harness.error.implementWrongType',
      params: { step: target.id, type: target.type },
    };
  }
  if (commandId === 'harness.fix' && target.reviewStatus.latestVerdict !== 'FAIL') {
    return { ok: false, messageKey: 'harness.error.fixWithoutFail', params: { step: target.id } };
  }
  return OK;
}

export interface PreDispatchCommand {
  readonly id: string;
  readonly initGuard: InitGuard;
  readonly stepScoped: boolean;
}

export interface PreDispatchContext {
  readonly manifest: ManifestData;
  readonly targetStep?: StepData;
  readonly dependencySteps?: StepData[];
}

/** Композирует INIT guard → hard dependencies → mutation boundary; возвращает первый блок. */
export function runPreDispatchChecks(command: PreDispatchCommand, ctx: PreDispatchContext): ValidationResult {
  const initResult = checkInitGuard(ctx.manifest, command.initGuard);
  if (!initResult.ok) return initResult;

  if (!command.stepScoped) {
    return OK;
  }

  if (!ctx.targetStep) {
    return { ok: false, messageKey: 'harness.error.noTargetStep' };
  }

  const depResult = checkHardDependencies(ctx.targetStep.dependsOn, ctx.dependencySteps ?? []);
  if (!depResult.ok) return depResult;

  return checkMutationBoundary(command.id, ctx.targetStep);
}

/** Резолвит `StepData` каждой hard dependency STEP из уже прочитанного списка всех STEP. */
export function resolveDependencySteps(target: StepData, allSteps: StepData[]): StepData[] {
  const byId = new Map(allSteps.map((step) => [step.id, step] as const));
  const result: StepData[] = [];
  for (const depId of target.dependsOn) {
    const dep = byId.get(depId);
    if (dep) result.push(dep);
  }
  return result;
}
