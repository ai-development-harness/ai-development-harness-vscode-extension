import * as posix from 'node:path/posix';
import { ManifestData } from './types';

/**
 * Bootstrap manifest принадлежит текущему поколению Harness, а не consumer.
 * Все runtime consumers импортируют эту константу, поэтому legacy `.project`
 * layout не может вернуться как локальный fallback в одном из них.
 */
export const HARNESS_MANIFEST_REL_PATH = '.harness/manifest.yaml';

/**
 * Идентификаторы Harness-артефактов, которых нет в текущей schema manifest.
 * @see docs/adr/ADR-012-requirements-status-directory-anchor.md (Supersedes ADR-005)
 */
export type HarnessArtifactId = 'adrDirectory' | 'requirementsStatus';

type DeriveArtifactPath = (manifest: ManifestData) => string;

/**
 * Совместимые правила намеренно ограничены конкретным поколением Harness.
 * Новое поколение без зарегистрированного правила не получает guessed path:
 * consumer должен локально деградировать, пока schema не станет известна.
 *
 * `requirementsStatus`: ADR-012 (Supersedes ADR-005) — `sources.requirements`
 * в текущей manifest schema уже является каталогом (directory-anchor), не
 * file-anchor, поэтому `join`, а не `dirname(...)`.
 */
const VERSION_1_DERIVATIONS: Readonly<Record<HarnessArtifactId, DeriveArtifactPath>> = {
  adrDirectory: (manifest) => posix.join(posix.dirname(manifest.sources.architecture), 'adr'),
  requirementsStatus: (manifest) => posix.join(manifest.sources.requirements, 'STATUS.md'),
};

/**
 * Возвращает единственный allowlisted путь артефакта или `undefined`, когда
 * текущая generation manifest его не поддерживает. Explicit schema fields
 * добавляются сюда с приоритетом после их появления в `ManifestData`.
 */
export function resolveHarnessArtifactPath(manifest: ManifestData, artifactId: HarnessArtifactId): string | undefined {
  if (manifest.harness.version !== '1') return undefined;
  return VERSION_1_DERIVATIONS[artifactId](manifest);
}
