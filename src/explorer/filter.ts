import { StepData } from '../parser/types';

/**
 * REQ-002: комбинируемые фильтры Sidebar Explorer. AND между измерениями
 * (Status/Type/Priority/Risk flags), OR внутри измерения; пустой массив
 * измерения = «не фильтровать». `query` — регистронезависимый подстрочный
 * матч по ID, применяется отдельно ко всем ID-несущим узлам (`step`/`req`/`adr`).
 * Status/Type/Priority/Risk flags — поля STEP, применяются только к группе
 * `Tasks` (у REQ несовместимый набор статусов).
 */
export interface FilterState {
  statuses: string[];
  types: string[];
  priorities: string[];
  riskFlags: string[];
  query: string;
}

export const EMPTY_FILTER_STATE: FilterState = {
  statuses: [],
  types: [],
  priorities: [],
  riskFlags: [],
  query: '',
};

export function hasActiveFilters(state: FilterState): boolean {
  return (
    state.statuses.length > 0 ||
    state.types.length > 0 ||
    state.priorities.length > 0 ||
    state.riskFlags.length > 0 ||
    state.query.trim().length > 0
  );
}

function matchesDimension(selected: string[], value: string): boolean {
  return selected.length === 0 || selected.includes(value);
}

function matchesAnyRiskFlag(selected: string[], values: string[]): boolean {
  return selected.length === 0 || selected.some((flag) => values.includes(flag));
}

export function matchesIdQuery(query: string, id: string): boolean {
  const q = query.trim().toLowerCase();
  return q.length === 0 || id.toLowerCase().includes(q);
}

export function applyStepFilters(steps: StepData[], state: FilterState): StepData[] {
  return steps.filter(
    (step) =>
      matchesDimension(state.statuses, step.status) &&
      matchesDimension(state.types, step.type) &&
      matchesDimension(state.priorities, step.priority) &&
      matchesAnyRiskFlag(state.riskFlags, step.riskFlags) &&
      matchesIdQuery(state.query, step.id)
  );
}

/** Собирает фактически встреченные приоритеты STEP: протокол их не перечисляет (см. Implementation plan п.5). */
export function collectPriorities(steps: StepData[]): string[] {
  const seen = new Set<string>();
  for (const step of steps) {
    if (step.priority) seen.add(step.priority);
  }
  return [...seen].sort();
}
