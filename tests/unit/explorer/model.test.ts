import * as path from 'node:path';
import { parseManifest } from '../../../src/parser/yamlParser';
import { ManifestData } from '../../../src/parser/types';
import { resolveArtifactSources } from '../../../src/explorer/paths';
import { createFsArtifactReader } from '../../../src/explorer/reader';
import { HarnessNode, loadGroupChildren } from '../../../src/explorer/model';
import { EMPTY_FILTER_STATE } from '../../../src/explorer/filter';

const PROJECT_ROOT = path.join(__dirname, '../../fixtures/projects/explorer');

async function loadManifest(): Promise<ManifestData> {
  const parsed = await parseManifest(path.join(PROJECT_ROOT, '.project/manifest.yaml'));
  if (!parsed.ok) throw new Error('fixture manifest failed to parse');
  return parsed.value;
}

describe('loadGroupChildren (fs ArtifactReader)', () => {
  it('Tasks: строит step-узлы для всех 3 фикстурных STEP', async () => {
    const manifest = await loadManifest();
    const reader = createFsArtifactReader(PROJECT_ROOT);
    const tasks = resolveArtifactSources(manifest).find((s) => s.groupId === 'tasks')!;
    const children = await loadGroupChildren(tasks, reader);
    const ids = children.filter((n): n is Extract<HarnessNode, { kind: 'step' }> => n.kind === 'step').map((n) => n.data.id);
    expect(ids.sort()).toEqual(['STEP-001', 'STEP-002', 'STEP-003']);
  });

  it('Requirements: строит req-узлы из SPEC.md (несколько REQ в одном файле)', async () => {
    const manifest = await loadManifest();
    const reader = createFsArtifactReader(PROJECT_ROOT);
    const requirements = resolveArtifactSources(manifest).find((s) => s.groupId === 'requirements')!;
    const children = await loadGroupChildren(requirements, reader);
    const ids = children.filter((n): n is Extract<HarnessNode, { kind: 'req' }> => n.kind === 'req').map((n) => n.data.id);
    expect(ids.sort()).toEqual(['REQ-001', 'REQ-002']);
  });

  it('Architecture: architecture.md как file-узел + ADR как adr-узел', async () => {
    const manifest = await loadManifest();
    const reader = createFsArtifactReader(PROJECT_ROOT);
    const architecture = resolveArtifactSources(manifest).find((s) => s.groupId === 'architecture')!;
    const children = await loadGroupChildren(architecture, reader);
    expect(children.some((n) => n.kind === 'file')).toBe(true);
    const adrNodes = children.filter((n): n is Extract<HarnessNode, { kind: 'adr' }> => n.kind === 'adr');
    expect(adrNodes.map((n) => n.data.id)).toEqual(['ADR-001']);
  });

  it('ленивость: группа не читает файлы до вызова loadGroupChildren (счётчик вызовов порта)', async () => {
    const manifest = await loadManifest();
    let listCalls = 0;
    const baseReader = createFsArtifactReader(PROJECT_ROOT);
    const countingReader = {
      ...baseReader,
      list: (dir: string, glob: string) => {
        listCalls++;
        return baseReader.list(dir, glob);
      },
    };
    const sources = resolveArtifactSources(manifest);
    // Резолв источников сам по себе не должен ничего читать.
    expect(listCalls).toBe(0);
    const tasks = sources.find((s) => s.groupId === 'tasks')!;
    await loadGroupChildren(tasks, countingReader);
    expect(listCalls).toBe(1);
  });

  it('битый STEP-файл пропускается и отражается message-узлом, не роняет группу', async () => {
    const manifest = await loadManifest();
    const reader = createFsArtifactReader(PROJECT_ROOT);
    const brokenReader = {
      ...reader,
      read: async (relPath: string) => {
        if (relPath.endsWith('STEP-002.md')) return '';
        return reader.read(relPath);
      },
    };
    const tasks = resolveArtifactSources(manifest).find((s) => s.groupId === 'tasks')!;
    const children = await loadGroupChildren(tasks, brokenReader);
    expect(children.some((n) => n.kind === 'message' && n.messageKey === 'harness.explorer.message.readError')).toBe(true);
    const ids = children.filter((n): n is Extract<HarnessNode, { kind: 'step' }> => n.kind === 'step').map((n) => n.data.id);
    expect(ids.sort()).toEqual(['STEP-001', 'STEP-003']);
  });

  it('пустая группа даёт message-узел «нет артефактов», а не пустой массив', async () => {
    const reader = createFsArtifactReader(PROJECT_ROOT);
    const emptySource = { groupId: 'tasks' as const, items: [{ kind: 'dir' as const, relDir: 'does/not/exist', glob: '*.md' }] };
    const children = await loadGroupChildren(emptySource, reader, EMPTY_FILTER_STATE);
    expect(children).toEqual([{ kind: 'message', groupId: 'tasks', messageKey: 'harness.explorer.message.empty' }]);
  });
});
