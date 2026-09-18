import * as posix from 'node:path/posix';
import { parseAdrFile, parseReqSpec, parseStepFile } from '../parser/markdownParser';
import { AdrData, ReqData, StepData } from '../parser/types';
import { EMPTY_FILTER_STATE, FilterState, applyStepFilters, matchesIdQuery } from './filter';
import { ArtifactSource, GroupId } from './paths';
import { ArtifactReader } from './reader';

/**
 * REQ-002: дискриминированное объединение узлов дерева. `'message'` — явная
 * деградация (нет артефактов / не удалось прочитать часть файлов) вместо
 * пустого/исчезающего узла (Reliability §3 `docs/architecture.md`).
 */
export type HarnessNode =
  | { kind: 'group'; id: GroupId }
  | { kind: 'file'; uri: string; label: string; groupId: GroupId }
  | { kind: 'step'; uri: string; data: StepData; groupId: GroupId }
  | { kind: 'req'; uri: string; data: ReqData; groupId: GroupId }
  | { kind: 'adr'; uri: string; data: AdrData; groupId: GroupId }
  | { kind: 'message'; groupId: GroupId; messageKey: string; params?: Record<string, string> };

export function nodeId(node: HarnessNode): string {
  switch (node.kind) {
    case 'group':
      return `group:${node.id}`;
    case 'file':
      return `file:${node.uri}`;
    case 'step':
      return `step:${node.data.id}`;
    case 'req':
      return `req:${node.data.id}`;
    case 'adr':
      return `adr:${node.data.id}`;
    case 'message':
      return `message:${node.groupId}:${node.messageKey}`;
  }
}

async function buildNodesForFile(
  groupId: GroupId,
  relPath: string,
  parseAs: 'req' | 'adr' | 'step' | undefined,
  reader: ArtifactReader
): Promise<HarnessNode[] | undefined> {
  let content: string;
  try {
    content = await reader.read(relPath);
  } catch (e) {
    // FIX STEP-006 (F-006): the readError message told the user to "see
    // Output", but nothing ever wrote there — the failing path was
    // unidentifiable. Implementation plan п.9 already called for
    // `console.warn`; this restores it.
    console.warn(`[harness.explorer] failed to read ${relPath}:`, e);
    return undefined;
  }

  if (parseAs === 'step') {
    const parsed = parseStepFile(content);
    if (!parsed.ok) {
      console.warn(`[harness.explorer] failed to parse ${relPath} as STEP:`, parsed.error);
      return undefined;
    }
    return [{ kind: 'step', uri: relPath, data: parsed.value.data, groupId }];
  }
  if (parseAs === 'req') {
    const parsed = parseReqSpec(content);
    if (!parsed.ok) {
      console.warn(`[harness.explorer] failed to parse ${relPath} as REQ spec:`, parsed.error);
      return undefined;
    }
    return parsed.value.data.map((data) => ({ kind: 'req', uri: relPath, data, groupId }) as const);
  }
  if (parseAs === 'adr') {
    const parsed = parseAdrFile(content);
    if (!parsed.ok) {
      console.warn(`[harness.explorer] failed to parse ${relPath} as ADR:`, parsed.error);
      return undefined;
    }
    return [{ kind: 'adr', uri: relPath, data: parsed.value.data, groupId }];
  }
  return [{ kind: 'file', uri: relPath, label: posix.basename(relPath), groupId }];
}

/**
 * REQ-002 Implementation plan п.9: содержимое группы считается по требованию
 * (lazy loading) — вызывается только из `getChildren(group)`, не из корня
 * дерева. Нечитаемый/неразбираемый отдельный файл пропускается, не роняет
 * всю группу; общее число пропусков отражается узлом `'message'`, чтобы
 * молчаливая потеря артефактов была видна (та же деградация, что в `listStepFiles`).
 */
export async function loadGroupChildren(
  source: ArtifactSource,
  reader: ArtifactReader,
  filter: FilterState = EMPTY_FILTER_STATE
): Promise<HarnessNode[]> {
  const nodes: HarnessNode[] = [];
  let skipped = 0;

  for (const item of source.items) {
    const relPaths: string[] =
      item.kind === 'file' ? (await reader.exists(item.relPath)) ? [item.relPath] : [] : await reader.list(item.relDir, item.glob);
    const parseAs = item.parseAs;
    for (const relPath of relPaths) {
      const built = await buildNodesForFile(source.groupId, relPath, parseAs, reader);
      if (built) nodes.push(...built);
      else skipped++;
    }
  }

  const filtered = filterNodes(nodes, filter);

  if (filtered.length === 0 && skipped === 0) {
    return [{ kind: 'message', groupId: source.groupId, messageKey: 'harness.explorer.message.empty' }];
  }
  const result: HarnessNode[] = [...filtered];
  if (skipped > 0) {
    result.push({
      kind: 'message',
      groupId: source.groupId,
      messageKey: 'harness.explorer.message.readError',
      params: { count: String(skipped) },
    });
  }
  return result;
}

/**
 * Status/Type/Priority/Risk flags применяются только к `step`-узлам (у REQ
 * несовместимый набор статусов); `query` — ко всем ID-несущим узлам
 * (Implementation plan п.5).
 */
function filterNodes(nodes: HarnessNode[], filter: FilterState): HarnessNode[] {
  const stepNodes = nodes.filter((n): n is Extract<HarnessNode, { kind: 'step' }> => n.kind === 'step');
  const filteredStepIds = new Set(applyStepFilters(stepNodes.map((n) => n.data), filter).map((d) => d.id));

  return nodes.filter((node) => {
    if (node.kind === 'step') return filteredStepIds.has(node.data.id);
    if (node.kind === 'req') return matchesIdQuery(filter.query, node.data.id);
    if (node.kind === 'adr') return matchesIdQuery(filter.query, node.data.id);
    return true;
  });
}
