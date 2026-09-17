import * as fs from 'node:fs';
import * as path from 'node:path';
import { parseAdrFile, parseReqSpec, parseStepFile } from '../../../src/parser/markdownParser';

const TASKS = path.join(__dirname, '..', '..', 'fixtures', 'tasks');
const REQUIREMENTS = path.join(__dirname, '..', '..', 'fixtures', 'requirements');
const ADR = path.join(__dirname, '..', '..', 'fixtures', 'adr');

function read(filePath: string): string {
  return fs.readFileSync(filePath, 'utf8');
}

describe('parseStepFile', () => {
  it('извлекает все поля реального STEP-002.md (Выполнено, без зависимостей)', () => {
    const result = parseStepFile(read(path.join(TASKS, 'STEP-002.md')));
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const { data, warnings } = result.value;
    expect(data.id).toBe('STEP-002');
    expect(data.title).toBe('Project scaffolding и инструментарий');
    expect(data.status).toBe('Выполнено');
    expect(data.type).toBe('IMPLEMENTATION');
    expect(data.priority).toBe('Критический');
    expect(data.phase).toBe('MVP — фундамент');
    expect(data.dependsOn).toEqual([]);
    expect(data.requirements).toEqual([]);
    expect(data.adr).toEqual([]);
    expect(data.riskFlags).toEqual(['none']);
    expect(data.goal).toContain('рабочий скелет');
    expect(data.scope.length).toBeGreaterThan(0);
    expect(data.mutationPolicy.allowed).toEqual(['Создание нового tooling/config в корне и `src/`.']);
    expect(data.mutationPolicy.forbidden.length).toBe(1);
    expect(data.acceptanceCriteria.length).toBe(4);
    expect(data.implementationPlan.status).toBe('Planned');
    expect(data.implementationPlan.revision).toBe('1');
    expect(data.implementationPlan.body).toContain('Проверенные');
    expect(data.reviewStatus.latestVerdict).toBe('PASS');
    expect(data.reviewStatus.latestReport).toBe('`planning/reviews/STEP-002/REVIEW-2026-09-17T1752.md`');
    expect(data.blocker).toContain('Оба review-цикла пройдены');
    expect(warnings).toEqual([]);
  });

  it('извлекает все поля реального planning/tasks/TEMPLATE.md без warnings по обязательным секциям', () => {
    const result = parseStepFile(read(path.join(TASKS, 'TEMPLATE.md')));
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const { data, warnings } = result.value;
    expect(data.id).toBe('STEP-NNN');
    expect(data.title).toBe('Название');
    expect(data.status).toBe('Запланировано');
    expect(data.goal.length).toBeGreaterThan(0);
    expect(data.context.length).toBeGreaterThan(0);
    expect(data.scope.length).toBeGreaterThan(0);
    expect(data.mutationPolicy.allowed).toEqual(['TBD']);
    expect(data.mutationPolicy.conditional).toEqual(['TBD']);
    expect(data.mutationPolicy.forbidden).toEqual(['unrelated scope']);
    expect(data.acceptanceCriteria.length).toBe(2);
    expect(data.implementationPlan.status).toBe('Not planned');
    expect(data.reviewStatus.latestVerdict).toBe('NOT REVIEWED');
    // Все секции протокола (раздел 4 EXECUTION_PROTOCOL.md) присутствуют в реальном шаблоне.
    expect(warnings).toEqual([]);
  });

  it('деградирует (warnings, не exception) на синтетическом STEP с пустым Goal и отсутствующей секцией ADR', () => {
    const result = parseStepFile(read(path.join(TASKS, 'STEP-malformed.md')));
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const { data, warnings } = result.value;
    expect(data.id).toBe('STEP-999');
    expect(data.goal).toBe('');
    expect(data.adr).toEqual([]);
    expect(data.mutationPolicy.conditional).toEqual([]);

    const warningFields = warnings.map((w) => w.field);
    expect(warningFields).toContain('adr');
    expect(warningFields).toContain('dependsOn');
    expect(warningFields).toContain('mutationPolicy.conditional');
  });

  it('деградирует (warnings, не exception) на STEP без root-меток и без секций Goal/Context/Mutation policy/Implementation plan/Evidence/Review status/Blocker целиком', () => {
    const result = parseStepFile(read(path.join(TASKS, 'STEP-malformed-2.md')));
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const { data, warnings } = result.value;
    expect(data.id).toBe('STEP-998');
    expect(data.status).toBe('');
    expect(data.type).toBe('');
    expect(data.priority).toBe('');
    expect(data.phase).toBe('');
    expect(data.dependsOn).toEqual([]);
    expect(data.goal).toBe('');
    expect(data.context).toBe('');
    expect(data.mutationPolicy).toEqual({ allowed: [], conditional: [], forbidden: [] });
    expect(data.implementationPlan).toEqual({ status: '', revision: '', plannedAt: '', body: '' });
    expect(data.evidence).toBe('');
    expect(data.reviewStatus).toEqual({ latestVerdict: '', latestReport: '' });
    expect(data.blocker).toBe('');
    // Секции, которые реально присутствуют в fixture, извлекаются штатно, не деградируют.
    expect(data.requirements).toEqual(['REQ-001']);
    expect(data.scope).toEqual(['test scope item']);

    const warningFields = warnings.map((w) => w.field);
    for (const field of ['status', 'type', 'priority', 'phase', 'dependsOn', 'Goal', 'Context', 'mutationPolicy', 'implementationPlan', 'Evidence', 'reviewStatus', 'Blocker / Failure reason']) {
      expect(warningFields).toContain(field);
    }
  });

  it('даёт явную ParseError на пустой контент, не exception', () => {
    const result = parseStepFile('');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('empty-content');
  });

  it('даёт явную ParseError, если в контенте нет заголовков', () => {
    const result = parseStepFile('просто текст без заголовков markdown');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('missing-heading');
  });
});

