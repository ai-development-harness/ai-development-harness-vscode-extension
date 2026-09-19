import {
  AdrAlternative,
  AdrData,
  AdrTraceability,
  MarkdownParseError,
  ParseWarning,
  ReqData,
  Result,
  StepData,
  StepImplementationPlan,
  StepMutationPolicy,
  StepReviewStatus,
  err,
  ok,
} from './types';

/**
 * ADR-002: STEP/REQ/ADR-файлы — labeled markdown (bold-метки внутри секций
 * `## <Section>`), не YAML frontmatter. Нераспознанное/пустое необязательное
 * поле даёт warning, не exception — парсер деградирует, а не падает.
 */

export interface MdSection {
  level: number;
  title: string;
  body: string;
}

const HEADING_RE = /^(#{1,6})\s+(.*)$/;
const BOLD_LABEL_RE = /^\*\*([^*:]+):\*\*\s*(.*)$/;
const LABELED_BULLET_RE = /^\s*-\s+([A-Za-zА-Яа-я /]+):\s*(.*)$/;
const BULLET_RE = /^\s*-\s+(.*)$/;

export function splitSections(content: string): MdSection[] {
  const lines = content.split(/\r?\n/);
  const sections: MdSection[] = [];
  let current: MdSection | null = null;
  for (const line of lines) {
    const match = HEADING_RE.exec(line);
    if (match) {
      if (current) sections.push(current);
      current = { level: match[1].length, title: match[2].trim(), body: '' };
    } else if (current) {
      current.body += line + '\n';
    }
  }
  if (current) sections.push(current);
  return sections;
}

export function findSectionIndex(sections: MdSection[], title: string, fromIndex = 0): number {
  for (let i = fromIndex; i < sections.length; i++) {
    if (sections[i].title === title) return i;
  }
  return -1;
}

/** Все секции, вложенные (по уровню) в секцию `index`, до следующей секции того же/более высокого уровня. */
export function childSections(sections: MdSection[], index: number): MdSection[] {
  const level = sections[index].level;
  const result: MdSection[] = [];
  for (let i = index + 1; i < sections.length; i++) {
    if (sections[i].level <= level) break;
    result.push(sections[i]);
  }
  return result;
}

/** Только непосредственные дети (минимальный вложенный уровень), напр. Allowed/Conditional/Forbidden. */
export function directChildSections(sections: MdSection[], index: number): MdSection[] {
  const all = childSections(sections, index);
  if (all.length === 0) return [];
  const directLevel = Math.min(...all.map((s) => s.level));
  return all.filter((s) => s.level === directLevel);
}

/** Текст секции вместе со всеми вложенными подсекциями (заголовки + тело), как в исходном markdown. */
export function deepText(sections: MdSection[], index: number): string {
  const parts = [sections[index].body];
  for (const child of childSections(sections, index)) {
    parts.push('#'.repeat(child.level) + ' ' + child.title);
    parts.push(child.body);
  }
  return parts.join('\n');
}

export function extractBoldLabels(text: string): Map<string, string> {
  const labels = new Map<string, string>();
  for (const line of text.split(/\r?\n/)) {
    const match = BOLD_LABEL_RE.exec(line.trim());
    if (match) {
      labels.set(match[1].trim(), match[2].trim());
    }
  }
  return labels;
}

export function extractLabeledBullets(text: string): Map<string, string> {
  const labels = new Map<string, string>();
  for (const line of text.split(/\r?\n/)) {
    const match = LABELED_BULLET_RE.exec(line);
    if (match) {
      labels.set(match[1].trim(), match[2].trim());
    }
  }
  return labels;
}

/** Количество точных меток нужно для fail-closed обработки дубликатов ссылок. */
function countBoldLabels(text: string, label: string): number {
  return text.split(/\r?\n/).filter((line) => BOLD_LABEL_RE.exec(line.trim())?.[1].trim() === label).length;
}

/** `Map` хранит только последнее значение, поэтому дубликаты считаются до извлечения. */
function countLabeledBullets(text: string, label: string): number {
  return text.split(/\r?\n/).filter((line) => LABELED_BULLET_RE.exec(line)?.[1].trim() === label).length;
}

export function extractBulletItems(text: string): string[] {
  const items: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    const match = BULLET_RE.exec(line);
    if (match) {
      const value = match[1].trim();
      if (value.length > 0) items.push(value);
    }
  }
  return items;
}

