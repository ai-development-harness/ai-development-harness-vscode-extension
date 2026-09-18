import * as path from 'node:path';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import * as os from 'node:os';

/**
 * Синтетический проект с `count` STEP-файлами для перф-теста
 * `tests/unit/explorer/perf.test.ts` (Acceptance: «<500ms на 50 артефактах»).
 * Только `planning/tasks/STEP-*.md` — остальные группы дерева перф-тест не измеряет.
 */
export async function generatePerfProject(count: number): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'harness-explorer-perf-'));
  const tasksDir = path.join(root, 'planning', 'tasks');
  await mkdir(tasksDir, { recursive: true });

  const statuses = ['Запланировано', 'В работе', 'Выполнено', 'Заблокировано', 'Отменено', 'Заменено'];
  for (let i = 1; i <= count; i++) {
    const id = `STEP-${String(i).padStart(3, '0')}`;
    const status = statuses[i % statuses.length];
    await writeFile(path.join(tasksDir, `${id}.md`), stepFixture(id, status), 'utf8');
  }
  return root;
}

function stepFixture(id: string, status: string): string {
  return `# ${id} — Перф-фикстура

**Статус:** ${status}
**Type:** IMPLEMENTATION
**Приоритет:** Средний
**Фаза:** perf
**Depends on:** —

## Requirements

- не требуется

## ADR

- не требуется

## Risk flags

- none

## Goal

Perf fixture.

## Context

Perf fixture.

## Scope

- fixture only

## Mutation policy

### Allowed

- нет

### Conditional

- нет

### Forbidden

- нет

## Out of scope

- всё

## Acceptance criteria

- fixture only

## Verification

- N/A

## Deliverables

- N/A

## Implementation plan

**Plan status:** Planned
**Plan revision:** 1
**Planned at:** 2026-09-18

## Evidence

—

## Review status

**Latest verdict:** NOT REVIEWED
**Latest report:** —

## Blocker / Failure reason

—
`;
}
