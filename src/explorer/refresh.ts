import * as vscode from 'vscode';
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

interface WatchedPath {
  groupId: GroupId | 'manifest';
  relGlob: string;
}

function watchedPaths(manifest: ManifestData): WatchedPath[] {
  return [
    { groupId: 'manifest', relGlob: '.project/manifest.yaml' },
    { groupId: 'requirements', relGlob: manifest.sources.requirements },
    { groupId: 'architecture', relGlob: `${manifest.sources.architecture.replace(/\/[^/]+$/, '')}/**/*.md` },
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
 * плюс сам `.project/manifest.yaml`. Изменение манифеста инвалидирует дерево
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
