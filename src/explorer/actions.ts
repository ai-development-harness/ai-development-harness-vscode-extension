import * as path from 'node:path';
import { readFile, readdir } from 'node:fs/promises';
import * as vscode from 'vscode';
import type { I18nService } from '../locales/activation';
import { checkInitGuard } from '../commands/preDispatch';
import type { ValidationResult } from '../commands/preDispatch';
import { listStepFiles } from '../commands/stepPicker';
import { parseExecutionProtocol } from '../parser/executionProtocol';
import { parseAdrFile, parseReqSpec, parseStepFile } from '../parser/markdownParser';
import { AdrData, ManifestData, ReqData, StepData } from '../parser/types';
import { canDelete, canFlagBlocker, canMarkDone } from './guards';
import { collectPriorities, EMPTY_FILTER_STATE, FilterState, hasActiveFilters } from './filter';
import { HarnessNode } from './model';
import { deriveAdrDir } from './paths';
import { STATUS_ICONS } from './statusIcon';
import { setStatus, setStatusAndBlocker } from './stepWriter';
import { HarnessTreeDataProvider } from './treeProvider';

/**
 * REQ-002 Implementation plan п.11: **каждая** `harness.explorer.*` команда
 * принимает необязательный явный аргумент — в headless Extension Host
 * `showQuickPick` не резолвится (зафиксировано в Evidence STEP-005), поэтому
 * integration-тесты вызывают команды с явным аргументом, а не через диалог.
 */

async function listAllSteps(workspaceRoot: string, manifest: ManifestData): Promise<StepData[]> {
  const entries = await listStepFiles(workspaceRoot, manifest);
  return entries.map((e) => e.data);
}

async function listAllReqs(workspaceRoot: string, manifest: ManifestData): Promise<ReqData[]> {
  try {
    const content = await readFile(path.join(workspaceRoot, manifest.sources.requirements), 'utf8');
    const parsed = parseReqSpec(content);
    return parsed.ok ? parsed.value.data : [];
  } catch {
    return [];
  }
}

async function listAllAdrs(workspaceRoot: string, manifest: ManifestData): Promise<AdrData[]> {
  const dir = path.join(workspaceRoot, deriveAdrDir(manifest));
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return [];
  }
  const results = await Promise.all(
    entries
      .filter((f) => f.endsWith('.md'))
      .map(async (f) => {
        try {
          const content = await readFile(path.join(dir, f), 'utf8');
          const parsed = parseAdrFile(content);
          return parsed.ok ? parsed.value.data : undefined;
        } catch {
          return undefined;
        }
      })
  );
  return results.filter((r): r is AdrData => r !== undefined);
}

/**
 * FIX STEP-006 (F-003): `resolveTargetStep` may return a `StepData` taken
 * straight from the tree node passed by VSCode's context-menu — a snapshot
 * from whenever the group was last loaded. Guards over stale data are
 * fail-open (e.g. a since-superseded review PASS). Mutating actions must
 * re-read the STEP file immediately before evaluating a guard, using only
 * the resolved id from `resolveTargetStep`.
 */
async function readFreshStep(workspaceRoot: string, manifest: ManifestData, stepId: string): Promise<StepData | undefined> {
  const stepPath = path.join(workspaceRoot, manifest.protocol.taskDirectory, `${stepId}.md`);
  try {
    const bytes = await vscode.workspace.fs.readFile(vscode.Uri.file(stepPath));
    const parsed = parseStepFile(Buffer.from(bytes).toString('utf8'));
    return parsed.ok ? parsed.value.data : undefined;
  } catch {
    return undefined;
  }
}

async function readProtocolDimension(
  workspaceRoot: string,
  manifest: ManifestData,
  dimension: 'stepTypes' | 'riskFlags'
): Promise<string[]> {
  try {
    const content = await readFile(path.join(workspaceRoot, manifest.protocol.file), 'utf8');
    const parsed = parseExecutionProtocol(content);
    return parsed.ok ? parsed.value.data[dimension] : [];
  } catch {
    return [];
  }
}

function findStepNode(node: HarnessNode | undefined): StepData | undefined {
  return node?.kind === 'step' ? node.data : undefined;
}

