import * as path from 'node:path';
import { readFile } from 'node:fs/promises';
import { parseStepFile } from '../../../src/parser/markdownParser';
import { StepData } from '../../../src/parser/types';
import { selectNextStep } from '../../../src/commands/nextStepSelector';

const STEPS_DIR = path.join(__dirname, '../../fixtures/projects/preDispatch/planning/tasks');

async function loadStep(fileName: string): Promise<StepData> {
  const content = await readFile(path.join(STEPS_DIR, fileName), 'utf8');
  const parsed = parseStepFile(content);
  if (!parsed.ok) throw new Error(`fixture ${fileName} failed to parse: ${parsed.error.kind}`);
  return parsed.value.data;
}

describe('selectNextStep', () => {
  it('рекомендует PLAN, если нет актуального Implementation plan', async () => {
    const research = await loadStep('STEP-research.md');
    const result = selectNextStep([research]);
    expect(result).toEqual({
      step: research,
      reasonKey: 'harness.nextStep.reason.needsPlan',
      reasonParams: { step: 'STEP-research' },
      suggestedCommandId: 'harness.plan',
    });
  });

  it('рекомендует FIX, если последний review завершился FAIL', async () => {
    const failReview = await loadStep('STEP-failreview.md');
    const result = selectNextStep([failReview]);
    expect(result).toEqual({
      step: failReview,
      reasonKey: 'harness.nextStep.reason.needsFix',
      reasonParams: { step: 'STEP-failreview' },
      suggestedCommandId: 'harness.fix',
    });
  });

  it('рекомендует IMPLEMENT, если план готов и последний review не FAIL', async () => {
    const passReview = await loadStep('STEP-passreview.md');
    const result = selectNextStep([passReview]);
    expect(result).toEqual({
      step: passReview,
      reasonKey: 'harness.nextStep.reason.needsImplement',
      reasonParams: { step: 'STEP-passreview' },
      suggestedCommandId: 'harness.implement',
    });
  });

  it('исключает STEP с невыполненной hard dependency', async () => {
    const step1 = await loadStep('STEP-1.md'); // Выполнено — зависимость STEP-2
    const step2 = await loadStep('STEP-2.md'); // Запланировано, ещё не Выполнено
    const step3 = await loadStep('STEP-3.md'); // Depends on STEP-2 — должен быть исключён
    const result = selectNextStep([step1, step2, step3]);
    expect(result?.step.id).toBe('STEP-2');
  });

  it('выбирает по приоритету, затем по номеру STEP при равном приоритете', async () => {
    const step2 = await loadStep('STEP-2.md'); // Высокий, depends on STEP-1 (выполнен)
    const step1 = await loadStep('STEP-1.md'); // Выполнено — нужен как зависимость
    const research = await loadStep('STEP-research.md'); // Средний
    const failReview = await loadStep('STEP-failreview.md'); // Высокий, без зависимостей
    const result = selectNextStep([step1, step2, research, failReview]);
    // STEP-2 и STEP-failreview оба Высокий(1) — тай-брейк по номеру STEP: 2 < Infinity.
    expect(result?.step.id).toBe('STEP-2');
  });

  it('исключает Отменено/Заблокировано/Выполнено', async () => {
    const cancelled = await loadStep('STEP-cancelled.md');
    const blocked = await loadStep('STEP-blocked.md');
    const done = await loadStep('STEP-1.md');
    expect(selectNextStep([cancelled, blocked, done])).toBeUndefined();
  });

  it('возвращает undefined на пустом списке', () => {
    expect(selectNextStep([])).toBeUndefined();
  });
});
