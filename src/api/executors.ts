import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { execFile, spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import commandTransitions from '../../.project/command-transitions.json';
import type { StepData } from '../parser/types';
import type { ExecutorResult, WriteInvocationPolicy } from './types';

export type ExecutorName = 'codex' | 'claude';
interface RunningInvocation { readonly child: ChildProcessWithoutNullStreams; cancelled: boolean; timeout?: NodeJS.Timeout; }
const MAX_DIAGNOSTIC_BYTES = 64 * 1024;
const MAX_CLAUDE_BYTES = 1024 * 1024;
const MAX_CODEX_JSONL_LINE_BYTES = 1024 * 1024;

/** Сопоставление использует только canonical CTS syntax, а не regex-префикс. */
export function requiresWriteAccess(command: string): boolean {
  return /^(PROJECT INIT|STEP ADD: .+|STEP (PLAN|IMPLEMENT|REVIEW|FIX|RUN) STEP-\d+|PROJECT QUICK FIX: .+|PROJECT RECONCILE)$/.test(command);
}

/** Неполная STEP policy не допускает workspace-wide write до spawn. */
export function writeInvocationPolicy(command: string, targetStep?: StepData): WriteInvocationPolicy | undefined {
  if (!requiresWriteAccess(command)) return { requiresWrite: false, command, allowedPaths: [] };
  if (/^STEP (PLAN|IMPLEMENT|REVIEW|FIX|RUN) STEP-\d+$/.test(command)) {
    const allowedPaths = targetStep?.mutationPolicy?.allowed;
    return targetStep && Array.isArray(allowedPaths) && allowedPaths.length > 0 ? { requiresWrite: true, command, allowedPaths } : undefined;
  }
  return { requiresWrite: true, command, allowedPaths: ['project-managed artifacts'] };
}

export function executorArgs(name: ExecutorName, workspace: string, writeAccess: boolean): string[] {
  if (name === 'codex') return ['exec', '--json', '-s', writeAccess ? 'workspace-write' : 'read-only', '-C', workspace, '--ephemeral'];
  return ['-p', '--output-format', 'json', '--permission-mode', writeAccess ? 'acceptEdits' : 'plan', '--allowedTools', writeAccess ? 'Read,Edit,Write' : 'Read'];
}

type TransitionCommand = { readonly chainAllowed: boolean; readonly target: 'none' | 'step' | 'release-optional'; readonly input: 'none' | 'optional' | 'required' };
type TransitionDomain = { readonly chainEnabled: boolean; readonly continuationAliases?: Readonly<Record<string, string>>; readonly commands: Readonly<Record<string, TransitionCommand>>; readonly transitions: readonly { readonly from: string; readonly to: string }[] };

/**
 * Проверяет result через тот же machine-readable CTS graph, что и preflight.
 * Runtime не исполняет Python helper, поэтому здесь намеренно только generic
 * structural parser без собственной таблицы команд или эвристик переходов.
 */
/**
 * Проверяет команду по bundled CTS graph до любого diagnostic sink. Это не
 * заменяет Python preflight, но не позволяет UI предложить заведомо
 * неканонический manual handoff между preflight и действием пользователя.
 */
export function isCanonicalCommand(value: string): boolean {
  const table = commandTransitions as { readonly chainSeparator: string; readonly domains: Readonly<Record<string, TransitionDomain>> };
  const segments = value.trim().split(table.chainSeparator).map((item) => item.trim());
  if (!segments.length || segments.some((item) => !item)) return false;
  let domainName: string | undefined;
  let inheritedTarget: string | undefined;
  const parsed: { operation: string; chainAllowed: boolean }[] = [];
  for (const [index, raw] of segments.entries()) {
    const explicitDomain = Object.keys(table.domains).find((name) => raw === name || raw.startsWith(`${name} `));
    if (index === 0 && !explicitDomain) return false;
    if (explicitDomain && domainName && explicitDomain !== domainName) return false;
    domainName ??= explicitDomain;
    if (!domainName) return false;
    const domain = table.domains[domainName];
    const remainder = explicitDomain ? raw.slice(explicitDomain.length).trim() : raw;
    const operationName = [...Object.keys(domain.commands), ...Object.keys(domain.continuationAliases ?? {})]
      .sort((left, right) => right.length - left.length)
      .find((operation) => remainder === operation || remainder.startsWith(`${operation} `) || remainder.startsWith(`${operation}:`));
    if (!operationName) return false;
    const operation = domain.commands[operationName] ? operationName : domain.continuationAliases?.[operationName];
    if (!operation) return false;
    const spec = domain.commands[operation];
    let rest = remainder.slice(operationName.length).trim();
    let target: string | undefined;
    if (spec.target === 'step') {
      const match = rest.match(/^(STEP-\d{3,})(?:\s+(.*))?$/);
      if (match) { target = match[1]; rest = match[2] ?? ''; }
      else target = inheritedTarget;
      if (!target) return false;
    } else if (spec.target === 'release-optional') {
      if (rest) {
        const match = rest.match(/^TO\s+(\S+)$/);
        if (!match) return false;
        target = match[1]; rest = '';
      } else target = inheritedTarget;
    }
    if (inheritedTarget && target && inheritedTarget !== target) return false;
    if (target) {
      if (index > 0 && !inheritedTarget) return false;
      inheritedTarget ??= target;
    }
    if (spec.input === 'none' && rest) return false;
    if (spec.input === 'required' && (!rest.startsWith(':') || !rest.slice(1).trim())) return false;
    if (spec.input === 'optional' && rest && (!rest.startsWith(':') || !rest.slice(1).trim())) return false;
    parsed.push({ operation, chainAllowed: spec.chainAllowed });
  }
  if (parsed.length === 1) return true;
  const domain = table.domains[domainName!];
  return domain.chainEnabled && parsed.every((item) => item.chainAllowed)
    && parsed.slice(1).every((item, index) => domain.transitions.some((edge) => edge.from === parsed[index].operation && edge.to === item.operation));
}

function containsSensitiveExternalData(value: string): boolean {
  return /(?:authorization\s*:\s*bearer\s+\S+|["']?(?:api[_-]?key|token|password|secret|access[_-]?token)["']?\s*[=:]|\b(?:ghp_[A-Za-z0-9]{20,}|sk-[A-Za-z0-9_-]{16,}|AKIA[A-Z0-9]{16})\b)/i.test(value);
}

function isSafeStructuredField(value: string): boolean {
  return !/[\r\n\u001b\x00-\x1f\x7f]/.test(value) && !containsSensitiveExternalData(value);
}
function structuredResult(raw: string): ExecutorResult {
  try {
    const payload = JSON.parse(raw) as { summary?: unknown; changedFiles?: unknown; nextCommand?: unknown };
    if (typeof payload.summary !== 'string' || !Array.isArray(payload.changedFiles) || !payload.changedFiles.every((file) => typeof file === 'string' && isSafeStructuredField(file)) || (payload.nextCommand !== null && (typeof payload.nextCommand !== 'string' || !isSafeStructuredField(payload.nextCommand) || !isCanonicalCommand(payload.nextCommand)))) throw new Error();
    return { ok: true, summary: sanitizeExternalText(payload.summary), changedFiles: payload.changedFiles as string[], nextCommand: payload.nextCommand as string | undefined };
  } catch { return { ok: false, errorKind: 'malformed', message: 'Агент не вернул JSON-результат ожидаемой schema.' }; }
}

export function normalizeCodex(output: string): ExecutorResult {
  try {
    const events = output.trim().split('\n').filter(Boolean).map((line) => JSON.parse(line) as { type?: string; error?: { message?: string }; item?: { text?: string } });
    const failure = events.find((event) => event.type === 'error' || event.type === 'turn.failed');
    if (failure) return { ok: false, errorKind: 'agent', message: failure.error?.message ?? 'Codex завершился с ошибкой.' };
    if (!events.some((event) => event.type === 'turn.completed')) return { ok: false, errorKind: 'malformed', message: 'Codex не вернул событие turn.completed.' };
    const text = events.map((event) => event.item?.text).filter((value): value is string => Boolean(value)).at(-1);
    return text ? structuredResult(text) : { ok: false, errorKind: 'malformed', message: 'Codex не вернул структурированный результат.' };
  } catch { return { ok: false, errorKind: 'malformed', message: 'Codex вернул некорректный JSONL.' }; }
}
export function normalizeClaude(output: string): ExecutorResult {
  try { const payload = JSON.parse(output) as { is_error?: boolean; result?: string; subtype?: string }; return payload.is_error ? { ok: false, errorKind: 'agent', message: sanitizeExternalText(payload.result ?? payload.subtype ?? 'Claude завершился с ошибкой.') } : typeof payload.result === 'string' ? structuredResult(payload.result) : { ok: false, errorKind: 'malformed', message: 'Claude не вернул структурированный результат.' }; } catch { return { ok: false, errorKind: 'malformed', message: 'Claude вернул некорректный JSON.' }; }
}

function isContained(root: string, candidate: string): boolean { const relative = path.relative(root, candidate); return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative)); }

/** Executable приходит только из явной абсолютной настройки: PATH не является boundary доверия. */
export async function resolveTrustedExecutable(name: ExecutorName | 'git', workspace: string, configuredPath?: string): Promise<string> {
  if (!configuredPath || !path.isAbsolute(configuredPath)) throw new Error(`Для ${name} требуется настроенный абсолютный путь к исполняемому файлу.`);
  const [resolved, realWorkspace] = await Promise.all([fs.realpath(configuredPath), fs.realpath(workspace)]);
  await fs.access(resolved, fs.constants.X_OK);
  if (isContained(realWorkspace, resolved)) throw new Error(`Исполняемый файл ${name} расположен внутри workspace.`);
  return resolved;
}

/**
 * Убирает форматирующие Unicode-категории до и после redaction: иначе ключ
 * секрета можно разорвать control byte и сохранить значение в diagnostic sink.
 */
export function sanitizeExternalText(value: string): string {
  const redact = (text: string): string => text
    .replace(/(authorization\s*:\s*bearer)\s+[^\s,"}]+/gi, '$1 [redacted]')
    .replace(/(["']?(?:api[_-]?key|token|password|secret|access[_-]?token)["']?\s*[=:]\s*)(?:"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|[^\s,}]+)/gi, '$1[redacted]')
    .replace(/\b(?:ghp_[A-Za-z0-9]{20,}|sk-[A-Za-z0-9_-]{16,}|AKIA[A-Z0-9]{16}|xox[baprs]-[A-Za-z0-9-]{10,})\b/g, '[redacted]');
  // Control byte внутри буквенного ключа не должен превращать `token` в две
  // безопасные на вид части до того, как credential pattern увидит ключ.
  const redactionReady = value.replace(/(?<=\p{L})[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]+(?=\p{L})/gu, '');
  const normalized = redact(redactionReady)
    .replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, '')
    .replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu, ' ')
    .slice(0, MAX_DIAGNOSTIC_BYTES);
  return redact(normalized);
}
/** ADR-009: CLI сама владеет login; child получает только non-secret runtime. */
export function executorEnvironment(name: ExecutorName, executable: string, inherited: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  void name;
  const environment: NodeJS.ProcessEnv = { PATH: `${path.dirname(executable)}${path.delimiter}/usr/bin${path.delimiter}/bin`, LANG: inherited.LANG ?? 'C' };
  for (const variable of process.platform === 'win32' ? ['USERPROFILE', 'HOMEDRIVE', 'HOMEPATH', 'SystemRoot'] : ['HOME']) if (inherited[variable] !== undefined) environment[variable] = inherited[variable];
  return environment;
}
/** Windows cancel использует только абсолютный system executable, никогда PATH/CWD lookup. */
export function windowsTaskkillExecutable(systemRoot = process.env.SystemRoot): string | undefined {
  return systemRoot && path.win32.isAbsolute(systemRoot) ? path.win32.join(systemRoot, 'System32', 'taskkill.exe') : undefined;
}
function terminateProcessTree(running: RunningInvocation): void {
  running.cancelled = true;
  const taskkill = windowsTaskkillExecutable();
  try { if (process.platform !== 'win32' && running.child.pid) process.kill(-running.child.pid, 'SIGTERM'); else if (running.child.pid && taskkill) execFile(taskkill, ['/pid', String(running.child.pid), '/t', '/f'], () => undefined); } catch { /* Уже завершён. */ }
  running.timeout = setTimeout(() => { try { if (process.platform !== 'win32' && running.child.pid) process.kill(-running.child.pid, 'SIGKILL'); else if (running.child.pid && taskkill) execFile(taskkill, ['/pid', String(running.child.pid), '/t', '/f'], () => undefined); } catch { /* Группа уже завершена. */ } }, 1500);
}

export class CliExecutor {
  private running: RunningInvocation | undefined;
  /**
   * CLI read-only/plan flags не изолируют filesystem. Пока отдельный adapter не
   * докажет path-scoped OS sandbox, automatic read-only вызов запрещён ADR-007.
   */
  constructor(
    private readonly executables: Partial<Record<ExecutorName, string>> = {},
    private readonly capabilities: Partial<Record<ExecutorName, { readonly readIsolation: boolean }>> = {},
    private readonly executableResolver: typeof resolveTrustedExecutable = resolveTrustedExecutable,
  ) {}
  cancel(): void { if (this.running && !this.running.cancelled) terminateProcessTree(this.running); }

  async invoke(name: ExecutorName, workspace: string, command: string, prompt: string, signal?: AbortSignal, targetStep?: StepData, onProgress?: (message: string) => void): Promise<ExecutorResult> {
    let cancelledBeforeSpawn = signal?.aborted ?? false;
    const onAbortBeforeSpawn = (): void => { cancelledBeforeSpawn = true; this.cancel(); };
    signal?.addEventListener('abort', onAbortBeforeSpawn, { once: true });
    const cancelled = (): ExecutorResult | undefined => cancelledBeforeSpawn || signal?.aborted
      ? { ok: false, cancelled: true, errorKind: 'cancelled' }
      : undefined;
    const finishBeforeSpawn = (result: ExecutorResult): ExecutorResult => {
      signal?.removeEventListener('abort', onAbortBeforeSpawn);
      return result;
    };
    if (cancelled()) return finishBeforeSpawn(cancelled()!);
    const policy = writeInvocationPolicy(command, targetStep);
    if (!policy) return finishBeforeSpawn({ ok: false, errorKind: 'pre-validation', message: 'Не удалось определить безопасную Mutation policy команды.' });
    // ADR-008 блокирует automatic write до resolution/spawn текущих CLI.
    if (policy.requiresWrite) return finishBeforeSpawn({ ok: false, errorKind: 'unavailable', message: 'Automatic write недоступен; используйте manual fallback.' });
    if (!policy.requiresWrite && !this.capabilities[name]?.readIsolation) {
      return finishBeforeSpawn({ ok: false, errorKind: 'unavailable', message: `Автоматический ${name} read-only запуск недоступен: executor не подтверждает OS-level path isolation.` });
    }
    let executable: string;
    try { executable = await this.executableResolver(name, workspace, this.executables[name]); } catch (error) { return finishBeforeSpawn({ ok: false, errorKind: 'unavailable', message: error instanceof Error ? error.message : String(error) }); }
    if (cancelled()) return finishBeforeSpawn(cancelled()!);
    // Bundle уменьшает передаваемые данные, но не является sandbox; capability
    // gate выше разрешает этот путь только adapter'у с OS-level isolation.
    let readBundle: string | undefined;
    let executionWorkspace = workspace;
    if (!policy.requiresWrite) {
      try {
        readBundle = await fs.mkdtemp(path.join(os.tmpdir(), 'harness-read-context-'));
        if (cancelled()) { await fs.rm(readBundle, { recursive: true, force: true }); return finishBeforeSpawn(cancelled()!); }
        await fs.writeFile(path.join(readBundle, 'CONTEXT.md'), prompt, { encoding: 'utf8', mode: 0o600 });
        executionWorkspace = readBundle;
      } catch (error) {
        return finishBeforeSpawn({ ok: false, errorKind: 'pre-validation', message: error instanceof Error ? error.message : String(error) });
      }
    }
    if (cancelled()) { void (readBundle && fs.rm(readBundle, { recursive: true, force: true })); return finishBeforeSpawn(cancelled()!); }
    return new Promise((resolve) => {
      let child: ChildProcessWithoutNullStreams;
      try { child = spawn(executable, executorArgs(name, executionWorkspace, policy.requiresWrite), { cwd: executionWorkspace, shell: false, detached: process.platform !== 'win32', env: executorEnvironment(name, executable) }); } catch (error) { void (readBundle && fs.rm(readBundle, { recursive: true, force: true })); resolve({ ok: false, errorKind: 'spawn', message: error instanceof Error ? sanitizeExternalText(error.message) : String(error) }); return; }
      const running: RunningInvocation = { child, cancelled: false }; this.running = running;
      if (cancelledBeforeSpawn || signal?.aborted) terminateProcessTree(running);
      const onAbort = (): void => this.cancel(); signal?.removeEventListener('abort', onAbortBeforeSpawn); signal?.addEventListener('abort', onAbort, { once: true });
      let stdout = ''; let codexLines = ''; let codexTerminal = ''; let codexCompleted = false; let codexError: ExecutorResult | undefined; let codexTooLarge = false; let claudeTooLarge = false; let stderr = ''; let stdinFailure: Error | undefined; let settled = false;
      const append = (value: string, chunk: string, limit = MAX_DIAGNOSTIC_BYTES): string => value.length < limit ? value + chunk.slice(0, limit - value.length) : value;
      const consumeCodexLine = (line: string): void => { try { const event = JSON.parse(line) as { type?: string; error?: { message?: string }; item?: { text?: string } }; if (event.type === 'error' || event.type === 'turn.failed') codexError = { ok: false, errorKind: 'agent', message: sanitizeExternalText(event.error?.message ?? 'Codex завершился с ошибкой.') }; if (event.item?.text) { if (event.item.text.length > MAX_CODEX_JSONL_LINE_BYTES) codexTooLarge = true; else if (event.type === 'item.completed') codexTerminal = event.item.text; } if (event.type === 'turn.completed') codexCompleted = true; if (event.type === 'item.progress') onProgress?.(sanitizeExternalText(`item.progress: ${event.item?.text ?? ''}`)); } catch { codexError ??= { ok: false, errorKind: 'malformed', message: 'Codex вернул некорректный JSONL.' }; } };
      child.stdout.setEncoding('utf8').on('data', (chunk: string) => { if (name === 'codex') { if (codexTooLarge) return; codexLines += chunk; if (codexLines.length > MAX_CODEX_JSONL_LINE_BYTES) { codexTooLarge = true; terminateProcessTree(running); return; } const lines = codexLines.split('\n'); codexLines = lines.pop() ?? ''; lines.forEach(consumeCodexLine); if (codexTooLarge) terminateProcessTree(running); } else { stdout = append(stdout, chunk, MAX_CLAUDE_BYTES); if (stdout.length >= MAX_CLAUDE_BYTES) claudeTooLarge = true; } });
      child.stderr.setEncoding('utf8').on('data', (chunk: string) => { stderr = append(stderr, chunk); });
      child.stdin.once('error', (error) => { stdinFailure = error; });
      const finish = (result: ExecutorResult): void => { if (settled) return; settled = true; signal?.removeEventListener('abort', onAbort); if (running.timeout) clearTimeout(running.timeout); if (this.running === running) this.running = undefined; void (readBundle && fs.rm(readBundle, { recursive: true, force: true })); resolve(result); };
      child.once('error', (error) => finish({ ok: false, errorKind: 'unavailable', message: sanitizeExternalText(error.message) }));
      child.once('close', (code) => {
        if (codexTooLarge) return finish({ ok: false, errorKind: 'too-large', message: 'Событие Codex превысило допустимый размер.' });
        if (running.cancelled || signal?.aborted) { setTimeout(() => finish({ ok: false, cancelled: true, errorKind: 'cancelled' }), running.timeout ? 1500 : 0); return; }
        if (stdinFailure) return finish({ ok: false, errorKind: 'spawn', message: sanitizeExternalText(stdinFailure.message) });
        if (code !== 0) return finish({ ok: false, errorKind: 'agent', message: sanitizeExternalText(stderr.trim() || `${name} завершился с кодом ${code}.`) });
        if (name === 'codex') { if (codexLines.trim()) consumeCodexLine(codexLines); finish(codexError ?? (codexCompleted && codexTerminal ? structuredResult(codexTerminal) : { ok: false, errorKind: 'malformed', message: 'Codex не вернул структурированный результат.' })); return; }
        finish(claudeTooLarge ? { ok: false, errorKind: 'too-large', message: 'Ответ Claude превысил допустимый размер.' } : normalizeClaude(stdout));
      });
      child.stdin.end(prompt);
    });
  }
}