/**
 * Строки первой непрерывной markdown-таблицы: ячейки без внешних `|`, trim,
 * separator-строки (`---`/`:--`) отброшены. Примитив чистый, без знания о REQ.
 */
export function extractTableRows(text: string): string[][] {
  const isTableLine = (line: string) => line.trim().startsWith('|');
  const isSeparatorLine = (line: string) =>
    line
      .trim()
      .split('|')
      .map((cell) => cell.trim())
      .filter((cell) => cell.length > 0)
      .every((cell) => /^:?-+:?$/.test(cell));
  const toCells = (line: string): string[] => {
    const trimmed = line.trim();
    const withoutEdges = trimmed.replace(/^\|/, '').replace(/\|$/, '');
    return withoutEdges.split('|').map((cell) => cell.trim());
  };

  const lines = text.split(/\r?\n/);
  const rows: string[][] = [];
  let started = false;
  for (const line of lines) {
    if (isTableLine(line)) {
      started = true;
      if (!isSeparatorLine(line)) rows.push(toCells(line));
    } else if (started) {
      break;
    }
  }
  return rows;
}

export function extractIds(text: string, prefix: string): string[] {
  const re = new RegExp(`${prefix}-\\d+`, 'g');
  return text.match(re) ?? [];
}

/** Явные placeholders означают, что у артефакта пока нет конкретной STEP-связи. */
function isExplicitlyEmptyStepReference(value: string): boolean {
  return value === '—' || value === 'не запланирован' || value === 'STEP-NNN';
}

/**
 * STEP-поля со ссылками должны быть полными для destructive guard.
 * Частичное совпадение (например, `STEP-005, STEPP-009`) не доказывает,
 * что все входящие ссылки распознаны, поэтому парсер возвращает warning.
 */
function isValidStepReference(value: string): boolean {
  if (isExplicitlyEmptyStepReference(value)) return true;
  const tokens = value.split(',').map((token) => token.trim());
  return tokens.length > 0 && tokens.every((token) => /^STEP-\d+$/.test(token));
}

function splitCommaList(text: string): string[] {
  return text
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s !== '—');
}

function sectionTextOrWarn(sections: MdSection[], title: string, warnings: ParseWarning[]): string {
  const idx = findSectionIndex(sections, title);
  if (idx < 0) {
    warnings.push({ field: title, reason: `секция "${title}" не найдена` });
    return '';
  }
  return deepText(sections, idx).trim();
}

// ---------------------------------------------------------------------------
// STEP-NNN.md
// ---------------------------------------------------------------------------

const STEP_TITLE_RE = /^(STEP-[A-Za-z0-9]+)\s*—\s*(.*)$/;

