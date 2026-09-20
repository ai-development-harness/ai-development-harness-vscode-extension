import { deepText, findSectionIndex, parseStepFile, parseAdrFile, parseReqSpec, splitSections } from '../parser/markdownParser';
import * as vscode from 'vscode';

export interface EditorDiagnostic {
  message: string;
  offset: number;
  length: number;
  severity: 'error' | 'warning';
}

export interface StepEditorIndex {
  requirements: Map<string, IndexedEditorArtifact>;
  steps: Map<string, IndexedEditorStep>;
  adrs: Map<string, IndexedEditorArtifact>;
}

/** Канонический URI сохраняется вместе с parser result, чтобы providers не угадывали layout по ID. */
export interface IndexedEditorArtifact { title: string; uri?: vscode.Uri }
export interface IndexedEditorStep extends IndexedEditorArtifact { status: string; content: string }

export type Translate = (key: string, params?: Record<string, string>) => string;

/**
 * REQ-003: проверка остаётся чистой и advisory. Она не пишет STEP-файл и не
 * пытается восстановить отсутствующие artefact paths за пределами parser boundary.
 */
export function validateStepDocument(content: string, index: StepEditorIndex, t: Translate = (key) => key): EditorDiagnostic[] {
  const parsed = parseStepFile(content);
  if (!parsed.ok) return [diagnostic(content, 0, t('harness.editor.diagnostic.unparseable'), 'error')];
  const { data, warnings } = parsed.value;
  const diagnostics = warnings.map((warning) => diagnostic(content, 0, t('harness.editor.diagnostic.parseWarning', { field: warning.field, reason: warning.reason }), 'warning'));
  for (const [field, value] of Object.entries({ status: data.status, type: data.type, priority: data.priority, phase: data.phase, goal: data.goal, context: data.context })) {
    if (!value.trim()) diagnostics.push(diagnostic(content, 0, t('harness.editor.diagnostic.emptyField', { field }), 'error'));
  }
  for (const section of ['Requirements', 'ADR', 'Scope', 'Acceptance criteria', 'Verification', 'Deliverables']) {
    if (isSectionEmpty(content, section)) {
      diagnostics.push(diagnostic(content, 0, t('harness.editor.diagnostic.emptySection', { section }), 'error'));
    }
  }
  const referenceGroups: Array<[string, string[], Map<string, unknown>]> = [
    ['REQ', data.requirements, index.requirements],
    ['STEP', data.dependsOn, index.steps],
    ['ADR', data.adr, index.adrs],
  ];
  for (const [kind, ids, known] of referenceGroups) {
    for (const id of ids) {
      if (!known.has(id)) {
        const range = findReferenceInCanonicalField(content, kind, id);
        diagnostics.push(diagnostic(content, range.offset, t('harness.editor.diagnostic.missingReference', { kind, id }), 'error', range.length));
      }
    }
  }
  for (const dependency of data.dependsOn) {
    const step = index.steps.get(dependency);
    if (step && step.status !== 'Выполнено') {
      const range = findDependencyReference(content, dependency);
      diagnostics.push(
        diagnostic(content, range.offset, t('harness.editor.diagnostic.unsatisfiedDependency', { id: dependency }), 'warning', range.length)
      );
    }
  }
  if (hasCycle(data.id, index.steps, new Set(), new Set())) {
    diagnostics.push(diagnostic(content, 0, t('harness.editor.diagnostic.dependencyCycle'), 'error'));
  }
  const forbidden = new Set(data.outOfScope.map(normalize));
  for (const item of data.scope) {
    if (forbidden.has(normalize(item))) diagnostics.push(diagnostic(content, content.indexOf(item), t('harness.editor.diagnostic.scopeConflict'), 'error'));
  }
  return diagnostics;
}

/**
 * REQ-003: обязательность секции определяется её видимым Markdown-содержимым,
 * а не тем, извлёк ли Parser из текста ID или bullet. Реальные STEP допускают
 * prose в Requirements/ADR/Scope, и такой текст не должен стать ложной ошибкой.
 */
