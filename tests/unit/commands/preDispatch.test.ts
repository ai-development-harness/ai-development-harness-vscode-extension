import * as path from 'node:path';
import { readFile } from 'node:fs/promises';
import { parseManifest } from '../../../src/parser/yamlParser';
import { parseStepFile } from '../../../src/parser/markdownParser';
import { ManifestData, StepData } from '../../../src/parser/types';
import {
  checkHardDependencies,
  checkInitGuard,
  checkMutationBoundary,
  resolveDependencySteps,
  runPreDispatchChecks,
} from '../../../src/commands/preDispatch';

const FIXTURES = path.join(__dirname, '../../fixtures');
const STEPS_DIR = path.join(FIXTURES, 'projects/preDispatch/planning/tasks');

async function loadStep(fileName: string): Promise<StepData> {
  const content = await readFile(path.join(STEPS_DIR, fileName), 'utf8');
  const parsed = parseStepFile(content);
  if (!parsed.ok) throw new Error(`fixture ${fileName} failed to parse: ${parsed.error.kind}`);
  return parsed.value.data;
}

async function loadManifest(fileName: string): Promise<ManifestData> {
  const parsed = await parseManifest(path.join(FIXTURES, 'manifest', fileName));
  if (!parsed.ok) throw new Error(`fixture manifest ${fileName} failed to parse`);
  return parsed.value;
}

describe('checkInitGuard', () => {
  it('блокирует mutating-команду на неинициализированном проекте', async () => {
    const manifest = await loadManifest('uninitialized.manifest.yaml');
    expect(checkInitGuard(manifest, 'require-initialized')).toEqual({
      ok: false,
      messageKey: 'harness.error.notInitialized',
    });
  });

  it('пропускает mutating-команду на инициализированном проекте', async () => {
    const manifest = await loadManifest('initialized.manifest.yaml');
    expect(checkInitGuard(manifest, 'require-initialized')).toEqual({ ok: true });
  });

  it('блокирует INIT PROJECT на уже инициализированном проекте (инвертированный guard)', async () => {
    const manifest = await loadManifest('initialized.manifest.yaml');
    expect(checkInitGuard(manifest, 'require-uninitialized')).toEqual({
      ok: false,
      messageKey: 'harness.error.alreadyInitialized',
    });
  });

  it('пропускает INIT PROJECT на неинициализированном проекте', async () => {
    const manifest = await loadManifest('uninitialized.manifest.yaml');
    expect(checkInitGuard(manifest, 'require-uninitialized')).toEqual({ ok: true });
  });

  it("не блокирует read-only команду (guard 'none') независимо от initialized", async () => {
    const manifest = await loadManifest('uninitialized.manifest.yaml');
    expect(checkInitGuard(manifest, 'none')).toEqual({ ok: true });
  });
});

describe('checkHardDependencies', () => {
  it('пропускает STEP, все зависимости которого выполнены', async () => {
    const dep = await loadStep('STEP-1.md');
    expect(checkHardDependencies(['STEP-1'], [dep])).toEqual({ ok: true });
  });

  it('блокирует STEP с невыполненной зависимостью и называет конкретный блокер', async () => {
    const dep = await loadStep('STEP-2.md');
    expect(checkHardDependencies(['STEP-2'], [dep])).toEqual({
      ok: false,
      messageKey: 'harness.error.unmetDependency',
      params: { step: 'STEP-2' },
    });
  });

  it('без зависимостей пропускает всегда', () => {
    expect(checkHardDependencies([], [])).toEqual({ ok: true });
  });

  it(
    'FIX F-001: блокирует зависимость, для которой не нашлось STEP-файла ' +
      '(dangling dependency), вместо молчаливого пропуска',
    () => {
      expect(checkHardDependencies(['STEP-999'], [])).toEqual({
        ok: false,
        messageKey: 'harness.error.missingDependency',
        params: { step: 'STEP-999' },
      });
    }
  );

  it('FIX F-001: dangling-зависимость блокирует, даже если другие зависимости выполнены', async () => {
    const dep1 = await loadStep('STEP-1.md');
    expect(checkHardDependencies(['STEP-1', 'STEP-999'], [dep1])).toEqual({
      ok: false,
      messageKey: 'harness.error.missingDependency',
      params: { step: 'STEP-999' },
    });
  });
});