describe('parseReqSpec', () => {
  it('извлекает все REQ-001..010 из реального docs/requirements/SPEC.md', () => {
    const result = parseReqSpec(read(path.join(REQUIREMENTS, 'SPEC.md')));
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const { data, warnings } = result.value;
    expect(data.map((r) => r.id)).toEqual([
      'REQ-001',
      'REQ-002',
      'REQ-003',
      'REQ-004',
      'REQ-005',
      'REQ-006',
      'REQ-007',
      'REQ-008',
      'REQ-009',
      'REQ-010',
    ]);

    const req001 = data.find((r) => r.id === 'REQ-001')!;
    expect(req001.title).toBe('Command Palette с канонической командной поверхностью');
    expect(req001.status).toBe('Запланировано');
    expect(req001.priority).toBe('Критический');
    expect(req001.source).toBe('brief');
    expect(req001.requirement).toContain('11 MVP-команд');
    expect(req001.acceptance.length).toBe(4);
    expect(req001.traceability.step).toEqual(['STEP-005']);
    expect(req001.traceability.adr).toEqual(['ADR-003']);

    const req003 = data.find((r) => r.id === 'REQ-003')!;
    expect(req003.traceability.adr).toEqual(['ADR-002']);

    const req007 = data.find((r) => r.id === 'REQ-007')!;
    expect(req007.status).toBe('Отложено');
    expect(req007.traceability.step).toEqual([]);

    expect(warnings).toEqual([]);
  });

  it('извлекает поля из реального docs/requirements/TEMPLATE.md', () => {
    const result = parseReqSpec(read(path.join(REQUIREMENTS, 'TEMPLATE.md')));
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.data.length).toBe(1);
    expect(result.value.data[0].id).toBe('REQ-NNN');
    expect(result.value.warnings).toEqual([]);
  });

  it('деградирует (warnings, не exception) на REQ-блоке без Статус/Источник/Rationale/Traceability', () => {
    const content = [
      '# Requirements Specification',
      '',
      '## Требования',
      '',
      '### REQ-777 — Синтетический REQ без Rationale и Traceability',
      '',
      '**Приоритет:** Средний',
      '',
      '#### Requirement',
      '',
      'Текст requirement.',
      '',
      '#### Acceptance',
      '',
      '- test',
      '',
    ].join('\n');

    const result = parseReqSpec(content);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const { data, warnings } = result.value;
    expect(data.length).toBe(1);
    const req = data[0];
    expect(req.id).toBe('REQ-777');
    expect(req.status).toBe('');
    expect(req.source).toBe('');
    expect(req.priority).toBe('Средний');
    expect(req.rationale).toBe('');
    expect(req.requirement).toContain('Текст requirement.');
    expect(req.acceptance).toEqual(['test']);
    expect(req.traceability).toEqual({ step: [], adr: [] });

    const warningFields = warnings.map((w) => w.field);
    expect(warningFields).toContain('REQ-777.status');
    expect(warningFields).toContain('REQ-777.source');
    expect(warningFields).toContain('REQ-777.rationale');
    expect(warningFields).toContain('REQ-777.traceability');
    expect(warningFields).not.toContain('REQ-777.priority');
    expect(warningFields).not.toContain('REQ-777.requirement');
    expect(warningFields).not.toContain('REQ-777.acceptance');
  });

  it('даёт явную ParseError, если ни один REQ-заголовок не найден', () => {
    const result = parseReqSpec('# Просто заголовок без REQ');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('missing-heading');
  });
});

