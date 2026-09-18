import * as posix from 'node:path/posix';
import { ManifestData } from '../parser/types';

/**
 * REQ-002/ADR-001: единственное место, где путь превращается в источник узлов
 * дерева. Все пути — из `ManifestData`; `.project/manifest.yaml` — единственный
 * фиксированный self-path (тот же приём, что и `src/commands/activation.ts`).
 */

export type GroupId =
  | 'projectConfiguration'
  | 'requirements'
  | 'architecture'
  | 'tasks'
  | 'roadmap'
  | 'status'
  | 'reviews'
  | 'skills';

export const GROUP_IDS: readonly GroupId[] = [
  'projectConfiguration',
  'requirements',
  'architecture',
  'tasks',
  'roadmap',
  'status',
  'reviews',
  'skills',
];

/**
 * `parseAs` — какой parser layer применить к содержимому найденного файла,
 * решается здесь (единственное место, знающее и о путях, и о том, какой
 * артефакт по ним лежит), а не угадыванием по имени файла в `model.ts`.
 */
export type ArtifactSourceItem =
  | { kind: 'file'; relPath: string; parseAs?: 'req' }
  | { kind: 'dir'; relDir: string; glob: string; parseAs?: 'step' | 'adr' };

export interface ArtifactSource {
  groupId: GroupId;
  items: ArtifactSourceItem[];
}

/** Фиксированный self-path манифеста — не объявлен внутри самого себя (ADR-001). */
export const MANIFEST_REL_PATH = '.project/manifest.yaml';

/**
 * Каталог ADR не объявлен в `.project/manifest.yaml` (см. `OQ-004`,
 * `docs/OPEN_QUESTIONS.md`). Деривация из `sources.architecture`
 * (`docs/architecture.md` → `docs/adr`) — единственная строка, которую
 * потребуется поменять будущему ADR-005; вызывающий код проверяет
 * существование каталога через `ArtifactReader`, а не считает его обязательным.
 */
export function deriveAdrDir(manifest: ManifestData): string {
  return posix.join(posix.dirname(manifest.sources.architecture), 'adr');
}

export function resolveArtifactSources(manifest: ManifestData): ArtifactSource[] {
  return [
    { groupId: 'projectConfiguration', items: [{ kind: 'file', relPath: MANIFEST_REL_PATH }] },
    { groupId: 'requirements', items: [{ kind: 'file', relPath: manifest.sources.requirements, parseAs: 'req' }] },
    {
      groupId: 'architecture',
      items: [
        { kind: 'file', relPath: manifest.sources.architecture },
        { kind: 'dir', relDir: deriveAdrDir(manifest), glob: '*.md', parseAs: 'adr' },
      ],
    },
    {
      groupId: 'tasks',
      items: [{ kind: 'dir', relDir: manifest.protocol.taskDirectory, glob: 'STEP-*.md', parseAs: 'step' }],
    },
    { groupId: 'roadmap', items: [{ kind: 'file', relPath: manifest.sources.roadmap }] },
    { groupId: 'status', items: [{ kind: 'file', relPath: manifest.sources.status }] },
    {
      groupId: 'reviews',
      items: [{ kind: 'dir', relDir: manifest.protocol.reviewDirectory, glob: '**/*.md' }],
    },
    {
      groupId: 'skills',
      items: [
        { kind: 'file', relPath: manifest.protocol.skillRegistry },
        { kind: 'dir', relDir: manifest.protocol.skillSearchDirectory, glob: '*.md' },
      ],
    },
  ];
}
