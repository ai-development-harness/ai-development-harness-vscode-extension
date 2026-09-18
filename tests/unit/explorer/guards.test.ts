import { AdrData, ReqData, StepData } from '../../../src/parser/types';
import { canDelete, canFlagBlocker, canMarkDone } from '../../../src/explorer/guards';

function step(overrides: Partial<StepData>): StepData {
  return {
    id: 'STEP-001',
    title: 't',
    status: 'В работе',
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

function adr(overrides: Partial<AdrData>): AdrData {
  return {
    id: 'ADR-001',
    title: 't',
    status: 'Accepted',
    date: '',
    deciders: '',
    supersedes: '',
    supersededBy: '',
    context: '',
    problem: '',
    decision: '',
    alternativesConsidered: [],
    consequences: '',
    securityImplications: '',
    dataMigrationImplications: '',
    compatibilityImplications: '',
    traceability: { req: [], step: [] },
    ...overrides,
  };
}

function req(overrides: Partial<ReqData>): ReqData {
  return {
    id: 'REQ-001',
    title: 't',
    status: 'Запланировано',
    priority: 'Средний',
    source: 'brief',
    requirement: '',
    rationale: '',
    acceptance: [],
    traceability: { step: [], adr: [] },
    ...overrides,
  };
}

describe('canMarkDone', () => {
  it('блокирует при latestVerdict !== PASS', () => {
    const s = step({ reviewStatus: { latestVerdict: 'NOT REVIEWED', latestReport: '—' }, evidence: 'ok' });
    expect(canMarkDone(s)).toEqual({
      ok: false,
      messageKey: 'harness.explorer.error.markDoneNoPass',
      params: { step: 'STEP-001' },
    });
  });

  it('блокирует при latestVerdict === FAIL', () => {
    const s = step({ reviewStatus: { latestVerdict: 'FAIL', latestReport: 'x' }, evidence: 'ok' });
    expect(canMarkDone(s).ok).toBe(false);
  });

  it('блокирует при пустом evidence, даже если verdict PASS', () => {
    const s = step({ reviewStatus: { latestVerdict: 'PASS', latestReport: 'x' }, evidence: '   ' });
    expect(canMarkDone(s)).toEqual({
      ok: false,
      messageKey: 'harness.explorer.error.markDoneNoEvidence',
      params: { step: 'STEP-001' },
    });
  });

  it('разрешает при PASS + непустом evidence', () => {
    const s = step({ reviewStatus: { latestVerdict: 'PASS', latestReport: 'x' }, evidence: 'доказано' });
    expect(canMarkDone(s)).toEqual({ ok: true });
  });
});

describe('canFlagBlocker', () => {
  it('блокирует терминальные статусы', () => {
    const s = step({ status: 'Отменено' });
    expect(canFlagBlocker(s, 'причина').ok).toBe(false);
    const s2 = step({ status: 'Заменено' });
    expect(canFlagBlocker(s2, 'причина').ok).toBe(false);
  });

  it('блокирует пустую причину', () => {
    const s = step({ status: 'В работе' });
    expect(canFlagBlocker(s, '  ').ok).toBe(false);
  });

  it('разрешает нетерминальный статус с непустой причиной', () => {
    const s = step({ status: 'Запланировано' });
    expect(canFlagBlocker(s, 'ждём внешнюю зависимость')).toEqual({ ok: true });
  });
});

describe('canDelete', () => {
  it('блокирует при входящей Depends on-ссылке другого STEP и перечисляет ссылающийся ID', () => {
    const target = step({ id: 'STEP-001' });
    const referencing = step({ id: 'STEP-002', dependsOn: ['STEP-001'] });
    expect(canDelete('STEP-001', [target, referencing], [], [])).toEqual({
      ok: false,
      messageKey: 'harness.explorer.error.deleteHasReferences',
      params: { step: 'STEP-001', refs: 'STEP-002' },
    });
  });

  it('блокирует при входящей traceability-ссылке REQ', () => {
    const target = step({ id: 'STEP-001' });
    const referencingReq = req({ id: 'REQ-005', traceability: { step: ['STEP-001'], adr: [] } });
    expect(canDelete('STEP-001', [target], [referencingReq], []).ok).toBe(false);
  });

  it('FIX STEP-006 (F-004): блокирует при входящей traceability-ссылке ADR', () => {
    const target = step({ id: 'STEP-001' });
    const referencingAdr = adr({ id: 'ADR-005', traceability: { req: [], step: ['STEP-001'] } });
    expect(canDelete('STEP-001', [target], [], [referencingAdr])).toEqual({
      ok: false,
      messageKey: 'harness.explorer.error.deleteHasReferences',
      params: { step: 'STEP-001', refs: 'ADR-005' },
    });
  });

  it('разрешает удаление без входящих ссылок', () => {
    const target = step({ id: 'STEP-001' });
    expect(canDelete('STEP-001', [target], [], [])).toEqual({ ok: true });
  });
});
