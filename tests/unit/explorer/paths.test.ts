import * as path from 'node:path';
import { parseManifest } from '../../../src/parser/yamlParser';
import { ManifestData } from '../../../src/parser/types';
import { GROUP_IDS, MANIFEST_REL_PATH, deriveAdrDir, resolveArtifactSources } from '../../../src/explorer/paths';

const FIXTURES = path.join(__dirname, '../../fixtures');

async function loadManifest(): Promise<ManifestData> {
  const parsed = await parseManifest(path.join(FIXTURES, 'projects/explorer/.project/manifest.yaml'));
  if (!parsed.ok) throw new Error('fixture manifest failed to parse');
  return parsed.value;
}

describe('resolveArtifactSources', () => {
  it('резолвит ровно 8 групп REQ-002, в порядке протокола', async () => {
    const manifest = await loadManifest();
    const sources = resolveArtifactSources(manifest);
    expect(sources.map((s) => s.groupId)).toEqual(GROUP_IDS);
  });

  it('Project Configuration указывает на фиксированный self-path манифеста', async () => {
    const manifest = await loadManifest();
    const [projectConfiguration] = resolveArtifactSources(manifest);
    expect(projectConfiguration.items).toEqual([{ kind: 'file', relPath: MANIFEST_REL_PATH }]);
  });

  it('Tasks резолвится из protocol.taskDirectory манифеста, не хардкода', async () => {
    const manifest = await loadManifest();
    const tasks = resolveArtifactSources(manifest).find((s) => s.groupId === 'tasks')!;
    expect(tasks.items).toEqual([{ kind: 'dir', relDir: manifest.protocol.taskDirectory, glob: 'STEP-*.md', parseAs: 'step' }]);
  });

  it('Architecture включает architecture.md и производный каталог ADR (OQ-004)', async () => {
    const manifest = await loadManifest();
    const architecture = resolveArtifactSources(manifest).find((s) => s.groupId === 'architecture')!;
    expect(architecture.items).toEqual([
      { kind: 'file', relPath: manifest.sources.architecture },
      { kind: 'dir', relDir: 'docs/adr', glob: '*.md', parseAs: 'adr' },
    ]);
    expect(deriveAdrDir(manifest)).toBe('docs/adr');
  });

  it('никакой Harness-путь не захардкожен вне paths.ts', () => {
    const explorerSourceFiles = [
      'model.ts',
      'reader.ts',
      'vscodeReader.ts',
      'statusIcon.ts',
      'filter.ts',
      'stepWriter.ts',
      'guards.ts',
      'treeItem.ts',
      'treeProvider.ts',
      'refresh.ts',
      'actions.ts',
      'activation.ts',
    ];
    const src = path.join(__dirname, '../../../src/explorer');
    const forbidden = /planning\/tasks|docs\/requirements|docs\/adr/;
    for (const file of explorerSourceFiles) {
      const content = require('node:fs').readFileSync(path.join(src, file), 'utf8') as string;
      expect(forbidden.test(content)).toBe(false);
    }
  });
});