describe('resolveDependencySteps', () => {
  it('резолвит StepData зависимостей по id из общего списка', async () => {
    const target = await loadStep('STEP-2.md');
    const dep1 = await loadStep('STEP-1.md');
    const other = await loadStep('STEP-3.md');
    expect(resolveDependencySteps(target, [dep1, other])).toEqual([dep1]);
  });

  it(
    'не резолвит dependsOn id, для которого нет файла в списке ' +
      '(обнаружение и блокировка — в checkHardDependencies, не здесь)',
    async () => {
      const target = await loadStep('STEP-2.md');
      expect(resolveDependencySteps(target, [])).toEqual([]);
    }
  );
});

describe('checkMutationBoundary', () => {
  it('блокирует STEP-scoped команду на терминальном статусе (Отменено)', async () => {
    const target = await loadStep('STEP-cancelled.md');
    expect(checkMutationBoundary('harness.plan', target)).toEqual({
      ok: false,
      messageKey: 'harness.error.terminalStatus',
      params: { step: target.id, status: 'Отменено' },
    });
  });

  it('блокирует IMPLEMENT на STEP типа RESEARCH', async () => {
    const target = await loadStep('STEP-research.md');
    expect(checkMutationBoundary('harness.implement', target)).toEqual({
      ok: false,
      messageKey: 'harness.error.implementWrongType',
      params: { step: target.id, type: 'RESEARCH' },
    });
  });

  it('пропускает PLAN на STEP типа RESEARCH (ограничение специфично для IMPLEMENT)', async () => {
    const target = await loadStep('STEP-research.md');
    expect(checkMutationBoundary('harness.plan', target)).toEqual({ ok: true });
  });

  it('блокирует FIX без последнего FAIL review', async () => {
    const target = await loadStep('STEP-passreview.md');
    expect(checkMutationBoundary('harness.fix', target)).toEqual({
      ok: false,
      messageKey: 'harness.error.fixWithoutFail',
      params: { step: target.id },
    });
  });

  it('пропускает FIX при последнем FAIL review', async () => {
    const target = await loadStep('STEP-failreview.md');
    expect(checkMutationBoundary('harness.fix', target)).toEqual({ ok: true });
  });
});

describe('runPreDispatchChecks', () => {
  it('init guard блокирует раньше проверки зависимостей', async () => {
    const manifest = await loadManifest('uninitialized.manifest.yaml');
    const target = await loadStep('STEP-3.md');
    const dep = await loadStep('STEP-2.md'); // тоже не выполнен — если бы init guard не сработал первым, дошли бы сюда
    const result = runPreDispatchChecks(
      { id: 'harness.plan', initGuard: 'require-initialized', stepScoped: true },
      { manifest, targetStep: target, dependencySteps: [dep] }
    );
    expect(result).toEqual({ ok: false, messageKey: 'harness.error.notInitialized' });
  });

  it('пропускает полностью валидный сценарий', async () => {
    const manifest = await loadManifest('initialized.manifest.yaml');
    const target = await loadStep('STEP-2.md');
    const dep = await loadStep('STEP-1.md');
    const result = runPreDispatchChecks(
      { id: 'harness.plan', initGuard: 'require-initialized', stepScoped: true },
      { manifest, targetStep: target, dependencySteps: [dep] }
    );
    expect(result).toEqual({ ok: true });
  });

  it('не запускает STEP-scoped проверки для команд без stepScoped', async () => {
    const manifest = await loadManifest('initialized.manifest.yaml');
    const result = runPreDispatchChecks(
      { id: 'harness.status', initGuard: 'none', stepScoped: false },
      { manifest }
    );
    expect(result).toEqual({ ok: true });
  });

  it('FIX F-001: блокирует STEP, чья Depends on ссылается на несуществующий STEP-файл (dangling dependency, воспроизведено REVIEW-2026-09-17T2330)', async () => {
    const manifest = await loadManifest('initialized.manifest.yaml');
    const target = { ...(await loadStep('STEP-1.md')), id: 'STEP-100', dependsOn: ['STEP-999'] };
    const result = runPreDispatchChecks(
      { id: 'harness.plan', initGuard: 'require-initialized', stepScoped: true },
      { manifest, targetStep: target, dependencySteps: resolveDependencySteps(target, []) }
    );
    expect(result).toEqual({
      ok: false,
      messageKey: 'harness.error.missingDependency',
      params: { step: 'STEP-999' },
    });
  });

  it('возвращает явную ошибку, если STEP-scoped команда вызвана без targetStep', async () => {
    const manifest = await loadManifest('initialized.manifest.yaml');
    const result = runPreDispatchChecks(
      { id: 'harness.plan', initGuard: 'require-initialized', stepScoped: true },
      { manifest }
    );
    expect(result).toEqual({ ok: false, messageKey: 'harness.error.noTargetStep' });
  });
});
