import * as vscode from 'vscode';
import { resolveHarnessArtifactPath } from '../parser/artifactPaths';
import { HARNESS_MANIFEST_REL_PATH } from '../parser/artifactPaths';
import { ManifestData } from '../parser/types';
import { GroupId } from './paths';

/**
 * REQ-002 Implementation plan п.10: `FileSystemWatcher` вместо
 * `onDidSaveTextDocument`/`onDidChangeTextDocument` — агент (ADR-004) пишет
 * файлы headless CLI мимо редактора, событие сохранения документа такие
 * изменения не видит. Debounce 250мс на группу: агент пишет пачками, без
 * батчинга — шторм refresh'ей.
 */
const DEBOUNCE_MS = 250;

export interface WatcherHandle {
  dispose(): void;
}

export interface WatchedPath {
  groupId: GroupId | 'manifest';
  relGlob: string;
}

/**
 * FIX STEP-015 (F-001): `STATUS.md` — фактический источник описаний REQ,
 * поэтому он должен инвалидировать ту же группу, что и `SPEC.md`. Функция
 * экспортирована только как чистый test seam; внешняя поверхность extension
 * по-прежнему создаёт watcher'ы исключительно через `createWatchers`.
 */
export function watchedPaths(manifest: ManifestData): WatchedPath[] {
  const requirementsStatus = resolveHarnessArtifactPath(manifest, 'requirementsStatus');
  const adrDirectory = resolveHarnessArtifactPath(manifest, 'adrDirectory');
  return [
    { groupId: 'manifest', relGlob: HARNESS_MANIFEST_REL_PATH },
    { groupId: 'requirements', relGlob: manifest.sources.requirements },
    ...(requirementsStatus ? [{ groupId: 'requirements' as const, relGlob: requirementsStatus }] : []),
    { groupId: 'architecture', relGlob: manifest.sources.architecture },
    ...(adrDirectory ? [{ groupId: 'architecture' as const, relGlob: `${adrDirectory}/**/*.md` }] : []),
    { groupId: 'tasks', relGlob: `${manifest.protocol.taskDirectory}/**/*.md` },
    { groupId: 'roadmap', relGlob: manifest.sources.roadmap },
    { groupId: 'status', relGlob: manifest.sources.status },
    { groupId: 'reviews', relGlob: `${manifest.protocol.reviewDirectory}/**/*.md` },
    { groupId: 'skills', relGlob: manifest.protocol.skillRegistry },
    { groupId: 'skills', relGlob: `${manifest.protocol.skillSearchDirectory}/**/*.md` },
  ];
}

/**
 * По одному `createFileSystemWatcher` на каждый объявленный в манифесте путь
 * плюс сам `.harness/manifest.yaml`. Изменение манифеста инвалидирует дерево
 * целиком (пути могли измениться) и вызывает `onManifestChanged`; остальные —
 * только свою группу через `onInvalidate(groupId)`.
 */
export function createWatchers(
  workspaceRoot: string,
  manifest: ManifestData,
  onInvalidate: (groupId?: GroupId) => void,
  onManifestChanged: () => void
): WatcherHandle[] {
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  const scheduleInvalidate = (key: string, run: () => void): void => {
    const existing = timers.get(key);
    if (existing) clearTimeout(existing);
    timers.set(
      key,
      setTimeout(() => {
        timers.delete(key);
        run();
      }, DEBOUNCE_MS)
    );
  };

  const handles: WatcherHandle[] = [];
  for (const { groupId, relGlob } of watchedPaths(manifest)) {
    const pattern = new vscode.RelativePattern(workspaceRoot, relGlob);
    const watcher = vscode.workspace.createFileSystemWatcher(pattern);
    const fire = (): void => {
      if (groupId === 'manifest') {
        scheduleInvalidate('manifest', onManifestChanged);
      } else {
        scheduleInvalidate(groupId, () => onInvalidate(groupId));
      }
    };
    watcher.onDidCreate(fire);
    watcher.onDidChange(fire);
    watcher.onDidDelete(fire);
    handles.push(watcher);
  }
  return handles;
}
