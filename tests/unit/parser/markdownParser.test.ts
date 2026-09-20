import * as fs from 'node:fs';
import * as path from 'node:path';
import { extractTableRows, parseAdrFile, parseReqFile, parseStepFile } from '../../../src/parser/markdownParser';

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

  it('предупреждает о смешанном корректном и повреждённом Depends on', () => {
    const content = read(path.join(TASKS, 'STEP-002.md')).replace('**Depends on:** —', '**Depends on:** STEP-005, STEPP-009');

    const result = parseStepFile(content);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.data.dependsOn).toEqual(['STEP-005']);
    expect(result.value.warnings).toContainEqual(expect.objectContaining({ field: 'dependsOn' }));
  });

  it('предупреждает о повторяющейся метке Depends on', () => {
    const content = read(path.join(TASKS, 'STEP-002.md')).replace(
      '**Depends on:** —',
      '**Depends on:** STEP-009\n**Depends on:** —'
    );

    const result = parseStepFile(content);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.warnings).toContainEqual(expect.objectContaining({ field: 'dependsOn' }));
  });
});

describe('parseReqFile', () => {
  it('извлекает все поля self-contained per-file фикстуры REQ-001-fixture-full.md', () => {
    const result = parseReqFile(read(path.join(REQUIREMENTS, 'REQ-001-fixture-full.md')));
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const { data, warnings } = result.value;
    expect(data.id).toBe('REQ-001');
    expect(data.title).toBe('Command Palette с канонической командной поверхностью');
    expect(data.priority).toBe('Критический');
    expect(data.source).toBe('brief');
    expect(data.requirement).toContain('11 MVP-команд');
    expect(data.acceptance.length).toBe(4);
    expect(data.traceability.step).toEqual(['STEP-005']);
    expect(data.traceability.adr).toEqual(['ADR-003']);
    expect(warnings).toEqual([]);
  });

  it('извлекает поля из реального docs/requirements/TEMPLATE.md (per-file layout, один REQ)', () => {
    const result = parseReqFile(read(path.join(REQUIREMENTS, 'TEMPLATE.md')));
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.data.id).toBe('REQ-NNN');
    expect(result.value.warnings).toEqual([]);
  });

  it('index SPEC.md (без REQ-заголовка) никогда не становится REQ-узлом: missing-heading', () => {
    const result = parseReqFile(read(path.join(REQUIREMENTS, 'SPEC.md')));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('missing-heading');
  });

  it('даёт явную ParseError, если ни один REQ-заголовок не найден', () => {
    const result = parseReqFile('# Просто заголовок без REQ');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('missing-heading');
  });

  it('даёт явную ParseError multiple-headings на файле с двумя REQ-заголовками (не деградирует до первого)', () => {
    const content = [
      '# REQ-001 — Первый',
      '',
      '**Приоритет:** Средний',
      '**Источник:** fixture',
      '',
      '## Requirement',
      '',
      'Первый.',
      '',
      '# REQ-002 — Второй',
      '',
      '**Приоритет:** Средний',
      '**Источник:** fixture',
      '',
      '## Requirement',
      '',
      'Второй.',
      '',
    ].join('\n');

    const result = parseReqFile(content);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('multiple-headings');
  });

  it('деградирует (warnings, не exception) на REQ-файле без Источник/Rationale/Traceability', () => {
    const result = parseReqFile(read(path.join(REQUIREMENTS, 'REQ-777-fixture-partial.md')));
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const { data, warnings } = result.value;
    expect(data.id).toBe('REQ-777');
    expect(data.source).toBe('');
    expect(data.priority).toBe('Средний');
    expect(data.rationale).toBe('');
    expect(data.requirement).toContain('Текст requirement.');
    expect(data.acceptance).toEqual(['test']);
    expect(data.traceability).toEqual({ step: [], adr: [] });

    const warningFields = warnings.map((w) => w.field);
    expect(warningFields).not.toContain('REQ-777.status');
    expect(warningFields).toContain('REQ-777.source');
    expect(warningFields).toContain('REQ-777.rationale');
    expect(warningFields).toContain('REQ-777.traceability');
    expect(warningFields).not.toContain('REQ-777.priority');
    expect(warningFields).not.toContain('REQ-777.requirement');
    expect(warningFields).not.toContain('REQ-777.acceptance');
  });

  it('предупреждает о нераспознанной STEP-метке в существующей Traceability', () => {
    const content = read(path.join(REQUIREMENTS, 'REQ-001-fixture-full.md')).replace('- STEP: STEP-005', '- STEPP: STEP-005');

    const result = parseReqFile(content);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.data.traceability.step).toEqual([]);
    expect(result.value.warnings).toContainEqual(
      expect.objectContaining({ field: 'REQ-001.traceability.step' })
    );
  });

  it('предупреждает о повреждённом значении STEP в существующей Traceability', () => {
    const content = read(path.join(REQUIREMENTS, 'REQ-001-fixture-full.md')).replace('- STEP: STEP-005', '- STEP: STEPP-005');

    const result = parseReqFile(content);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.data.traceability.step).toEqual([]);
    expect(result.value.warnings).toContainEqual(
      expect.objectContaining({ field: 'REQ-001.traceability.step' })
    );
  });

  it('предупреждает о смешанном корректном и повреждённом STEP в Traceability', () => {
    const content = read(path.join(REQUIREMENTS, 'REQ-001-fixture-full.md')).replace('- STEP: STEP-005', '- STEP: STEP-005, STEPP-009');

    const result = parseReqFile(content);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.data.traceability.step).toEqual(['STEP-005']);
    expect(result.value.warnings).toContainEqual(
      expect.objectContaining({ field: 'REQ-001.traceability.step' })
    );
  });

  it('предупреждает о повторяющейся STEP-метке в Traceability', () => {
    const content = read(path.join(REQUIREMENTS, 'REQ-001-fixture-full.md')).replace(
      '- STEP: STEP-005',
      '- STEP: STEP-009\n- STEP: —'
    );

    const result = parseReqFile(content);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.warnings).toContainEqual(
      expect.objectContaining({ field: 'REQ-001.traceability.step' })
    );
  });

  it('предупреждает о повторяющейся секции Traceability', () => {
    const content = read(path.join(REQUIREMENTS, 'REQ-001-fixture-full.md')).replace(
      '## Traceability',
      '## Traceability\n\n- STEP: —\n- ADR: —\n\n## Traceability'
    );

    const result = parseReqFile(content);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.warnings).toContainEqual(expect.objectContaining({ field: 'REQ-001.traceability' }));
  });

  it('даёт явную ParseError на пустой контент, не exception', () => {
    const result = parseReqFile('');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('empty-content');
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
    expect(data.status).toBe('Superseded');
    expect(data.date).toBe('2026-09-17');
    expect(data.deciders).toBe('initializer (INIT PROJECT)');
    expect(data.supersedes).toBe('—');
    expect(data.supersededBy).toBe('ADR-005');
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

  it('предупреждает о нераспознанной STEP-метке в существующей Traceability', () => {
    const content = read(path.join(ADR, 'ADR-001-manifest-driven-paths.md')).replace('- STEP: STEP-003', '- STEPP: STEP-003');

    const result = parseAdrFile(content);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.data.traceability.step).toEqual([]);
    expect(result.value.warnings).toContainEqual(expect.objectContaining({ field: 'traceability.step' }));
  });

  it('предупреждает о повреждённом значении STEP в существующей Traceability', () => {
    const content = read(path.join(ADR, 'ADR-001-manifest-driven-paths.md')).replace('- STEP: STEP-003', '- STEP: STEPP-003');

    const result = parseAdrFile(content);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.data.traceability.step).toEqual([]);
    expect(result.value.warnings).toContainEqual(expect.objectContaining({ field: 'traceability.step' }));
  });

  it('предупреждает о смешанном корректном и повреждённом STEP в Traceability', () => {
    const content = read(path.join(ADR, 'ADR-001-manifest-driven-paths.md')).replace('- STEP: STEP-003', '- STEP: STEP-003, STEPP-009');

    const result = parseAdrFile(content);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.data.traceability.step).toEqual(['STEP-003']);
    expect(result.value.warnings).toContainEqual(expect.objectContaining({ field: 'traceability.step' }));
  });

  it('предупреждает о повторяющейся STEP-метке в Traceability', () => {
    const content = read(path.join(ADR, 'ADR-001-manifest-driven-paths.md')).replace(
      '- STEP: STEP-003',
      '- STEP: STEP-009\n- STEP: —'
    );

    const result = parseAdrFile(content);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.warnings).toContainEqual(expect.objectContaining({ field: 'traceability.step' }));
  });

  it('предупреждает о повторяющейся секции Traceability', () => {
    const content = read(path.join(ADR, 'ADR-001-manifest-driven-paths.md')).replace(
      '## Traceability',
      '## Traceability\n\n- REQ: —\n- STEP: —\n\n## Traceability'
    );

    const result = parseAdrFile(content);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.warnings).toContainEqual(expect.objectContaining({ field: 'traceability' }));
  });

  it('даёт явную ParseError на пустой контент, не exception', () => {
    const result = parseAdrFile('   ');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('empty-content');
  });
});

describe('extractTableRows', () => {
  it('отбрасывает separator-строку, снимает внешние `|`, тримит ячейки', () => {
    const rows = extractTableRows(['| A | B |', '|---|---|', '| 1 | 2 |'].join('\n'));
    expect(rows).toEqual([
      ['A', 'B'],
      ['1', '2'],
    ]);
  });

  it('не падает на строке с непарным числом `|` и игнорирует всё после первой таблицы', () => {
    const rows = extractTableRows(
      ['текст до', '| A | B', '|---|---|', '| 1 | 2 |', '', 'текст после', '| C | D |', '|---|---|', '| 3 | 4 |'].join('\n')
    );
    expect(rows).toEqual([
      ['A', 'B'],
      ['1', '2'],
    ]);
  });

  it('возвращает пустой массив, если таблицы нет', () => {
    expect(extractTableRows('просто текст\nбез таблицы')).toEqual([]);
  });
});