async function resolveTargetStep(
  workspaceRoot: string,
  manifest: ManifestData,
  i18n: I18nService,
  arg: string | HarnessNode | undefined,
  promptKey: string
): Promise<StepData | undefined> {
  const fromNode = typeof arg === 'object' ? findStepNode(arg) : undefined;
  if (fromNode) return fromNode;

  const steps = await listAllSteps(workspaceRoot, manifest);
  if (typeof arg === 'string') {
    return steps.find((s) => s.id === arg);
  }
  const picked = await vscode.window.showQuickPick(
    steps.map((s) => ({ label: `${s.id} — ${s.title}`, description: s.status, step: s })),
    { placeHolder: i18n.t(promptKey) }
  );
  return picked?.step;
}

export async function refresh(provider: HarnessTreeDataProvider): Promise<void> {
  provider.invalidate();
}

export async function clearFilters(provider: HarnessTreeDataProvider): Promise<void> {
  provider.setFilterState(EMPTY_FILTER_STATE);
}

async function pickMultiValues(
  i18n: I18nService,
  promptKey: string,
  options: string[],
  explicit: string[] | undefined
): Promise<string[] | undefined> {
  if (explicit) return explicit;
  const picked = await vscode.window.showQuickPick(
    options.map((label) => ({ label })),
    { placeHolder: i18n.t(promptKey), canPickMany: true }
  );
  return picked?.map((p) => p.label);
}

function withDimension(state: FilterState, patch: Partial<FilterState>): FilterState {
  return { ...state, ...patch };
}

export async function filterByStatus(
  provider: HarnessTreeDataProvider,
  i18n: I18nService,
  explicit?: string[]
): Promise<void> {
  const values = await pickMultiValues(i18n, 'harness.explorer.prompt.filterStatus', Object.keys(STATUS_ICONS), explicit);
  if (values === undefined) return;
  provider.setFilterState(withDimension(provider.getFilterState(), { statuses: values }));
}

export async function filterByType(
  provider: HarnessTreeDataProvider,
  i18n: I18nService,
  workspaceRoot: string,
  manifest: ManifestData,
  explicit?: string[]
): Promise<void> {
  const options = await readProtocolDimension(workspaceRoot, manifest, 'stepTypes');
  const values = await pickMultiValues(i18n, 'harness.explorer.prompt.filterType', options, explicit);
  if (values === undefined) return;
  provider.setFilterState(withDimension(provider.getFilterState(), { types: values }));
}

export async function filterByPriority(
  provider: HarnessTreeDataProvider,
  i18n: I18nService,
  workspaceRoot: string,
  manifest: ManifestData,
  explicit?: string[]
): Promise<void> {
  const steps = await listAllSteps(workspaceRoot, manifest);
  const values = await pickMultiValues(i18n, 'harness.explorer.prompt.filterPriority', collectPriorities(steps), explicit);
  if (values === undefined) return;
  provider.setFilterState(withDimension(provider.getFilterState(), { priorities: values }));
}

export async function filterByRiskFlag(
  provider: HarnessTreeDataProvider,
  i18n: I18nService,
  workspaceRoot: string,
  manifest: ManifestData,
  explicit?: string[]
): Promise<void> {
  const options = await readProtocolDimension(workspaceRoot, manifest, 'riskFlags');
  const values = await pickMultiValues(i18n, 'harness.explorer.prompt.filterRiskFlag', options, explicit);
  if (values === undefined) return;
  provider.setFilterState(withDimension(provider.getFilterState(), { riskFlags: values }));
}

export async function search(provider: HarnessTreeDataProvider, i18n: I18nService, explicit?: string): Promise<void> {
  const query =
    explicit ?? (await vscode.window.showInputBox({ prompt: i18n.t('harness.explorer.prompt.search') }));
  if (query === undefined) return;
  provider.setFilterState(withDimension(provider.getFilterState(), { query }));
}

export function filtersDescription(i18n: I18nService, state: FilterState): string | undefined {
  if (!hasActiveFilters(state)) return undefined;
  const count = state.statuses.length + state.types.length + state.priorities.length + state.riskFlags.length + (state.query.trim() ? 1 : 0);
  return i18n.t('harness.explorer.view.filtersActive', { count: String(count) });
}

export async function openFile(workspaceRoot: string, node: HarnessNode | string | undefined): Promise<void> {
  const relPath = typeof node === 'string' ? node : node && 'uri' in node ? node.uri : undefined;
  if (!relPath) return;
  const uri = vscode.Uri.file(path.join(workspaceRoot, relPath));
  await vscode.commands.executeCommand('vscode.open', uri);
}

