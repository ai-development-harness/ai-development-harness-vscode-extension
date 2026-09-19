import * as fs from 'node:fs';
import * as path from 'node:path';
import { parseReqStatus, reqStatusMap } from '../../../src/parser/requirementsStatus';

const REQUIREMENTS = path.join(__dirname, '..', '..', 'fixtures', 'requirements');

function read(filePath: string): string {
  return fs.readFileSync(filePath, 'utf8');
}

describe('parseReqStatus', () => {
  it('разбирает реальную фикстуру docs/requirements/STATUS.md: 10 записей, статусы и steps', () => {
    const result = parseReqStatus(read(path.join(REQUIREMENTS, 'STATUS.md')));
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

    const req002 = data.find((r) => r.id === 'REQ-002')!;
    expect(req002.status).toBe('Выполнено');

    const req006 = data.find((r) => r.id === 'REQ-006')!;
    expect(req006.steps).toEqual(['STEP-004', 'STEP-010']);

    expect(warnings).toEqual([]);
  });

  it('колонки резолвятся по имени: переставленные/дополнительные колонки дают тот же результат', () => {
    const content = [
      '# Requirements Status',
      '',
      '| Evidence | REQ | Комментарий | Статус | Название | Реализующие STEP |',
      '|---|---|---|---|---|---|',
      '| — | REQ-001 | n/a | Выполнено | Тестовый REQ | STEP-001 |',
    ].join('\n');

    const result = parseReqStatus(content);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const { data, warnings } = result.value;
    expect(data).toEqual([
      { id: 'REQ-001', title: 'Тестовый REQ', status: 'Выполнено', steps: ['STEP-001'], evidence: '—' },
    ]);
    expect(warnings).toEqual([]);
  });

  it('отсутствует колонка "Статус" → ok, статусы пустые, warning table.status', () => {
    const content = [
      '# Requirements Status',
      '',
      '| REQ | Название | Реализующие STEP | Evidence |',
      '|---|---|---|---|',
      '| REQ-001 | Тестовый REQ | STEP-001 | — |',
    ].join('\n');

    const result = parseReqStatus(content);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const { data, warnings } = result.value;
    expect(data[0].status).toBe('');
    expect(warnings.map((w) => w.field)).toContain('table.status');
  });

  it('даёт явную ParseError на пустой контент, не exception', () => {
    const result = parseReqStatus('');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('empty-content');
  });

  it('даёт явную ParseError, если в markdown нет таблицы', () => {
    const result = parseReqStatus('# Requirements Status\n\nпросто текст без таблицы');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('missing-table');
  });

  it('мусорная строка (не REQ-NNN) пропускается с warning; дубликат id → warning, побеждает первая строка', () => {
    const content = [
      '# Requirements Status',
      '',
      '| REQ | Название | Статус | Реализующие STEP | Evidence |',
      '|---|---|---|---|---|',
      '| REQ-001 | Первый | Выполнено | STEP-001 | — |',
      '| не REQ | Мусор | Неважно | — | — |',
      '| REQ-001 | Дубликат | Отменено | STEP-002 | — |',
      '| REQ-002 | Второй | Запланировано | — | — |',
    ].join('\n');

    const result = parseReqStatus(content);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const { data, warnings } = result.value;
    expect(data.map((r) => r.id)).toEqual(['REQ-001', 'REQ-002']);
    expect(data.find((r) => r.id === 'REQ-001')!.status).toBe('Выполнено');

    const warningFields = warnings.map((w) => w.field);
    expect(warningFields.some((f) => f.startsWith('row.'))).toBe(true);
    expect(warningFields).toContain('REQ-001.duplicate');
  });
});

describe('reqStatusMap', () => {
  it('строит индекс id → status', () => {
    const map = reqStatusMap([
      { id: 'REQ-001', title: 'A', status: 'Выполнено', steps: [], evidence: '' },
      { id: 'REQ-002', title: 'B', status: 'Запланировано', steps: [], evidence: '' },
    ]);
    expect(map.get('REQ-001')).toBe('Выполнено');
    expect(map.get('REQ-002')).toBe('Запланировано');
    expect(map.get('REQ-999')).toBeUndefined();
  });
});