function isSectionEmpty(content: string, title: string): boolean {
  const sections = splitSections(content);
  const index = findSectionIndex(sections, title);
  return index < 0 || deepText(sections, index).trim().length === 0;
}

/**
 * Все hard dependencies находятся в единственной labeled-строке корня STEP.
 * Нельзя брать первый ID из всего файла: он может встречаться в Evidence или
 * тексте ниже и тогда hover показывает сообщение для другой зависимости.
 */
function findDependencyReference(content: string, id: string): { offset: number; length: number } {
  const label = /^\*\*Depends on:\*\*.*$/m.exec(content);
  const relative = label?.[0].indexOf(id) ?? -1;
  if (label?.index !== undefined && relative >= 0) return { offset: label.index + relative, length: id.length };
  return { offset: Math.max(0, content.indexOf(id)), length: id.length };
}

/**
 * REQ-003: битая ссылка должна подсвечиваться в owning labeled field, а не в
 * первом совпадении prose. Это сохраняет точную связь diagnostic с ошибкой.
 */
function findReferenceInCanonicalField(content: string, kind: string, id: string): { offset: number; length: number } {
  if (kind === 'STEP') return findDependencyReference(content, id);
  const section = findSectionContentRange(content, kind === 'REQ' ? 'Requirements' : 'ADR');
  const relative = section ? content.slice(section.start, section.end).indexOf(id) : -1;
  if (section && relative >= 0) return { offset: section.start + relative, length: id.length };
  return { offset: Math.max(0, content.indexOf(id)), length: id.length };
}

function findSectionContentRange(content: string, title: string): { start: number; end: number } | undefined {
  const heading = new RegExp(`^(#{1,6})\\s+${escapeRegExp(title)}\\s*$`, 'm').exec(content);
  if (!heading || heading.index === undefined) return undefined;
  const level = heading[1].length;
  const start = heading.index + heading[0].length;
  const next = new RegExp(`^#{1,${level}}\\s+`, 'gm');
  next.lastIndex = start;
  const boundary = next.exec(content);
  return { start, end: boundary?.index ?? content.length };
}

function escapeRegExp(value: string): string { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

function hasCycle(id: string, steps: Map<string, { content: string }>, visiting: Set<string>, visited: Set<string>): boolean {
  if (visiting.has(id)) return true;
  if (visited.has(id)) return false;
  const step = steps.get(id);
  if (!step) return false;
  visiting.add(id);
  const parsed = parseStepFile(step.content);
  const result = parsed.ok && parsed.value.data.dependsOn.some((dependency) => hasCycle(dependency, steps, visiting, visited));
  visiting.delete(id);
  visited.add(id);
  return result;
}

function normalize(value: string): string {
  return value.replace(/\s+/g, ' ').trim().toLocaleLowerCase();
}

function diagnostic(
  content: string,
  offset: number,
  message: string,
  severity: EditorDiagnostic['severity'],
  length = 1
): EditorDiagnostic {
  const safeOffset = Math.max(0, offset);
  return { message, offset: safeOffset, length: Math.max(1, Math.min(content.length - safeOffset, length)), severity };
}

export function createEditorIndex(sources: { requirements?: string; requirementsUri?: vscode.Uri; steps: Array<{ content: string; uri?: vscode.Uri }>; adrs: Array<{ content: string; uri?: vscode.Uri }> }): StepEditorIndex {
  const index: StepEditorIndex = { requirements: new Map(), steps: new Map(), adrs: new Map() };
  if (sources.requirements) {
    const requirements = parseReqSpec(sources.requirements);
    if (requirements.ok) for (const item of requirements.value.data) index.requirements.set(item.id, { title: item.title, uri: sources.requirementsUri });
  }
  for (const source of sources.steps) {
    const step = parseStepFile(source.content);
    if (step.ok) index.steps.set(step.value.data.id, { title: step.value.data.title, status: step.value.data.status, content: source.content, uri: source.uri });
  }
  for (const source of sources.adrs) {
    const adr = parseAdrFile(source.content);
    if (adr.ok) index.adrs.set(adr.value.data.id, { title: adr.value.data.title, uri: source.uri });
  }
  return index;
}
