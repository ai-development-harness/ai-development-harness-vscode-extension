import * as path from 'node:path';
import { readFile } from 'node:fs/promises';
import { parseStepFile } from '../../../src/parser/markdownParser';
import { setBlocker, setStatus, setStatusAndBlocker } from '../../../src/explorer/stepWriter';

const STEP_FILE = path.join(__dirname, '../../fixtures/projects/explorer/planning/tasks/STEP-002.md');

describe('setStatus', () => {
  it('round-trip: после setStatus повторный parseStepFile даёт новый статус, остальные поля не меняются', async () => {
    const original = await readFile(STEP_FILE, 'utf8');
    const before = parseStepFile(original);
    if (!before.ok) throw new Error('fixture failed to parse');

    const result = setStatus(original, 'Заблокировано');
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const after = parseStepFile(result.value);
    if (!after.ok) throw new Error('updated content failed to parse');
    expect(after.value.data.status).toBe('Заблокировано');
    expect({ ...after.value.data, status: undefined }).toEqual({ ...before.value.data, status: undefined });
  });

  it('отсутствие метки "Статус" → ошибка, контент неизменен', () => {
    const content = '# STEP-999 — без метки статуса\n\nтело без меток\n';
    const result = setStatus(content, 'Выполнено');
    expect(result).toEqual({ ok: false, error: { kind: 'label-not-found', label: 'Статус' } });
  });
});

describe('setBlocker', () => {
  it('round-trip: обновляет только тело секции Blocker / Failure reason', async () => {
    const original = await readFile(STEP_FILE, 'utf8');
    const before = parseStepFile(original);
    if (!before.ok) throw new Error('fixture failed to parse');

    const result = setBlocker(original, 'Ждём внешнюю зависимость.');
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const after = parseStepFile(result.value);
    if (!after.ok) throw new Error('updated content failed to parse');
    expect(after.value.data.blocker).toBe('Ждём внешнюю зависимость.');
    expect({ ...after.value.data, blocker: undefined }).toEqual({ ...before.value.data, blocker: undefined });
  });

  it('отсутствие секции → ошибка section-not-found, контент неизменен', () => {
    const content = '# STEP-999 — без секции\n\nтело\n';
    const result = setBlocker(content, 'x');
    expect(result).toEqual({ ok: false, error: { kind: 'section-not-found', section: 'Blocker / Failure reason' } });
  });
});

describe('setStatusAndBlocker', () => {
  it('FIX STEP-006 (F-005): round-trip меняет и status, и blocker одной записью, остальные поля не меняются', async () => {
    const original = await readFile(STEP_FILE, 'utf8');
    const before = parseStepFile(original);
    if (!before.ok) throw new Error('fixture failed to parse');

    const result = setStatusAndBlocker(original, 'Заблокировано', 'Ждём внешнюю зависимость.');
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const after = parseStepFile(result.value);
    if (!after.ok) throw new Error('updated content failed to parse');
    expect(after.value.data.status).toBe('Заблокировано');
    expect(after.value.data.blocker).toBe('Ждём внешнюю зависимость.');
    expect({ ...after.value.data, status: undefined, blocker: undefined }).toEqual({
      ...before.value.data,
      status: undefined,
      blocker: undefined,
    });
  });

  it('FIX STEP-006 (F-005): отсутствие секции Blocker → ошибка, status в контенте не меняется (нет частичной записи)', () => {
    const content = '# STEP-999 — без секции\n\n**Статус:** В работе\n\nтело\n';
    const result = setStatusAndBlocker(content, 'Заблокировано', 'x');
    expect(result).toEqual({ ok: false, error: { kind: 'section-not-found', section: 'Blocker / Failure reason' } });
  });
});