export function parseStepFile(
  content: string
): Result<{ data: StepData; warnings: ParseWarning[] }, MarkdownParseError> {
  if (content.trim().length === 0) return err({ kind: 'empty-content' });
  const sections = splitSections(content);
  if (sections.length === 0) return err({ kind: 'missing-heading' });

  const warnings: ParseWarning[] = [];
  const root = sections[0];
  const titleMatch = STEP_TITLE_RE.exec(root.title);
  const id = titleMatch?.[1] ?? root.title;
  const title = titleMatch?.[2]?.trim() ?? '';
  if (!titleMatch) warnings.push({ field: 'title', reason: 'заголовок не соответствует формату "STEP-NNN — Название"' });

  const rootLabels = extractBoldLabels(root.body);
  const rootFieldMap: [string, string][] = [
    ['Статус', 'status'],
    ['Type', 'type'],
    ['Приоритет', 'priority'],
    ['Фаза', 'phase'],
  ];
  const rootValues: Record<string, string> = {};
  for (const [label, field] of rootFieldMap) {
    const value = rootLabels.get(label);
    if (value === undefined) {
      warnings.push({ field, reason: `метка "${label}" не найдена` });
      rootValues[field] = '';
    } else {
      rootValues[field] = value;
    }
  }
  const dependsOnRaw = rootLabels.get('Depends on');
  if (dependsOnRaw === undefined) {
    warnings.push({ field: 'dependsOn', reason: 'метка "Depends on" не найдена' });
  }
  if (countBoldLabels(root.body, 'Depends on') > 1) {
    warnings.push({ field: 'dependsOn', reason: 'метка "Depends on" повторяется' });
  }
  const dependsOn = dependsOnRaw ? extractIds(dependsOnRaw, 'STEP') : [];
  // Неполный список тоже опасен: `extractIds` мог распознать только его часть.
  if (dependsOnRaw !== undefined && !isValidStepReference(dependsOnRaw)) {
    warnings.push({ field: 'dependsOn', reason: 'значение "Depends on" не содержит корректный STEP ID' });
  }

  const requirementsIdx = findSectionIndex(sections, 'Requirements');
  if (requirementsIdx < 0) warnings.push({ field: 'requirements', reason: 'секция "Requirements" не найдена' });
  const requirements = requirementsIdx >= 0 ? extractIds(sections[requirementsIdx].body, 'REQ') : [];

  const adrIdx = findSectionIndex(sections, 'ADR');
  if (adrIdx < 0) warnings.push({ field: 'adr', reason: 'секция "ADR" не найдена' });
  const adr = adrIdx >= 0 ? extractIds(sections[adrIdx].body, 'ADR') : [];

  const riskFlagsIdx = findSectionIndex(sections, 'Risk flags');
  if (riskFlagsIdx < 0) warnings.push({ field: 'riskFlags', reason: 'секция "Risk flags" не найдена' });
  const riskFlags = riskFlagsIdx >= 0 ? extractBulletItems(sections[riskFlagsIdx].body).flatMap(splitCommaList) : [];

  const goal = sectionTextOrWarn(sections, 'Goal', warnings);
  const context = sectionTextOrWarn(sections, 'Context', warnings);

  const scopeIdx = findSectionIndex(sections, 'Scope');
  if (scopeIdx < 0) warnings.push({ field: 'scope', reason: 'секция "Scope" не найдена' });
  const scope = scopeIdx >= 0 ? extractBulletItems(sections[scopeIdx].body) : [];

  const mutationPolicy = extractMutationPolicy(sections, warnings);

  const outOfScopeIdx = findSectionIndex(sections, 'Out of scope');
  if (outOfScopeIdx < 0) warnings.push({ field: 'outOfScope', reason: 'секция "Out of scope" не найдена' });
  const outOfScope = outOfScopeIdx >= 0 ? extractBulletItems(sections[outOfScopeIdx].body) : [];

  const acceptanceIdx = findSectionIndex(sections, 'Acceptance criteria');
  if (acceptanceIdx < 0) warnings.push({ field: 'acceptanceCriteria', reason: 'секция "Acceptance criteria" не найдена' });
  const acceptanceCriteria = acceptanceIdx >= 0 ? extractBulletItems(sections[acceptanceIdx].body) : [];

  const verificationIdx = findSectionIndex(sections, 'Verification');
  if (verificationIdx < 0) warnings.push({ field: 'verification', reason: 'секция "Verification" не найдена' });
  const verification = verificationIdx >= 0 ? extractBulletItems(sections[verificationIdx].body) : [];

  const deliverablesIdx = findSectionIndex(sections, 'Deliverables');
  if (deliverablesIdx < 0) warnings.push({ field: 'deliverables', reason: 'секция "Deliverables" не найдена' });
  const deliverables = deliverablesIdx >= 0 ? extractBulletItems(sections[deliverablesIdx].body) : [];

  const implementationPlan = extractImplementationPlan(sections, warnings);
  const evidence = sectionTextOrWarn(sections, 'Evidence', warnings);
  const reviewStatus = extractReviewStatus(sections, warnings);
  const blocker = sectionTextOrWarn(sections, 'Blocker / Failure reason', warnings);

  return ok({
    data: {
      id,
      title,
      status: rootValues.status,
      type: rootValues.type,
      priority: rootValues.priority,
      phase: rootValues.phase,
      dependsOn,
      requirements,
      adr,
      riskFlags,
      goal,
      context,
      scope,
      mutationPolicy,
      outOfScope,
      acceptanceCriteria,
      verification,
      deliverables,
      implementationPlan,
      evidence,
      reviewStatus,
      blocker,
    },
    warnings,
  });
}