export async function viewInExplorer(workspaceRoot: string, node: HarnessNode | string | undefined): Promise<void> {
  const relPath = typeof node === 'string' ? node : node && 'uri' in node ? node.uri : undefined;
  if (!relPath) return;
  const uri = vscode.Uri.file(path.join(workspaceRoot, relPath));
  await vscode.commands.executeCommand('revealInExplorer', uri);
}

export async function markDone(
  workspaceRoot: string,
  manifest: ManifestData,
  i18n: I18nService,
  provider: HarnessTreeDataProvider,
  arg: string | HarnessNode | undefined
): Promise<void> {
  const initGuard = checkInitGuard(manifest, 'require-initialized');
  if (!initGuard.ok) {
    void vscode.window.showErrorMessage(i18n.t(initGuard.messageKey, initGuard.params));
    return;
  }
  const target = await resolveTargetStep(workspaceRoot, manifest, i18n, arg, 'harness.command.stepPicker.prompt');
  if (!target) return;
  const step = await readFreshStep(workspaceRoot, manifest, target.id);
  if (!step) {
    // FIX STEP-006 (F-015): файл переименован/удалён/повреждён между
    // загрузкой группы и кликом — fail-closed уже был, но пользователь видел
    // «ничего не произошло» без объяснения.
    void vscode.window.showErrorMessage(i18n.t('harness.explorer.error.stepUnreadable', { step: target.id }));
    return;
  }
  const guard = canMarkDone(step);
  if (!guard.ok) {
    void vscode.window.showErrorMessage(i18n.t(guard.messageKey, guard.params));
    return;
  }
  const confirmed = await vscode.window.showWarningMessage(
    i18n.t('harness.explorer.confirm.markDone', { step: step.id }),
    { modal: true },
    i18n.t('harness.explorer.confirm.yes')
  );
  if (confirmed !== i18n.t('harness.explorer.confirm.yes')) return;

  const stepPath = path.join(workspaceRoot, manifest.protocol.taskDirectory, `${step.id}.md`);
  // STEP-014 (F-018): re-guard on the same read that produces the written
  // content — the modal confirmation above has no time limit, so `guard`
  // computed before it may be stale by the time the user answers.
  await writeStepFile(stepPath, step.id, (fresh) => canMarkDone(fresh), (content) => setStatus(content, 'Выполнено'), i18n);
  provider.invalidate('tasks');
}

export async function flagBlocker(
  workspaceRoot: string,
  manifest: ManifestData,
  i18n: I18nService,
  provider: HarnessTreeDataProvider,
  arg: string | HarnessNode | undefined
): Promise<void> {
  const initGuard = checkInitGuard(manifest, 'require-initialized');
  if (!initGuard.ok) {
    void vscode.window.showErrorMessage(i18n.t(initGuard.messageKey, initGuard.params));
    return;
  }
  const target = await resolveTargetStep(workspaceRoot, manifest, i18n, arg, 'harness.command.stepPicker.prompt');
  if (!target) return;
  const reason = await vscode.window.showInputBox({ prompt: i18n.t('harness.explorer.prompt.blockerReason', { step: target.id }) });
  if (reason === undefined) return;
  const step = await readFreshStep(workspaceRoot, manifest, target.id);
  if (!step) {
    // FIX STEP-006 (F-015): см. аналогичную ветку в `markDone`.
    void vscode.window.showErrorMessage(i18n.t('harness.explorer.error.stepUnreadable', { step: target.id }));
    return;
  }
  const guard = canFlagBlocker(step, reason);
  if (!guard.ok) {
    void vscode.window.showErrorMessage(i18n.t(guard.messageKey, guard.params));
    return;
  }
  const stepPath = path.join(workspaceRoot, manifest.protocol.taskDirectory, `${step.id}.md`);
  // STEP-014 (F-018): closes the async gap between `readFreshStep` and the
  // second read inside `writeStepFile`, via the same guarded-write path as
  // `markDone` (no user-facing wait here, but re-guarding is now shared).
  await writeStepFile(
    stepPath,
    step.id,
    (fresh) => canFlagBlocker(fresh, reason),
    (content) => setStatusAndBlocker(content, 'Заблокировано', reason),
    i18n
  );
  provider.invalidate('tasks');
}

