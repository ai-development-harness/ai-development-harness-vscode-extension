import { extractIds, extractTableRows } from './markdownParser';
import { MarkdownParseError, ParseWarning, ReqStatusEntry, Result, err, ok } from './types';

/**
 * `docs/requirements/STATUS.md` — единственный canonical источник
 * lifecycle-статуса REQ (`AGENTS.md` §10). Отдельный артефакт от
 * `parseReqFile` (ADR-002: семейство labeled-markdown парсеров), т.к. это
 * markdown-таблица, а не bold-метки внутри секций.
 *
 * Колонки резолвятся по имени заголовка (не по индексу), чтобы пережить
 * будущий `UPDATE HARNESS`, меняющий шапку таблицы.
 */

const REQ_ID_RE = /^REQ-[A-Za-z0-9]+$/;

function normalizeCell(cell: string): string {
  return cell.replace(/^[`*]+/, '').replace(/[`*]+$/, '').trim();
}

export function parseReqStatus(
  content: string
): Result<{ data: ReqStatusEntry[]; warnings: ParseWarning[] }, MarkdownParseError> {
  if (content.trim().length === 0) return err({ kind: 'empty-content' });

  const rows = extractTableRows(content);
  if (rows.length === 0) return err({ kind: 'missing-table' });

  const header = rows[0];
  const dataRows = rows.slice(1);

  const colIndex = (name: string) => header.findIndex((cell) => normalizeCell(cell) === name);
  const reqCol = colIndex('REQ');
  const titleCol = colIndex('Название');
  const statusCol = colIndex('Статус');
  const stepsCol = colIndex('Реализующие STEP');
  const evidenceCol = colIndex('Evidence');

  const warnings: ParseWarning[] = [];
  if (statusCol < 0) warnings.push({ field: 'table.status', reason: 'колонка "Статус" не найдена' });

  const hasReqRow = dataRows.some((row) => reqCol >= 0 && REQ_ID_RE.test(normalizeCell(row[reqCol] ?? '')));
  if (reqCol < 0 || !hasReqRow) return err({ kind: 'missing-table' });

  const data: ReqStatusEntry[] = [];
  const seen = new Set<string>();
  dataRows.forEach((row, i) => {
    const id = normalizeCell(row[reqCol] ?? '');
    if (!REQ_ID_RE.test(id)) {
      warnings.push({ field: `row.${i}`, reason: `строка не начинается с REQ-NNN: "${row[reqCol] ?? ''}"` });
      return;
    }
    if (seen.has(id)) {
      warnings.push({ field: `${id}.duplicate`, reason: `повторяющийся id "${id}" — используется первая строка` });
      return;
    }
    seen.add(id);
    data.push({
      id,
      title: titleCol >= 0 ? normalizeCell(row[titleCol] ?? '') : '',
      status: statusCol >= 0 ? normalizeCell(row[statusCol] ?? '') : '',
      steps: stepsCol >= 0 ? extractIds(row[stepsCol] ?? '', 'STEP') : [],
      evidence: evidenceCol >= 0 ? (row[evidenceCol] ?? '').trim() : '',
    });
  });

  return ok({ data, warnings });
}

/** Удобный индекс для потребителей: id → status. */
export function reqStatusMap(entries: ReqStatusEntry[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const entry of entries) map.set(entry.id, entry.status);
  return map;
}
