import * as vscode from 'vscode';
import type { I18nService } from '../locales/activation';
import { ManifestData } from '../parser/types';
import { EMPTY_FILTER_STATE, FilterState } from './filter';
import { HarnessNode, loadGroupChildren, nodeId } from './model';
import { ArtifactSource, GROUP_IDS, GroupId, resolveArtifactSources } from './paths';
import { ArtifactReader } from './reader';
import { toTreeItem } from './treeItem';

/**
 * REQ-002 Implementation plan п.9: тонкий vscode-слой поверх `model.ts`
 * (чистая логика) — `getChildren(undefined)` не читает файлы (8 групп из уже
 * разобранного при активации манифеста, это и есть lazy loading);
 * `getChildren(group)` считает содержимое по требованию и кладёт в кэш;
 * повторное раскрытие — из кэша, пока не вызван `invalidate`.
 */
export class HarnessTreeDataProvider implements vscode.TreeDataProvider<HarnessNode> {
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<HarnessNode | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  /**
   * FIX STEP-006 (F-013): не `readonly` — `setManifest` пересчитывает эту
   * ссылку, когда `.harness/manifest.yaml` меняется (например,
   * `protocol.taskDirectory`). До фикса провайдер хранил `sources`, вычисленные
   * один раз в конструкторе из первоначального манифеста, и продолжал
   * указывать на старые пути после перепарса манифеста в `activation.ts`.
   */
  private sources: ArtifactSource[];
  private readonly cache = new Map<GroupId, Promise<HarnessNode[]>>();
  private filterState: FilterState = EMPTY_FILTER_STATE;
  /**
   * FIX STEP-006 (F-001): VSCode's ExtHostTreeView identifies elements by
   * object reference (`Map` keyed by the node instance returned from
   * `getChildren`), not by structural equality. Re-allocating a fresh
   * `{ kind: 'group', id }` literal on every call means `fire()` targets an
   * object the host never saw, so the refresh silently no-ops. Group nodes
   * must therefore be stable singletons, created once and reused for both
   * `getChildren` and `fire`.
   */
  private readonly groupNodes: ReadonlyMap<GroupId, HarnessNode>;

  constructor(
    private readonly workspaceRoot: string,
    manifest: ManifestData,
    private readonly reader: ArtifactReader,
    private readonly i18n: I18nService
  ) {
    this.sources = resolveArtifactSources(manifest);
    this.groupNodes = new Map(GROUP_IDS.map((id) => [id, { kind: 'group', id } as const]));
  }

  getFilterState(): FilterState {
    return this.filterState;
  }

  /**
   * FIX STEP-006 (F-013): вызывается из колбэка перепарса манифеста в
   * `activation.ts`, когда сработал watcher на `.harness/manifest.yaml`.
   * Пересчитывает `sources` той же функцией, что и конструктор, сбрасывает
   * кэш групп и инвалидирует дерево — иначе смена, например,
   * `protocol.taskDirectory` не отражалась бы в дереве до перезапуска окна.
   */
  setManifest(manifest: ManifestData): void {
    this.sources = resolveArtifactSources(manifest);
    this.cache.clear();
    this.invalidate();
  }

  setFilterState(state: FilterState): void {
    this.filterState = state;
    this.invalidate();
  }

  /** Сброс кэша: без `groupId` — всего дерева (напр. после изменения манифеста), с `groupId` — точечно одной группы. */
  invalidate(groupId?: GroupId): void {
    if (groupId) {
      this.cache.delete(groupId);
      this._onDidChangeTreeData.fire(this.groupNodes.get(groupId));
    } else {
      this.cache.clear();
      this._onDidChangeTreeData.fire(undefined);
    }
  }

  getTreeItem(node: HarnessNode): vscode.TreeItem {
    return toTreeItem(node, this.workspaceRoot, this.i18n);
  }

  async getChildren(node?: HarnessNode): Promise<HarnessNode[]> {
    if (!node) {
      return GROUP_IDS.map((id) => this.groupNodes.get(id)!);
    }
    if (node.kind !== 'group') return [];
    if (!this.cache.has(node.id)) {
      const source = this.sources.find((s) => s.groupId === node.id);
      if (!source) {
        this.cache.set(node.id, Promise.resolve([]));
      } else {
        this.cache.set(node.id, loadGroupChildren(source, this.reader, this.filterState));
      }
    }
    return this.cache.get(node.id)!;
  }

  getParent(): undefined {
    // Плоская иерархия «группа → артефакты»: родитель артефакта — группа, но
    // явный обратный индекс не нужен ни одному потребителю STEP-006/007/008.
    return undefined;
  }
}

export function findNode(nodes: HarnessNode[], id: string): HarnessNode | undefined {
  return nodes.find((n) => nodeId(n) === id);
}