export async function createFollowUpStep(i18n: I18nService, arg: string | HarnessNode | undefined): Promise<void> {
  const stepId = typeof arg === 'string' ? arg : arg?.kind === 'step' ? arg.data.id : undefined;
  const prefill = stepId ? i18n.t('harness.explorer.prefill.followUp', { step: stepId }) : undefined;
  await vscode.commands.executeCommand('harness.addStep', prefill);
}

export async function deleteArtifact(
  workspaceRoot: string,
  manifest: ManifestData,
  i18n: I18nService,
  provider: HarnessTreeDataProvider,
  arg: string | HarnessNode | undefined
): Promise<void> {
  const initGuard = checkInitGuard(manifest, 'require-initialized');
  if (!initGuard.ok) {
    void vscode.window.showErrorMessage(i18n.t(initGuard.messageKey, initGuard.params));
    return;
  }
  const step = await resolveTargetStep(workspaceRoot, manifest, i18n, arg, 'harness.command.stepPicker.prompt');
  if (!step) return;
  const guard = await evaluateDeleteGuard(workspaceRoot, manifest, step.id);
  if (!guard.ok) {
    void vscode.window.showErrorMessage(i18n.t(guard.messageKey, guard.params));
    return;
  }
  const confirmed = await vscode.window.showWarningMessage(
    i18n.t('harness.explorer.confirm.delete', { step: step.id }),
    { modal: true },
    i18n.t('harness.explorer.confirm.yes')
  );
  if (confirmed !== i18n.t('harness.explorer.confirm.yes')) return;

  // STEP-014 (F-018): re-check incoming references right before the actual
  // delete — the modal above has no time limit, and a headless agent (ADR-004)
  // may add a referencing STEP/REQ/ADR while it is open.
  const reguard = await evaluateDeleteGuard(workspaceRoot, manifest, step.id);
  if (!reguard.ok) {
    void vscode.window.showErrorMessage(i18n.t(reguard.messageKey, reguard.params));
    return;
  }

  const uri = vscode.Uri.file(path.join(workspaceRoot, manifest.protocol.taskDirectory, `${step.id}.md`));
  await vscode.workspace.fs.delete(uri, { useTrash: true });
  provider.invalidate('tasks');
}

async function evaluateDeleteGuard(workspaceRoot: string, manifest: ManifestData, stepId: string): Promise<ValidationResult> {
  const [allSteps, allReqs, allAdrs] = await Promise.all([
    listAllSteps(workspaceRoot, manifest),
    listAllReqs(workspaceRoot, manifest),
    listAllAdrs(workspaceRoot, manifest),
  ]);
  return canDelete(stepId, allSteps, allReqs, allAdrs);
}

/**
 * STEP-014 (F-018): guarded write — the guard must be evaluated on the same
 * read that produces the written content, not on a read taken before an
 * unbounded modal confirmation. `reguard` runs on freshly re-read/parsed
 * content immediately before `transform`/`writeFile`; any failure (read
 * error, parse error, id mismatch, or the guard itself) is fail-closed and
 * reuses the same localized `messageKey` the pre-dialog guard would have
 * shown, without a second dialog.
 */
async function writeStepFile(
  absPath: string,
  expectedStepId: string,
  reguard: (fresh: StepData) => ValidationResult,
  transform: (content: string) => ReturnType<typeof setStatus>,
  i18n: I18nService
): Promise<boolean> {
  const uri = vscode.Uri.file(absPath);
  let content: string;
  try {
    const bytes = await vscode.workspace.fs.readFile(uri);
    content = Buffer.from(bytes).toString('utf8');
  } catch {
    void vscode.window.showErrorMessage(i18n.t('harness.explorer.error.stepUnreadable', { step: expectedStepId }));
    return false;
  }
  const parsed = parseStepFile(content);
  if (!parsed.ok || parsed.value.data.id !== expectedStepId) {
    void vscode.window.showErrorMessage(i18n.t('harness.explorer.error.stepUnreadable', { step: expectedStepId }));
    return false;
  }
  const guard = reguard(parsed.value.data);
  if (!guard.ok) {
    void vscode.window.showErrorMessage(i18n.t(guard.messageKey, guard.params));
    return false;
  }
  const result = transform(content);
  if (!result.ok) {
    void vscode.window.showErrorMessage(i18n.t('harness.explorer.error.writeFailed', { reason: result.error.kind }));
    return false;
  }
  await vscode.workspace.fs.writeFile(uri, Buffer.from(result.value, 'utf8'));
  return true;
}
