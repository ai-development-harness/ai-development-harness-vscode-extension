import { ExecutionProtocolData, MarkdownParseError, ParseWarning, Result, err, ok } from './types';
import { MdSection, extractBulletItems, splitSections } from './markdownParser';

/**
 * Структурный разбор `planning/EXECUTION_PROTOCOL.md`: секции ищутся по
 * тексту заголовка без номера (номер раздела может сдвинуться при правке
 * протокола), команды — сканированием всех заголовков вида `` N. `TOKEN` ``
 * по всему файлу, без привязки к конкретным номерам разделов.
 */

const NUMBER_PREFIX_RE = /^\d+[A-Za-z]?\.\s*/;
const COMMAND_HEADING_RE = /^(\d+[A-Za-z]?)\.\s+`([^`]+)`/;
const BACKTICK_TOKEN_RE = /^`([^`]+)`/;

function stripNumberPrefix(title: string): string {
  return title.replace(NUMBER_PREFIX_RE, '').trim();
}

function findSectionByTitleText(sections: MdSection[], text: string): number {
  for (let i = 0; i < sections.length; i++) {
    if (stripNumberPrefix(sections[i].title) === text) return i;
  }
  return -1;
}

function extractBacktickTokens(text: string): string[] {
  const tokens: string[] = [];
  for (const item of extractBulletItems(text)) {
    const match = BACKTICK_TOKEN_RE.exec(item);
    if (match) tokens.push(match[1]);
  }
  return tokens;
}

function extractPlainBulletTokens(text: string): string[] {
  return extractBulletItems(text).map((item) => item.replace(/[.;]+$/, '').trim());
}

export function parseExecutionProtocol(
  content: string
): Result<{ data: ExecutionProtocolData; warnings: ParseWarning[] }, MarkdownParseError> {
  if (content.trim().length === 0) return err({ kind: 'empty-content' });
  const sections = splitSections(content);
  if (sections.length === 0) return err({ kind: 'missing-heading' });

  const warnings: ParseWarning[] = [];

  const stepTypesIdx = findSectionByTitleText(sections, 'Типы STEP');
  if (stepTypesIdx < 0) warnings.push({ field: 'stepTypes', reason: 'секция "Типы STEP" не найдена' });
  const stepTypes = stepTypesIdx >= 0 ? extractBacktickTokens(sections[stepTypesIdx].body) : [];

  const stepStatusesIdx = findSectionByTitleText(sections, 'Статусы STEP');
  if (stepStatusesIdx < 0) warnings.push({ field: 'stepStatuses', reason: 'секция "Статусы STEP" не найдена' });
  const stepStatuses = stepStatusesIdx >= 0 ? extractBacktickTokens(sections[stepStatusesIdx].body) : [];

  const requiredFieldsIdx = findSectionByTitleText(sections, 'Структура STEP');
  if (requiredFieldsIdx < 0) warnings.push({ field: 'requiredStepFields', reason: 'секция "Структура STEP" не найдена' });
  const requiredStepFields = requiredFieldsIdx >= 0 ? extractPlainBulletTokens(sections[requiredFieldsIdx].body) : [];

  const riskFlagsIdx = findSectionByTitleText(sections, 'Risk flags');
  if (riskFlagsIdx < 0) warnings.push({ field: 'riskFlags', reason: 'секция "Risk flags" не найдена' });
  const riskFlags = riskFlagsIdx >= 0 ? extractBacktickTokens(sections[riskFlagsIdx].body) : [];

  const commands = sections
    .map((section) => ({ section, match: COMMAND_HEADING_RE.exec(section.title) }))
    .filter((entry): entry is { section: MdSection; match: RegExpExecArray } => entry.match !== null)
    .map((entry) => ({ name: entry.match[2].trim(), sectionTitle: entry.section.title }));
  if (commands.length === 0) warnings.push({ field: 'commands', reason: 'ни одного заголовка команды не найдено' });

  return ok({
    data: { stepTypes, stepStatuses, requiredStepFields, riskFlags, commands },
    warnings,
  });
}