function extractMutationPolicy(sections: MdSection[], warnings: ParseWarning[]): StepMutationPolicy {
  const idx = findSectionIndex(sections, 'Mutation policy');
  if (idx < 0) {
    warnings.push({ field: 'mutationPolicy', reason: 'секция "Mutation policy" не найдена' });
    return { allowed: [], conditional: [], forbidden: [] };
  }
  const children = directChildSections(sections, idx);
  const byTitle = (t: string) => children.find((c) => c.title === t);
  const allowedSection = byTitle('Allowed');
  const conditionalSection = byTitle('Conditional');
  const forbiddenSection = byTitle('Forbidden');
  if (!allowedSection) warnings.push({ field: 'mutationPolicy.allowed', reason: 'подсекция "Allowed" не найдена' });
  if (!conditionalSection) warnings.push({ field: 'mutationPolicy.conditional', reason: 'подсекция "Conditional" не найдена' });
  if (!forbiddenSection) warnings.push({ field: 'mutationPolicy.forbidden', reason: 'подсекция "Forbidden" не найдена' });
  return {
    allowed: allowedSection ? extractBulletItems(allowedSection.body) : [],
    conditional: conditionalSection ? extractBulletItems(conditionalSection.body) : [],
    forbidden: forbiddenSection ? extractBulletItems(forbiddenSection.body) : [],
  };
}

function extractImplementationPlan(sections: MdSection[], warnings: ParseWarning[]): StepImplementationPlan {
  const idx = findSectionIndex(sections, 'Implementation plan');
  if (idx < 0) {
    warnings.push({ field: 'implementationPlan', reason: 'секция "Implementation plan" не найдена' });
    return { status: '', revision: '', plannedAt: '', body: '' };
  }
  const labels = extractBoldLabels(sections[idx].body);
  const status = labels.get('Plan status') ?? '';
  const revision = labels.get('Plan revision') ?? '';
  const plannedAt = labels.get('Planned at') ?? '';
  if (!labels.has('Plan status')) warnings.push({ field: 'implementationPlan.status', reason: 'метка "Plan status" не найдена' });
  if (!labels.has('Plan revision')) warnings.push({ field: 'implementationPlan.revision', reason: 'метка "Plan revision" не найдена' });
  if (!labels.has('Planned at')) warnings.push({ field: 'implementationPlan.plannedAt', reason: 'метка "Planned at" не найдена' });

  let body = deepText(sections, idx);
  for (const label of ['Plan status', 'Plan revision', 'Planned at']) {
    body = body.replace(new RegExp(`^\\*\\*${label}:\\*\\*.*$`, 'm'), '');
  }
  return { status, revision, plannedAt, body: body.trim() };
}

function extractReviewStatus(sections: MdSection[], warnings: ParseWarning[]): StepReviewStatus {
  const idx = findSectionIndex(sections, 'Review status');
  if (idx < 0) {
    warnings.push({ field: 'reviewStatus', reason: 'секция "Review status" не найдена' });
    return { latestVerdict: '', latestReport: '' };
  }
  const labels = extractBoldLabels(sections[idx].body);
  const latestVerdict = labels.get('Latest verdict') ?? '';
  const latestReport = labels.get('Latest report') ?? '';
  if (!labels.has('Latest verdict')) warnings.push({ field: 'reviewStatus.latestVerdict', reason: 'метка "Latest verdict" не найдена' });
  if (!labels.has('Latest report')) warnings.push({ field: 'reviewStatus.latestReport', reason: 'метка "Latest report" не найдена' });
  return { latestVerdict, latestReport };
}

// ---------------------------------------------------------------------------
// docs/requirements/SPEC.md (несколько REQ-NNN в одном файле)
// ---------------------------------------------------------------------------

