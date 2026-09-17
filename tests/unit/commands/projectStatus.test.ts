import * as path from 'node:path';
import { readFile } from 'node:fs/promises';
import type { I18nService } from '../../../src/locales/activation';
import { parseStepFile } from '../../../src/parser/markdownParser';
import { StepData } from '../../../src/parser/types';
import { computeProjectStatus, formatStatusSummary } from '../../../src/commands/projectStatus';

const STEPS_DIR = path.join(__dirname, '../../fixtures/projects/preDispatch/planning/tasks');

const FILES = [
  'STEP-1.md',
  'STEP-2.md',
  'STEP-3.md',
  'STEP-research.md',
  'STEP-cancelled.md',
  'STEP-failreview.md',
  'STEP-passreview.md',
  'STEP-blocked.md',
];

async function loadAllSteps(): Promise<StepData[]> {
  const steps: StepData[] = [];
  for (const file of FILES) {
    const content = await readFile(path.join(STEPS_DIR, file), 'utf8');
    const parsed = parseStepFile(content);
    if (!parsed.ok) throw new Error(`fixture ${file} failed to parse: ${parsed.error.kind}`);
    steps.push(parsed.value.data);
  }
  return steps;
}

describe('computeProjectStatus', () => {
  it('группирует STEP по статусу', async () => {
    const steps = await loadAllSteps();
    const summary = computeProjectStatus(steps);
    expect(summary.byStatus['Выполнено'].map((s) => s.id)).toEqual(['STEP-1']);
    expect(summary.byStatus['Запланировано'].map((s) => s.id).sort()).toEqual(
      ['STEP-2', 'STEP-3', 'STEP-research'].sort()
    );
    expect(summary.byStatus['Отменено'].map((s) => s.id)).toEqual(['STEP-cancelled']);
    expect(summary.byStatus['В работе'].map((s) => s.id).sort()).toEqual(
      ['STEP-failreview', 'STEP-passreview'].sort()
    );
    expect(summary.byStatus['Заблокировано'].map((s) => s.id)).toEqual(['STEP-blocked']);
  });

  it('собирает список заблокированных STEP', async () => {
    const steps = await loadAllSteps();
    const summary = computeProjectStatus(steps);
    expect(summary.blocked.map((b) => b.step.id)).toEqual(['STEP-blocked']);
  });

  it('находит STEP с невыполненной зависимостью и называет конкретный блокер', async () => {
    const steps = await loadAllSteps();
    const summary = computeProjectStatus(steps);
    expect(summary.unmetDependency).toEqual([{ step: expect.objectContaining({ id: 'STEP-3' }), blockingStepId: 'STEP-2' }]);
  });

  it('FIX F-001: считает нерезолвленную (dangling) зависимость тоже блокером, не пропускает молча', async () => {
    const steps = await loadAllSteps();
    const withDangling: StepData = { ...steps[0], id: 'STEP-200', dependsOn: ['STEP-999'] };
    const summary = computeProjectStatus([...steps, withDangling]);
    expect(summary.unmetDependency).toContainEqual({
      step: expect.objectContaining({ id: 'STEP-200' }),
      blockingStepId: 'STEP-999',
    });
  });

  it('на пустом списке возвращает пустую сводку', () => {
    const summary = computeProjectStatus([]);
    expect(summary.byStatus).toEqual({});
    expect(summary.blocked).toEqual([]);
    expect(summary.unmetDependency).toEqual([]);
  });
});

describe('formatStatusSummary', () => {
  const fakeI18n: I18nService = {
    t: (key: string, params?: Record<string, string>) =>
      params ? `${key}(${Object.values(params).join(',')})` : key,
    getLanguage: () => 'ru',
    onDidChangeLanguage: (() => ({ dispose: () => undefined })) as I18nService['onDidChangeLanguage'],
  };

  it('форматирует пустую сводку через i18n-ключ', () => {
    const summary = computeProjectStatus([]);
    expect(formatStatusSummary(summary, fakeI18n)).toBe('harness.status.empty');
  });

  it('включает счётчики по статусам и суффиксы для blocked/unmet', async () => {
    const steps = await loadAllSteps();
    const summary = computeProjectStatus(steps);
    const result = formatStatusSummary(summary, fakeI18n);
    expect(result).toContain('Выполнено: 1');
    expect(result).toContain('harness.status.blockedSuffix(STEP-blocked)');
    expect(result).toContain('harness.status.unmetSuffix(STEP-3)');
  });
});
