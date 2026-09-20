import * as path from 'node:path';
import { parseManifest } from '../../../src/parser/yamlParser';
import { ManifestData } from '../../../src/parser/types';
import { resolveHarnessArtifactPath } from '../../../src/parser/artifactPaths';
import { GROUP_IDS, MANIFEST_REL_PATH, resolveArtifactSources } from '../../../src/explorer/paths';

const FIXTURES = path.join(__dirname, '../../fixtures');

async function loadManifest(): Promise<ManifestData> {
  const parsed = await parseManifest(path.join(FIXTURES, 'projects/explorer/.harness/manifest.yaml'));
  if (!parsed.ok) throw new Error('fixture manifest failed to parse');
  return parsed.value;
}

describe('MANIFEST_REL_PATH', () => {
  it('пинит литерал текущего control-plane bootstrap path (FIX STEP-024 F-001, не сравнение константы с собой)', () => {
    expect(MANIFEST_REL_PATH).toBe('.harness/manifest.yaml');
  });
});

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

  it('Requirements — per-file directory (STEP-025) с derived statusFrom → docs/requirements/STATUS.md (OQ-004), не sources.status', async () => {
    const manifest = await loadManifest();
    const requirements = resolveArtifactSources(manifest).find((s) => s.groupId === 'requirements')!;
    expect(requirements.items).toEqual([
      { kind: 'dir', relDir: manifest.sources.requirements, glob: 'REQ-*.md', parseAs: 'req', statusFrom: 'docs/requirements/STATUS.md' },
    ]);
    // ADR-006 (Supersedes ADR-005): directory-anchor `join`, пин ровно того вычисления,
    // которое до исправления давало несуществующий `docs/STATUS.md`.
    expect(resolveHarnessArtifactPath(manifest, 'requirementsStatus')).toBe('docs/requirements/STATUS.md');
    expect(resolveHarnessArtifactPath(manifest, 'requirementsStatus')).not.toBe(manifest.sources.status);
  });

  it('Architecture включает architecture.md и производный каталог ADR (OQ-004)', async () => {
    const manifest = await loadManifest();
    const architecture = resolveArtifactSources(manifest).find((s) => s.groupId === 'architecture')!;
    expect(architecture.items).toEqual([
      { kind: 'file', relPath: manifest.sources.architecture },
      { kind: 'dir', relDir: 'docs/adr', glob: '*.md', parseAs: 'adr' },
    ]);
    expect(resolveHarnessArtifactPath(manifest, 'adrDirectory')).toBe('docs/adr');
  });

  it('переносит derived артефакты вместе с manifest anchors', async () => {
    const manifest = await loadManifest();
    const relocated = {
      ...manifest,
      sources: { ...manifest.sources, architecture: 'knowledge/system.md', requirements: 'knowledge/req' },
    };

    expect(resolveHarnessArtifactPath(relocated, 'adrDirectory')).toBe('knowledge/adr');
    expect(resolveHarnessArtifactPath(relocated, 'requirementsStatus')).toBe('knowledge/req/STATUS.md');
  });

  it('не создаёт derived источники для неподдерживаемого поколения Harness', async () => {
    const manifest = await loadManifest();
    const unsupported = { ...manifest, harness: { ...manifest.harness, version: '2' } };

    expect(resolveHarnessArtifactPath(unsupported, 'adrDirectory')).toBeUndefined();
    expect(resolveArtifactSources(unsupported).find((source) => source.groupId === 'architecture')!.items).toEqual([
      { kind: 'file', relPath: unsupported.sources.architecture },
    ]);
    expect(resolveArtifactSources(unsupported).find((source) => source.groupId === 'requirements')!.items).toEqual([
      { kind: 'dir', relDir: unsupported.sources.requirements, glob: 'REQ-*.md', parseAs: 'req' },
    ]);
  });

  it('Explorer не содержит consumer-level layout knowledge Harness-артефактов', () => {
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