describe('parseAdrFile', () => {
  it('извлекает все поля реального ADR-001-manifest-driven-paths.md', () => {
    const result = parseAdrFile(read(path.join(ADR, 'ADR-001-manifest-driven-paths.md')));
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const { data, warnings } = result.value;
    expect(data.id).toBe('ADR-001');
    expect(data.title).toBe('Все пути протокола читаются из `.project/manifest.yaml`, а не хардкодятся');
    expect(data.status).toBe('Accepted');
    expect(data.date).toBe('2026-09-17');
    expect(data.deciders).toBe('initializer (INIT PROJECT)');
    expect(data.supersedes).toBe('—');
    expect(data.context.length).toBeGreaterThan(0);
    expect(data.problem.length).toBeGreaterThan(0);
    expect(data.decision.length).toBeGreaterThan(0);
    expect(data.alternativesConsidered.length).toBe(2);
    expect(data.alternativesConsidered[0].title).toBe('Вариант A — хардкод стандартных путей (как в исходном ТЗ)');
    expect(data.securityImplications).toBe('Не применимо.');
    expect(data.traceability.req).toEqual(['REQ-001', 'REQ-002', 'REQ-003']);
    expect(data.traceability.step).toEqual(['STEP-003']);
    expect(warnings).toEqual([]);
  });

  it('извлекает поля реального ADR-002-step-file-format.md (traceability с двумя STEP)', () => {
    const result = parseAdrFile(read(path.join(ADR, 'ADR-002-step-file-format.md')));
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.data.traceability.req).toEqual(['REQ-003']);
    expect(result.value.data.traceability.step).toEqual(['STEP-003', 'STEP-007']);
    expect(result.value.warnings).toEqual([]);
  });

  it('извлекает поля реального docs/adr/TEMPLATE.md', () => {
    const result = parseAdrFile(read(path.join(ADR, 'TEMPLATE.md')));
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.data.id).toBe('ADR-NNN');
    expect(result.value.data.status).toBe('Proposed');
    expect(result.value.data.alternativesConsidered.length).toBe(2);
    expect(result.value.warnings).toEqual([]);
  });

  it('деградирует (warnings, не exception) на синтетическом ADR без root-меток, Alternatives considered и Traceability', () => {
    const result = parseAdrFile(read(path.join(ADR, 'ADR-malformed.md')));
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const { data, warnings } = result.value;
    expect(data.id).toBe('ADR-999');
    expect(data.status).toBe('');
    expect(data.date).toBe('');
    expect(data.deciders).toBe('');
    expect(data.supersedes).toBe('');
    expect(data.supersededBy).toBe('');
    expect(data.alternativesConsidered).toEqual([]);
    expect(data.traceability).toEqual({ req: [], step: [] });
    // Секции, которые реально присутствуют в fixture, извлекаются штатно.
    expect(data.context.length).toBeGreaterThan(0);
    expect(data.decision.length).toBeGreaterThan(0);

    const warningFields = warnings.map((w) => w.field);
    for (const field of ['status', 'date', 'deciders', 'supersedes', 'supersededBy', 'alternativesConsidered', 'traceability']) {
      expect(warningFields).toContain(field);
    }
  });

  it('даёт явную ParseError на пустой контент, не exception', () => {
    const result = parseAdrFile('   ');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('empty-content');
  });
});