const REQ_TITLE_RE = /^(REQ-[A-Za-z0-9]+)\s*—\s*(.*)$/;

export function parseReqSpec(
  content: string
): Result<{ data: ReqData[]; warnings: ParseWarning[] }, MarkdownParseError> {
  if (content.trim().length === 0) return err({ kind: 'empty-content' });
  const sections = splitSections(content);
  if (sections.length === 0) return err({ kind: 'missing-heading' });

  const reqIndices = sections.reduce<number[]>((acc, section, i) => {
    if (REQ_TITLE_RE.test(section.title)) acc.push(i);
    return acc;
  }, []);
  if (reqIndices.length === 0) return err({ kind: 'missing-heading' });

  const warnings: ParseWarning[] = [];
  const data: ReqData[] = [];

  for (const idx of reqIndices) {
    const section = sections[idx];
    const match = REQ_TITLE_RE.exec(section.title)!;
    const id = match[1];
    const title = match[2].trim();

    const labels = extractBoldLabels(section.body);
    const priority = labels.get('Приоритет') ?? '';
    const source = labels.get('Источник') ?? '';
    if (!labels.has('Приоритет')) warnings.push({ field: `${id}.priority`, reason: 'метка "Приоритет" не найдена' });
    if (!labels.has('Источник')) warnings.push({ field: `${id}.source`, reason: 'метка "Источник" не найдена' });

    const children = childSections(sections, idx);
    const findChild = (t: string) => children.find((c) => c.title === t);
    const requirementSection = findChild('Requirement');
    const rationaleSection = findChild('Rationale');
    const acceptanceSection = findChild('Acceptance');
    const traceabilitySections = children.filter((child) => child.title === 'Traceability');
    const traceabilitySection = traceabilitySections[0];
    if (!requirementSection) warnings.push({ field: `${id}.requirement`, reason: 'секция "Requirement" не найдена' });
    if (!rationaleSection) warnings.push({ field: `${id}.rationale`, reason: 'секция "Rationale" не найдена' });
    if (!acceptanceSection) warnings.push({ field: `${id}.acceptance`, reason: 'секция "Acceptance" не найдена' });
    if (!traceabilitySection) warnings.push({ field: `${id}.traceability`, reason: 'секция "Traceability" не найдена' });
    if (traceabilitySections.length > 1) {
      warnings.push({ field: `${id}.traceability`, reason: 'секция "Traceability" повторяется' });
    }

    const traceLabels = traceabilitySection ? extractLabeledBullets(traceabilitySection.body) : new Map<string, string>();
    if (traceabilitySection && !traceLabels.has('STEP')) {
      warnings.push({ field: `${id}.traceability.step`, reason: 'метка "STEP" не найдена в секции "Traceability"' });
    }
    if (traceabilitySection && countLabeledBullets(traceabilitySection.body, 'STEP') > 1) {
      warnings.push({ field: `${id}.traceability.step`, reason: 'метка "STEP" повторяется в секции "Traceability"' });
    }
    const traceSteps = traceLabels.get('STEP');
    if (traceSteps !== undefined && !isValidStepReference(traceSteps)) {
      warnings.push({ field: `${id}.traceability.step`, reason: 'значение "STEP" не содержит корректный STEP ID' });
    }

    data.push({
      id,
      title,
      priority,
      source,
      requirement: requirementSection ? requirementSection.body.trim() : '',
      rationale: rationaleSection ? rationaleSection.body.trim() : '',
      acceptance: acceptanceSection ? extractBulletItems(acceptanceSection.body) : [],
      traceability: {
        step: extractIds(traceLabels.get('STEP') ?? '', 'STEP'),
        adr: extractIds(traceLabels.get('ADR') ?? '', 'ADR'),
      },
    });
  }

  return ok({ data, warnings });
}

// ---------------------------------------------------------------------------
// docs/adr/ADR-NNN-*.md
// ---------------------------------------------------------------------------

const ADR_TITLE_RE = /^(ADR-[A-Za-z0-9]+)\s*—\s*(.*)$/;

