import * as path from 'node:path';
import { watchedPaths } from '../../../src/explorer/refresh';
import { parseManifest } from '../../../src/parser/yamlParser';
import { ManifestData } from '../../../src/parser/types';

const FIXTURE_MANIFEST = path.join(__dirname, '../../fixtures/manifest/initialized.manifest.yaml');

async function loadManifest(): Promise<ManifestData> {
  const parsed = await parseManifest(FIXTURE_MANIFEST);
  if (!parsed.ok) throw new Error('fixture manifest failed to parse');
  return parsed.value;
}

describe('watchedPaths', () => {
  it('инвалидирует Requirements и при изменении SPEC.md, и при изменении derived STATUS.md', async () => {
    const manifest = await loadManifest();

    expect(watchedPaths(manifest).filter((path) => path.groupId === 'requirements')).toEqual([
      { groupId: 'requirements', relGlob: manifest.sources.requirements },
      { groupId: 'requirements', relGlob: 'docs/requirements/STATUS.md' },
    ]);
  });

  it('не наблюдает недоступный requirementsStatus для неподдерживаемого поколения Harness', async () => {
    const manifest = await loadManifest();
    const unsupported = { ...manifest, harness: { ...manifest.harness, version: '2' } };

    expect(watchedPaths(unsupported).filter((path) => path.groupId === 'requirements')).toEqual([
      { groupId: 'requirements', relGlob: unsupported.sources.requirements },
    ]);
  });

  it('наблюдает explicit architecture file и ADR glob, резолвленный от relocated anchor', async () => {
    const manifest = await loadManifest();
    const relocated = { ...manifest, sources: { ...manifest.sources, architecture: 'knowledge/system.md' } };

    expect(watchedPaths(relocated).filter((path) => path.groupId === 'architecture')).toEqual([
      { groupId: 'architecture', relGlob: 'knowledge/system.md' },
      { groupId: 'architecture', relGlob: 'knowledge/adr/**/*.md' },
    ]);
  });

  it('не наблюдает derived ADR directory для неподдерживаемого поколения Harness', async () => {
    const manifest = await loadManifest();
    const unsupported = { ...manifest, harness: { ...manifest.harness, version: '2' } };

    expect(watchedPaths(unsupported).filter((path) => path.groupId === 'architecture')).toEqual([
      { groupId: 'architecture', relGlob: unsupported.sources.architecture },
    ]);
  });
});
