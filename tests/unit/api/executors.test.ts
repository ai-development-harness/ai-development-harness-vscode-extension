import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { CliExecutor, executorArgs, executorEnvironment, normalizeClaude, normalizeCodex, requiresWriteAccess, resolveTrustedExecutable, sanitizeExternalText, windowsTaskkillExecutable, writeInvocationPolicy } from '../../../src/api/executors';
import { defaultGitExecutable } from '../../../src/git/gitHelper';

const result = JSON.stringify({ summary: 'Готово', changedFiles: ['src/api/types.ts'], nextCommand: 'STEP REVIEW STEP-009' });

describe('CLI executor policy', () => {
  it('не использует dangerous flags и оставляет читающую команду read-only', () => {
    const args = executorArgs('codex', '/workspace', false);
    expect(args).toEqual(['exec', '--json', '-s', 'read-only', '-C', '/workspace', '--ephemeral']);
    expect(args.join(' ')).not.toContain('dangerously');
  });

  it('требует write для всех canonical mutating STEP-команд', () => {
    for (const action of ['PLAN', 'IMPLEMENT', 'REVIEW', 'FIX', 'RUN']) expect(requiresWriteAccess(`STEP ${action} STEP-009`)).toBe(true);
    expect(requiresWriteAccess('PLAN STEP-009')).toBe(false);
    expect(executorArgs('claude', '/workspace', true)).toContain('acceptEdits');
  });

  it('не spawn-ит automatic write и не передаёт CLI credential/configuration environment', async () => {
    const executable = path.join(os.tmpdir(), 'trusted-codex');
    const inherited = { OPENAI_API_KEY: 'secret', ANTHROPIC_AUTH_TOKEN: 'secret', HTTPS_PROXY: 'https://proxy', SSL_CERT_FILE: '/cert', GIT_CONFIG_COUNT: '1', UNRELATED_SECRET: 'must-not-pass', HOME: '/home/test', LANG: 'ru_RU.UTF-8' };
    for (const name of ['codex', 'claude'] as const) {
      const environment = executorEnvironment(name, executable, inherited);
      expect(environment).toEqual(expect.objectContaining({ HOME: '/home/test', LANG: 'ru_RU.UTF-8' }));
      for (const variable of ['OPENAI_API_KEY', 'ANTHROPIC_AUTH_TOKEN', 'HTTPS_PROXY', 'SSL_CERT_FILE', 'GIT_CONFIG_COUNT', 'UNRELATED_SECRET']) expect(environment[variable]).toBeUndefined();
    }
    await expect(new CliExecutor({ codex: executable }).invoke('codex', process.cwd(), 'STEP FIX STEP-009', 'контекст', undefined, { mutationPolicy: { allowed: ['src/api/**'] } } as never))
      .resolves.toEqual(expect.objectContaining({ ok: false, errorKind: 'unavailable' }));
  });

  it('редактирует credential, split key, Unicode control и CRLF до публикации результата', () => {
    expect(sanitizeExternalText('Authorization: Bearer secret-value\r\n\u001b[31m{"token":"json secret value"} ghp_abcdefghijklmnopqrstuvwxyz')).toBe('Authorization: Bearer [redacted]  {"token":[redacted]} [redacted]');
    const sanitized = sanitizeExternalText('to\rken=real-secret xoxb-1234567890-secret\u2028\u202E');
    expect(sanitized).toContain('token=[redacted]');
    expect(sanitized).not.toMatch(/real-secret|xoxb-|[\r\n\u2028\u2029\u202e]/u);
  });

  it('нормализует структурированные результаты Codex и Claude', () => {
    expect(normalizeCodex(`${JSON.stringify({ type: 'item.completed', item: { text: result } })}\n${JSON.stringify({ type: 'turn.completed' })}\n`))
      .toEqual({ ok: true, summary: 'Готово', changedFiles: ['src/api/types.ts'], nextCommand: 'STEP REVIEW STEP-009' });
    expect(normalizeClaude(JSON.stringify({ is_error: false, result })))
      .toEqual({ ok: true, summary: 'Готово', changedFiles: ['src/api/types.ts'], nextCommand: 'STEP REVIEW STEP-009' });
  });

  it('принимает весь canonical CTS surface для nextCommand', () => {
    for (const nextCommand of ['GIT CHECK', 'PROJECT STATUS', 'STEP NEXT', 'GIT CHECK > COMMIT > PUSH > PR', 'STEP PLAN STEP-009 > IMPLEMENT > REVIEW', 'HARNESS UPDATE CHECK TO v0.5.0 > APPLY']) {
      expect(normalizeClaude(JSON.stringify({ is_error: false, result: JSON.stringify({ summary: 'Готово', changedFiles: [], nextCommand }) })))
        .toEqual(expect.objectContaining({ ok: true, nextCommand }));
    }
  });

  it('отклоняет nextCommand, который structural CTS validator не примет', () => {
    for (const nextCommand of [
      'HARNESS UPDATE CHECK > APPLY TO v0.5.0',
      'STEP PLAN STEP-009 > IMPLEMENT STEP-010',
      'GIT CHECK > STEP PLAN STEP-009',
    ]) {
      expect(normalizeClaude(JSON.stringify({ is_error: false, result: JSON.stringify({ summary: 'Готово', changedFiles: [], nextCommand }) })))
        .toEqual(expect.objectContaining({ ok: false, errorKind: 'malformed' }));
    }
  });

  it('отклоняет secret-shaped changedFiles и nextCommand до UI boundary', () => {
    for (const payload of [
      { summary: 'Готово', changedFiles: ['token=real-secret'], nextCommand: null },
      { summary: 'Готово', changedFiles: [], nextCommand: 'GIT COMMIT: token=real-secret' },
    ]) {
      expect(normalizeClaude(JSON.stringify({ is_error: false, result: JSON.stringify(payload) })))
        .toEqual(expect.objectContaining({ ok: false, errorKind: 'malformed' }));
    }
  });

  it('отклоняет неполный или malformed transport result', () => {
    expect(normalizeCodex(JSON.stringify({ type: 'turn.completed' }))).toEqual(expect.objectContaining({ ok: false, errorKind: 'malformed' }));
    expect(normalizeClaude(JSON.stringify({ is_error: false, result: 'обычный текст' }))).toEqual(expect.objectContaining({ ok: false, errorKind: 'malformed' }));
    expect(normalizeClaude(JSON.stringify({ is_error: false, result: JSON.stringify({ summary: 'без путей', nextCommand: null }) }))).toEqual(expect.objectContaining({ ok: false, errorKind: 'malformed' }));
    expect(normalizeClaude(JSON.stringify({ is_error: false, result: JSON.stringify({ summary: 'без команды', changedFiles: [] }) }))).toEqual(expect.objectContaining({ ok: false, errorKind: 'malformed' }));
    expect(normalizeClaude(JSON.stringify({ is_error: false, result: JSON.stringify({ summary: 'плохая команда', changedFiles: [], nextCommand: 'DROP TABLE' }) }))).toEqual(expect.objectContaining({ ok: false, errorKind: 'malformed' }));
  });

  it('передаёт prompt через stdin и разбирает результат реального argv-process', async () => {
    const binDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'harness-cli-'));
    const capturedPrompt = path.join(binDirectory, 'prompt.txt');
    const executable = path.join(binDirectory, 'codex');
    await fs.writeFile(executable, `#!/bin/sh\ncat > \"${capturedPrompt}\"\nprintf '%s\\n' '${JSON.stringify({ type: 'item.completed', item: { text: result } }).replace(/'/g, "'\\\"'\\\"'")}'\nprintf '%s\\n' '${JSON.stringify({ type: 'turn.completed' })}'\n`);
    await fs.chmod(executable, 0o755);
    const oldPath = process.env.PATH;
    process.env.PATH = `${binDirectory}${path.delimiter}${oldPath}`;
    try {
      await expect(new CliExecutor({ codex: executable }, { codex: { readIsolation: true } }).invoke('codex', process.cwd(), 'STEP AUDIT STEP-009', 'контекст через stdin')).resolves.toEqual(expect.objectContaining({ ok: true, summary: 'Готово' }));
      await expect(fs.readFile(capturedPrompt, 'utf8')).resolves.toBe('контекст через stdin');
    } finally {
      process.env.PATH = oldPath;
      await fs.rm(binDirectory, { recursive: true, force: true });
    }
  });

  it('сохраняет terminal result после progress JSONL больше diagnostic limit', async () => {
    const binDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'harness-jsonl-'));
    const executable = path.join(binDirectory, 'codex');
    const event = JSON.stringify({ type: 'item.completed', item: { text: result } }).replace(/'/g, "'\\\"'\\\"'");
    await fs.writeFile(executable, `#!/bin/sh\ncat >/dev/null\nprintf '%s\\n' '{"type":"item.progress","item":{"text":"working"}}'\n/usr/bin/yes '{"type":"item.progress"}' | /usr/bin/head -n 5000\nprintf '%s\\n' '${event}'\nprintf '%s\\n' '{"type":"turn.completed"}'\n`);
    await fs.chmod(executable, 0o755);
    try {
      const progress: string[] = [];
      await expect(new CliExecutor({ codex: executable }, { codex: { readIsolation: true } }).invoke('codex', process.cwd(), 'STEP AUDIT STEP-009', 'контекст', undefined, undefined, (message) => progress.push(message))).resolves.toEqual(expect.objectContaining({ ok: true, summary: 'Готово' }));
      expect(progress).toContain('item.progress: working');
    } finally { await fs.rm(binDirectory, { recursive: true, force: true }); }
  });

  it('возвращает typed agent error для non-zero executor без разбора stdout', async () => {
    const binDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'harness-failure-'));
    const executable = path.join(binDirectory, 'codex');
    await fs.writeFile(executable, '#!/bin/sh\ncat >/dev/null\nprintf "%s" "agent failed" >&2\nexit 7\n');
    await fs.chmod(executable, 0o755);
    const oldPath = process.env.PATH;
    process.env.PATH = `${binDirectory}${path.delimiter}${oldPath}`;
    try {
      await expect(new CliExecutor({ codex: executable }, { codex: { readIsolation: true } }).invoke('codex', process.cwd(), 'STEP AUDIT STEP-009', 'контекст'))
        .resolves.toEqual({ ok: false, errorKind: 'agent', message: 'agent failed' });
    } finally {
      process.env.PATH = oldPath;
      await fs.rm(binDirectory, { recursive: true, force: true });
    }
  });

  it('не запускает executor, если invocation отменён до spawn', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(new CliExecutor().invoke('codex', process.cwd(), 'PROJECT INIT', 'контекст', controller.signal))
      .resolves.toEqual({ ok: false, cancelled: true, errorKind: 'cancelled' });
  });

  it('не резолвит и не spawn-ит ни одну canonical write command family', async () => {
    const resolver = jest.fn(async (): Promise<string> => { throw new Error('resolver не должен вызываться'); });
    const executor = new CliExecutor({ codex: path.join(os.tmpdir(), 'codex'), claude: path.join(os.tmpdir(), 'claude') }, {}, resolver as never);
    const commands = [
      ['PROJECT INIT'], ['STEP ADD: новое требование'], ['STEP PLAN STEP-009'], ['STEP IMPLEMENT STEP-009'],
      ['STEP REVIEW STEP-009'], ['STEP FIX STEP-009'], ['STEP RUN STEP-009'], ['PROJECT QUICK FIX: опечатка'], ['PROJECT RECONCILE'],
    ] as const;
    for (const name of ['codex', 'claude'] as const) {
      for (const [command] of commands) {
        await expect(executor.invoke(name, process.cwd(), command, 'контекст', undefined, command.startsWith('STEP ') ? { mutationPolicy: { allowed: ['src/**'] } } as never : undefined))
          .resolves.toEqual(expect.objectContaining({ ok: false, errorKind: 'unavailable' }));
      }
    }
    expect(resolver).not.toHaveBeenCalled();
  });

  it('не запускает read-only CLI без подтверждённой OS-level isolation и не раскрывает decoy secret', async () => {
    const binDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'harness-read-boundary-'));
    const executable = path.join(binDirectory, 'codex');
    const spawned = path.join(binDirectory, 'spawned.txt');
    const decoy = path.join(binDirectory, '.env');
    await fs.writeFile(decoy, 'SECRET=decoy-value');
    await fs.writeFile(executable, `#!/bin/sh\nprintf spawned > "${spawned}"\ncat "${decoy}" >&2\n`);
    await fs.chmod(executable, 0o755);
    try {
      await expect(new CliExecutor({ codex: executable }).invoke('codex', process.cwd(), 'STEP AUDIT STEP-009', 'прочитай .env'))
        .resolves.toEqual(expect.objectContaining({ ok: false, errorKind: 'unavailable' }));
      await expect(fs.access(spawned)).rejects.toThrow();
    } finally { await fs.rm(binDirectory, { recursive: true, force: true }); }
  });

  it('не spawn-ит процесс, если cancel приходит во время pre-spawn resolution', async () => {
    const binDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'harness-pre-spawn-cancel-'));
    const executable = path.join(binDirectory, 'codex');
    const spawned = path.join(binDirectory, 'spawned.txt');
    await fs.writeFile(executable, `#!/bin/sh\nprintf spawned > "${spawned}"\n`);
    await fs.chmod(executable, 0o755);
    const controller = new AbortController();
    const delayedResolver = async (): Promise<string> => {
      await new Promise((resolve) => setTimeout(resolve, 25));
      return executable;
    };
    try {
      const pending = new CliExecutor({ codex: executable }, { codex: { readIsolation: true } }, delayedResolver).invoke('codex', process.cwd(), 'STEP AUDIT STEP-009', 'контекст', controller.signal);
      controller.abort();
      await expect(pending).resolves.toEqual({ ok: false, cancelled: true, errorKind: 'cancelled' });
      await expect(fs.access(spawned)).rejects.toThrow();
    } finally { await fs.rm(binDirectory, { recursive: true, force: true }); }
  });

  it('ограничивает один незавершённый Codex JSONL event', async () => {
    const binDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'harness-jsonl-line-'));
    const executable = path.join(binDirectory, 'codex');
    await fs.writeFile(executable, '#!/bin/sh\ncat >/dev/null\nhead -c 1100000 /dev/zero | tr "\\0" x\n');
    await fs.chmod(executable, 0o755);
    try {
      await expect(new CliExecutor({ codex: executable }, { codex: { readIsolation: true } }).invoke('codex', process.cwd(), 'STEP AUDIT STEP-009', 'контекст'))
        .resolves.toEqual({ ok: false, errorKind: 'too-large', message: 'Событие Codex превысило допустимый размер.' });
    } finally { await fs.rm(binDirectory, { recursive: true, force: true }); }
  });

  it('завершает активный процесс без partial result после cancel', async () => {
    const binDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'harness-cancel-'));
    const executable = path.join(binDirectory, 'codex');
    await fs.writeFile(executable, '#!/bin/sh\nsleep 10\nprintf \'%s\\n\' \'{"type":"turn.completed"}\'\n');
    await fs.chmod(executable, 0o755);
    const controller = new AbortController();
    const oldPath = process.env.PATH;
    process.env.PATH = `${binDirectory}${path.delimiter}${oldPath}`;
    try {
      const executor = new CliExecutor({ codex: executable }, { codex: { readIsolation: true } });
      const pending = executor.invoke('codex', process.cwd(), 'STEP AUDIT STEP-009', 'контекст', controller.signal);
      await new Promise((resolve) => setTimeout(resolve, 50));
      controller.abort();
      await expect(pending).resolves.toEqual({ ok: false, cancelled: true, errorKind: 'cancelled' });
    } finally {
      process.env.PATH = oldPath;
      await fs.rm(binDirectory, { recursive: true, force: true });
    }
  });

  it('после cancel завершает process group без delayed descendant write', async () => {
    const binDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'harness-cancel-tree-'));
    const executable = path.join(binDirectory, 'codex');
    const marker = path.join(binDirectory, 'descendant-write');
    await fs.writeFile(executable, `#!/bin/sh\n( /bin/sleep 1; printf unsafe > "${marker}" ) &\ntrap 'exit 0' TERM\n/bin/sleep 10\n`);
    await fs.chmod(executable, 0o755);
    const controller = new AbortController();
    try {
      const pending = new CliExecutor({ codex: executable }, { codex: { readIsolation: true } }).invoke('codex', process.cwd(), 'STEP AUDIT STEP-009', 'контекст', controller.signal);
      await new Promise((resolve) => setTimeout(resolve, 50));
      controller.abort();
      await expect(pending).resolves.toEqual({ ok: false, cancelled: true, errorKind: 'cancelled' });
      await new Promise((resolve) => setTimeout(resolve, 1100));
      await expect(fs.access(marker)).rejects.toThrow();
    } finally { await fs.rm(binDirectory, { recursive: true, force: true }); }
  });

  it('не доверяет подмене из PATH и требует абсолютный configured executable', async () => {
    await expect(resolveTrustedExecutable('codex', process.cwd())).rejects.toThrow('абсолютный путь');
    expect(writeInvocationPolicy('STEP IMPLEMENT STEP-009')).toBeUndefined();
  });

  it('использует явный platform-specific trusted путь к Git', () => {
    expect(defaultGitExecutable('win32')).toBe('C:\\Program Files\\Git\\cmd\\git.exe');
    expect(defaultGitExecutable('linux')).toBe('/usr/bin/git');
  });

  it('строит Windows taskkill только из SystemRoot, игнорируя CWD и PATH', () => {
    expect(windowsTaskkillExecutable('C:\\Windows')).toBe('C:\\Windows\\System32\\taskkill.exe');
    expect(windowsTaskkillExecutable(undefined)).toBeUndefined();
  });
});
