import { parseStepFile } from '../parser/markdownParser';
import { Result, StepData, err, ok } from '../parser/types';

/**
 * REQ-002 Implementation plan п.6: минимально-диффовая запись в labeled
 * markdown STEP-файла поверх публичного API `src/parser/markdownParser.ts`
 * (`src/parser/**` не меняется). Fail-closed: если целевая метка/секция не
 * найдена — возвращается ошибка, файл не трогается. После каждой записи
 * содержимое перечитывается и переразбирается; действие считается успешным
 * только если изменилось РОВНО ожидаемое поле.
 */
export type StepWriteError =
  | { kind: 'label-not-found'; label: string }
  | { kind: 'section-not-found'; section: string }
  | { kind: 'verify-failed' };

const STATUS_LABEL_RE = /^(\*\*Статус:\*\*).*$/m;
const BLOCKER_HEADING = '## Blocker / Failure reason';
const NEXT_HEADING_RE = /\n##[^#]/;

function stepEqualExcept(a: StepData, b: StepData, fields: readonly (keyof StepData)[]): boolean {
  const normalize = (data: StepData): unknown => {
    const clone: Record<string, unknown> = { ...data };
    for (const field of fields) clone[field] = undefined;
    return clone;
  };
  return JSON.stringify(normalize(a)) === JSON.stringify(normalize(b));
}

/** Заменяет только тело секции `## Blocker / Failure reason`, без завязки на `$`/`m`-неоднозначность regex. */
function replaceBlockerSection(content: string, text: string): string | undefined {
  const headingIdx = content.indexOf(BLOCKER_HEADING);
  if (headingIdx < 0) return undefined;
  const afterHeading = headingIdx + BLOCKER_HEADING.length;
  const rest = content.slice(afterHeading);
  const nextHeadingMatch = NEXT_HEADING_RE.exec(rest);
  const sectionEnd = nextHeadingMatch ? afterHeading + nextHeadingMatch.index : content.length;
  return content.slice(0, headingIdx) + `${BLOCKER_HEADING}\n\n${text}\n` + content.slice(sectionEnd);
}

export function setStatus(content: string, status: string): Result<string, StepWriteError> {
  const before = parseStepFile(content);
  if (!before.ok) return err({ kind: 'verify-failed' });
  if (!STATUS_LABEL_RE.test(content)) return err({ kind: 'label-not-found', label: 'Статус' });

  const updated = content.replace(STATUS_LABEL_RE, `$1 ${status}`);
  const after = parseStepFile(updated);
  if (!after.ok) return err({ kind: 'verify-failed' });
  if (after.value.data.status !== status) return err({ kind: 'verify-failed' });
  if (!stepEqualExcept(before.value.data, after.value.data, ['status'])) return err({ kind: 'verify-failed' });

  return ok(updated);
}

export function setBlocker(content: string, text: string): Result<string, StepWriteError> {
  const before = parseStepFile(content);
  if (!before.ok) return err({ kind: 'verify-failed' });
  const updated = replaceBlockerSection(content, text);
  if (updated === undefined) return err({ kind: 'section-not-found', section: 'Blocker / Failure reason' });

  const after = parseStepFile(updated);
  if (!after.ok) return err({ kind: 'verify-failed' });
  if (after.value.data.blocker !== text.trim()) return err({ kind: 'verify-failed' });
  if (!stepEqualExcept(before.value.data, after.value.data, ['blocker'])) return err({ kind: 'verify-failed' });

  return ok(updated);
}

/**
 * FIX STEP-006 (F-005): `flagBlocker` needs to change both `status` and the
 * blocker text. Composing `setStatus` then `setBlocker` as two independent
 * writes leaves the file in `Заблокировано` with an empty reason if the
 * second write fails (e.g. the file has no `## Blocker / Failure reason`
 * section, which the protocol marks optional). This applies both
 * transformations to a single read and performs exactly one write.
 */
export function setStatusAndBlocker(content: string, status: string, text: string): Result<string, StepWriteError> {
  const before = parseStepFile(content);
  if (!before.ok) return err({ kind: 'verify-failed' });
  if (!STATUS_LABEL_RE.test(content)) return err({ kind: 'label-not-found', label: 'Статус' });

  const withStatus = content.replace(STATUS_LABEL_RE, `$1 ${status}`);
  const updated = replaceBlockerSection(withStatus, text);
  if (updated === undefined) return err({ kind: 'section-not-found', section: 'Blocker / Failure reason' });

  const after = parseStepFile(updated);
  if (!after.ok) return err({ kind: 'verify-failed' });
  if (after.value.data.status !== status) return err({ kind: 'verify-failed' });
  if (after.value.data.blocker !== text.trim()) return err({ kind: 'verify-failed' });
  if (!stepEqualExcept(before.value.data, after.value.data, ['status', 'blocker'])) return err({ kind: 'verify-failed' });

  return ok(updated);
}
