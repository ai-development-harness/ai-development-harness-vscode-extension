import { StepData } from '../../../src/parser/types';
import { EMPTY_FILTER_STATE, applyStepFilters, collectPriorities, hasActiveFilters, matchesIdQuery } from '../../../src/explorer/filter';

function step(overrides: Partial<StepData>): StepData {
  return {
    id: 'STEP-000',
    title: 't',
    status: 'Запланировано',
    type: 'IMPLEMENTATION',
    priority: 'Средний',
    phase: 'p',
    dependsOn: [],
    requirements: [],
    adr: [],
    riskFlags: [],
    goal: '',
    context: '',
    scope: [],
    mutationPolicy: { allowed: [], conditional: [], forbidden: [] },
    outOfScope: [],
    acceptanceCriteria: [],
    verification: [],
    deliverables: [],
    implementationPlan: { status: '', revision: '', plannedAt: '', body: '' },
    evidence: '',
    reviewStatus: { latestVerdict: '', latestReport: '' },
    blocker: '',
    ...overrides,
  };
}

const steps: StepData[] = [
  step({ id: 'STEP-001', status: 'Выполнено', type: 'IMPLEMENTATION', priority: 'Высокий', riskFlags: ['security-sensitive'] }),
  step({ id: 'STEP-002', status: 'В работе', type: 'BUGFIX', priority: 'Средний', riskFlags: [] }),
  step({ id: 'STEP-003', status: 'Заблокировано', type: 'IMPLEMENTATION', priority: 'Низкий', riskFlags: ['destructive'] }),
];

describe('applyStepFilters', () => {
  it('пустой фильтр не меняет список', () => {
    expect(applyStepFilters(steps, EMPTY_FILTER_STATE)).toEqual(steps);
  });

  it('фильтрует по одному измерению (Status)', () => {
    const result = applyStepFilters(steps, { ...EMPTY_FILTER_STATE, statuses: ['Выполнено'] });
    expect(result.map((s) => s.id)).toEqual(['STEP-001']);
  });

  it('OR внутри измерения (несколько статусов)', () => {
    const result = applyStepFilters(steps, { ...EMPTY_FILTER_STATE, statuses: ['Выполнено', 'В работе'] });
    expect(result.map((s) => s.id)).toEqual(['STEP-001', 'STEP-002']);
  });

  it('AND между измерениями + поиск по ID — комбинируются одновременно (Acceptance REQ-002)', () => {
    const result = applyStepFilters(steps, {
      statuses: ['Выполнено'],
      types: ['IMPLEMENTATION'],
      priorities: ['Высокий'],
      riskFlags: ['security-sensitive'],
      query: '001',
    });
    expect(result.map((s) => s.id)).toEqual(['STEP-001']);
  });

  it('несовпадающая комбинация даёт пустой результат', () => {
    const result = applyStepFilters(steps, { ...EMPTY_FILTER_STATE, statuses: ['Выполнено'], types: ['BUGFIX'] });
    expect(result).toEqual([]);
  });

  it('неизвестное значение приоритета не роняет фильтрацию, просто ничего не даёт', () => {
    const result = applyStepFilters(steps, { ...EMPTY_FILTER_STATE, priorities: ['Несуществующий'] });
    expect(result).toEqual([]);
  });
});

describe('matchesIdQuery', () => {
  it('регистронезависимый подстрочный матч', () => {
    expect(matchesIdQuery('step-001', 'STEP-001')).toBe(true);
    expect(matchesIdQuery('999', 'STEP-001')).toBe(false);
    expect(matchesIdQuery('  ', 'STEP-001')).toBe(true);
  });
});

describe('hasActiveFilters / collectPriorities', () => {
  it('hasActiveFilters отражает наличие хотя бы одного активного измерения', () => {
    expect(hasActiveFilters(EMPTY_FILTER_STATE)).toBe(false);
    expect(hasActiveFilters({ ...EMPTY_FILTER_STATE, query: 'x' })).toBe(true);
  });

  it('collectPriorities строит список из фактически встреченных значений, не хардкода', () => {
    expect(collectPriorities(steps)).toEqual(['Высокий', 'Низкий', 'Средний']);
  });
});
