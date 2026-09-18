import { parseManifest } from '../../../src/parser/yamlParser';
import { ManifestData } from '../../../src/parser/types';
import { ArtifactReader, createFsArtifactReader } from '../../../src/explorer/reader';
import { HarnessTreeDataProvider } from '../../../src/explorer/treeProvider';
import { HarnessNode } from '../../../src/explorer/model';
import type { I18nService } from '../../../src/locales/activation';
import path from 'node:path';

const FIXTURE_MANIFEST = path.join(__dirname, '../../fixtures/manifest/initialized.manifest.yaml');
const EXPLORER_PROJECT_ROOT = path.join(__dirname, '../../fixtures/projects/explorer');

function findGroup(nodes: HarnessNode[], id: string): HarnessNode {
  const found = nodes.find((n) => n.kind === 'group' && n.id === id);
  if (!found) throw new Error(`group ${id} not found`);
  return found;
}

const emptyReader: ArtifactReader = {
  async list(): Promise<string[]> {
    return [];
  },
  async read(): Promise<string> {
    return '';
  },
  async exists(): Promise<boolean> {
    return false;
  },
};

const i18n: I18nService = {
  t: (key) => key,
  getLanguage: () => 'ru',
  onDidChangeLanguage: (() => ({ dispose: () => {} })) as I18nService['onDidChangeLanguage'],
};

async function loadManifest(): Promise<ManifestData> {
  const parsed = await parseManifest(FIXTURE_MANIFEST);
  if (!parsed.ok) throw new Error('fixture manifest failed to parse');
  return parsed.value;
}

/**
 * FIX STEP-006 (F-001): reproduces the exact defect — VSCode's
 * ExtHostTreeView keys its internal node registry by object reference
 * (`Map<element, handle>`), so `fire()` only reaches the UI if it is given a
 * reference already returned by `getChildren()`. This test replays that
 * lookup pattern directly against `HarnessTreeDataProvider`.
 */
describe('HarnessTreeDataProvider (F-001 regression)', () => {
  it('getChildren(undefined) returns the same group node instances on repeated calls', async () => {
    const manifest = await loadManifest();
    const provider = new HarnessTreeDataProvider('/workspace', manifest, emptyReader, i18n);

    const first = await provider.getChildren();
    const second = await provider.getChildren();

    expect(first.length).toBeGreaterThan(0);
    for (let i = 0; i < first.length; i++) {
      expect(second[i]).toBe(first[i]);
    }
  });

  it('invalidate(groupId) fires a node reference that getChildren() actually returned', async () => {
    const manifest = await loadManifest();
    const provider = new HarnessTreeDataProvider('/workspace', manifest, emptyReader, i18n);

    const groups = await provider.getChildren();
    // Simulate ExtHostTreeView's `Map<element, handle>`, keyed by reference.
    const registry = new Map(groups.map((node) => [node, 'handle'] as const));

    let fired: unknown;
    provider.onDidChangeTreeData((node) => {
      fired = node;
    });

    provider.invalidate('tasks');

    expect(fired).toBeDefined();
    // The regression: before the fix, `fired` was a freshly allocated literal
    // that `registry.get(fired)` could never find.
    expect(registry.has(fired as never)).toBe(true);
  });

  it('invalidate() without a groupId fires undefined (full refresh)', async () => {
    const manifest = await loadManifest();
    const provider = new HarnessTreeDataProvider('/workspace', manifest, emptyReader, i18n);

    let fired: unknown = 'not-called';
    provider.onDidChangeTreeData((node) => {
      fired = node;
    });

    provider.invalidate();

    expect(fired).toBeUndefined();
  });
});

/**
 * FIX STEP-006 (2-й проход, F-013): до фикса `HarnessTreeDataProvider.sources`
 * вычислялись один раз в конструкторе и не менялись при `setManifest` —
 * смена `protocol.taskDirectory` в манифесте не отражалась в дереве до
 * перезапуска окна, хотя `activation.ts` перепарсивал манифест и вызывал
 * `invalidate()`. Тест кладёт spy на `reader.list` и проверяет, какой каталог
 * реально запрашивается ДО и ПОСЛЕ `setManifest` — не факт наличия метода.
 */
