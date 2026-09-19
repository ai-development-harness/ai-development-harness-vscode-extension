import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { getGitSnapshot, safeGitEnvironment } from '../../../src/git/gitHelper';

describe('getGitSnapshot', () => {
  it('возвращает структурированный снимок репозитория', async () => {
    const result = await getGitSnapshot(process.cwd());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.branch).not.toBe('');
      expect(Array.isArray(result.value.staged)).toBe(true);
    }
  });

  it('возвращает ошибку вместо исключения вне git-репозитория', async () => {
    const result = await getGitSnapshot('/tmp');
    expect(result.ok).toBe(false);
  });

  it('очищает injected Git config и запрещает optional locks до status', () => {
    const environment = safeGitEnvironment({ GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: 'core.fsmonitor', GIT_CONFIG_VALUE_0: 'payload', KEEP: 'value' });
    expect(environment.GIT_CONFIG_COUNT).toBeUndefined();
    expect(environment.GIT_CONFIG_KEY_0).toBeUndefined();
    expect(environment.GIT_OPTIONAL_LOCKS).toBe('0');
    expect(environment.KEEP).toBe('value');
  });

  it('не исполняет repository-controlled core.fsmonitor при реальном snapshot', async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'harness-fsmonitor-'));
    const repository = path.join(directory, 'repository');
    const marker = path.join(directory, 'fsmonitor-ran');
    const trace = path.join(directory, 'git-trace');
    const hook = path.join(directory, 'fsmonitor');
    const git = path.join(directory, 'git-wrapper');
    await fs.mkdir(repository);
    await fs.writeFile(hook, `#!/bin/sh\nprintf unsafe > "${marker}"\n`);
    await fs.writeFile(git, `#!/bin/sh\nprintf '%s\\n' "$@" >> "${trace}"\nprintf '%s|%s\\n' "${'${GIT_CONFIG-unset}'}" "${'${GIT_CONFIG_COUNT-unset}'}" >> "${trace}"\nexec /usr/bin/git "$@"\n`);
    await Promise.all([fs.chmod(hook, 0o755), fs.chmod(git, 0o755)]);
    execFileSync('/usr/bin/git', ['init', '-q', repository]);
    execFileSync('/usr/bin/git', ['-C', repository, 'config', 'core.fsmonitor', hook]);
    const previousConfig = process.env.GIT_CONFIG;
    process.env.GIT_CONFIG = 'injected-config';
    try {
      // Обёртка фиксирует argv/env обоих Git процессов, а hook — реальный exploit seam.
      // Snapshot обязан работать, но repository config не имеет права создать marker.
      await expect(getGitSnapshot(repository, git)).resolves.toEqual(expect.objectContaining({ ok: true }));
      await expect(fs.access(marker)).rejects.toThrow();
      const observed = await fs.readFile(trace, 'utf8');
      expect(observed).toContain('core.fsmonitor=false');
      expect(observed).toContain('unset|unset');
    } finally {
      if (previousConfig === undefined) delete process.env.GIT_CONFIG;
      else process.env.GIT_CONFIG = previousConfig;
      await fs.rm(directory, { recursive: true, force: true });
    }
  });
});