export function parseAdrFile(
  content: string
): Result<{ data: AdrData; warnings: ParseWarning[] }, MarkdownParseError> {
  if (content.trim().length === 0) return err({ kind: 'empty-content' });
  const sections = splitSections(content);
  if (sections.length === 0) return err({ kind: 'missing-heading' });

  const warnings: ParseWarning[] = [];
  const root = sections[0];
  const titleMatch = ADR_TITLE_RE.exec(root.title);
  const id = titleMatch?.[1] ?? root.title;
  const title = titleMatch?.[2]?.trim() ?? '';
  if (!titleMatch) warnings.push({ field: 'title', reason: 'заголовок не соответствует формату "ADR-NNN — Название"' });

  const rootLabels = extractBoldLabels(root.body);
  const rootFieldMap: [string, string][] = [
    ['Status', 'status'],
    ['Date', 'date'],
    ['Deciders', 'deciders'],
    ['Supersedes', 'supersedes'],
    ['Superseded by', 'supersededBy'],
  ];
  const rootValues: Record<string, string> = {};
  for (const [label, field] of rootFieldMap) {
    const value = rootLabels.get(label);
    if (value === undefined) {
      warnings.push({ field, reason: `метка "${label}" не найдена` });
      rootValues[field] = '';
    } else {
      rootValues[field] = value;
    }
  }

  const context = sectionTextOrWarn(sections, 'Context', warnings);
  const problem = sectionTextOrWarn(sections, 'Problem', warnings);
  const decision = sectionTextOrWarn(sections, 'Decision', warnings);

  const alternativesIdx = findSectionIndex(sections, 'Alternatives considered');
  let alternativesConsidered: AdrAlternative[] = [];
  if (alternativesIdx >= 0) {
    alternativesConsidered = directChildSections(sections, alternativesIdx).map((child) => ({
      title: child.title,
      body: child.body.trim(),
    }));
  } else {
    warnings.push({ field: 'alternativesConsidered', reason: 'секция "Alternatives considered" не найдена' });
  }

  const consequences = sectionTextOrWarn(sections, 'Consequences', warnings);
  const securityImplications = sectionTextOrWarn(sections, 'Security implications', warnings);
  const dataMigrationImplications = sectionTextOrWarn(sections, 'Data / migration implications', warnings);
  const compatibilityImplications = sectionTextOrWarn(sections, 'Compatibility / operational implications', warnings);

  const traceabilityIdx = findSectionIndex(sections, 'Traceability');
  const traceabilitySectionCount = sections.filter((section) => section.title === 'Traceability').length;
  let traceability: AdrTraceability = { req: [], step: [] };
  if (traceabilityIdx >= 0) {
    const traceLabels = extractLabeledBullets(sections[traceabilityIdx].body);
    if (traceabilitySectionCount > 1) {
      warnings.push({ field: 'traceability', reason: 'секция "Traceability" повторяется' });
    }
    if (!traceLabels.has('STEP')) {
      warnings.push({ field: 'traceability.step', reason: 'метка "STEP" не найдена в секции "Traceability"' });
    }
    if (countLabeledBullets(sections[traceabilityIdx].body, 'STEP') > 1) {
      warnings.push({ field: 'traceability.step', reason: 'метка "STEP" повторяется в секции "Traceability"' });
    }
    const traceSteps = traceLabels.get('STEP');
    if (traceSteps !== undefined && !isValidStepReference(traceSteps)) {
      warnings.push({ field: 'traceability.step', reason: 'значение "STEP" не содержит корректный STEP ID' });
    }
    traceability = {
      req: extractIds(traceLabels.get('REQ') ?? '', 'REQ'),
      step: extractIds(traceLabels.get('STEP') ?? '', 'STEP'),
    };
  } else {
    warnings.push({ field: 'traceability', reason: 'секция "Traceability" не найдена' });
  }

  return ok({
    data: {
      id,
      title,
      status: rootValues.status,
      date: rootValues.date,
      deciders: rootValues.deciders,
      supersedes: rootValues.supersedes,
      supersededBy: rootValues.supersededBy,
      context,
      problem,
      decision,
      alternativesConsidered,
      consequences,
      securityImplications,
      dataMigrationImplications,
      compatibilityImplications,
      traceability,
    },
    warnings,
  });
}