describe('HarnessTreeDataProvider.setManifest (F-013 regression)', () => {
  it('recomputes sources so a changed taskDirectory is used on the next getChildren("tasks")', async () => {
    const manifestA = await loadManifest();
    const manifestB: ManifestData = {
      ...manifestA,
      protocol: { ...manifestA.protocol, taskDirectory: 'planning/other-tasks' },
    };

    const requestedDirs: string[] = [];
    const spyReader: ArtifactReader = {
      async list(dir) {
        requestedDirs.push(dir);
        return [];
      },
      async read() {
        return '';
      },
      async exists() {
        return false;
      },
    };

    const provider = new HarnessTreeDataProvider('/workspace', manifestA, spyReader, i18n);
    const roots = await provider.getChildren();
    const tasksGroup = findGroup(roots, 'tasks');

    await provider.getChildren(tasksGroup);
    expect(requestedDirs).toEqual(['planning/tasks']);

    provider.setManifest(manifestB);
    // `tasksGroup` — стабильная ссылка из `groupNodes` (не пересчитывается
    // `setManifest`), поэтому её можно переиспользовать для повторного
    // запроса детей после смены манифеста.
    await provider.getChildren(tasksGroup);
    expect(requestedDirs).toEqual(['planning/tasks', 'planning/other-tasks']);
  });

  it('clears the group cache, so a stale cached "tasks" listing is not reused after setManifest', async () => {
    const manifestA = await loadManifest();
    const manifestB: ManifestData = {
      ...manifestA,
      protocol: { ...manifestA.protocol, taskDirectory: 'planning/other-tasks' },
    };

    let listCalls = 0;
    const spyReader: ArtifactReader = {
      async list() {
        listCalls++;
        return [];
      },
      async read() {
        return '';
      },
      async exists() {
        return false;
      },
    };

    const provider = new HarnessTreeDataProvider('/workspace', manifestA, spyReader, i18n);
    const tasksGroup = findGroup(await provider.getChildren(), 'tasks');

    await provider.getChildren(tasksGroup);
    await provider.getChildren(tasksGroup); // cache-hit, не должен звать reader снова
    expect(listCalls).toBe(1);

    provider.setManifest(manifestB);
    await provider.getChildren(tasksGroup);
    expect(listCalls).toBe(2);
  });
});

/**
 * FIX STEP-006 (2-й проход, F-014): предыдущий проход добавил только
 * идентити-регрессию (F-001) на `emptyReader`, но не покрыл кэш-поведение
 * провайдера на реальных данных — регрессия вида «`invalidate` перестал
 * чистить `cache`» осталась бы незамеченной.
 */
describe('HarnessTreeDataProvider caching on real fixture data (F-014 regression)', () => {
  async function loadExplorerFixtureManifest(): Promise<ManifestData> {
    const parsed = await parseManifest(path.join(EXPLORER_PROJECT_ROOT, '.project/manifest.yaml'));
    if (!parsed.ok) throw new Error('explorer fixture manifest failed to parse');
    return parsed.value;
  }

  it('caches getChildren("tasks") until invalidate("tasks"); reader.list is only called on a cache-miss', async () => {
    const manifest = await loadExplorerFixtureManifest();
    const baseReader = createFsArtifactReader(EXPLORER_PROJECT_ROOT);
    let listCalls = 0;
    const countingReader: ArtifactReader = {
      ...baseReader,
      async list(dir, glob) {
        listCalls++;
        return baseReader.list(dir, glob);
      },
    };

    const provider = new HarnessTreeDataProvider(EXPLORER_PROJECT_ROOT, manifest, countingReader, i18n);
    const tasksGroup = findGroup(await provider.getChildren(), 'tasks');

    const first = await provider.getChildren(tasksGroup);
    expect(first.some((n) => n.kind === 'step')).toBe(true);
    expect(listCalls).toBe(1);

    const second = await provider.getChildren(tasksGroup); // повторное раскрытие — из кэша
    expect(second).toBe(first);
    expect(listCalls).toBe(1);

    provider.invalidate('tasks');
    const third = await provider.getChildren(tasksGroup);
    expect(listCalls).toBe(2);
    expect(third.some((n) => n.kind === 'step')).toBe(true);
  });
});
