import { rm } from 'node:fs/promises';
import { generatePerfProject } from '../../helpers/generatePerfProject';
import { createFsArtifactReader } from '../../../src/explorer/reader';
import { loadGroupChildren } from '../../../src/explorer/model';

/**
 * REQ-002 Acceptance: «Explorer загружается за <500ms на fixture-проекте с
 * 50 артефактами». Замер идёт через fs-порт (без VSCode-оверхеда) — то же,
 * что реально исполняет `treeProvider.getChildren` для группы Tasks.
 */
describe('perf: Tasks group на 50 STEP', () => {
  it('строится быстрее 500ms', async () => {
    const root = await generatePerfProject(50);
    try {
      const reader = createFsArtifactReader(root);
      const source = { groupId: 'tasks' as const, items: [{ kind: 'dir' as const, relDir: 'planning/tasks', glob: 'STEP-*.md', parseAs: 'step' as const }] };
      const start = performance.now();
      const children = await loadGroupChildren(source, reader);
      const elapsedMs = performance.now() - start;
      // eslint-disable-next-line no-console
      console.log(`perf: Tasks group (50 STEP) — ${elapsedMs.toFixed(1)}ms`);
      expect(children.filter((n) => n.kind === 'step')).toHaveLength(50);
      expect(elapsedMs).toBeLessThan(500);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
