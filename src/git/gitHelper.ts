import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolveTrustedExecutable } from '../api/executors';

const execFileAsync = promisify(execFile);

/** Исключает repository-controlled Git config до pre-consent status (F-001). */
export function safeGitEnvironment(inherited: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const environment = { ...inherited };
  for (const name of Object.keys(environment)) if (name === 'GIT_CONFIG' || name.startsWith('GIT_CONFIG_')) delete environment[name];
  environment.GIT_OPTIONAL_LOCKS = '0';
  return environment;
}

export interface GitSnapshot {
  readonly branch: string;
  readonly staged: string[];
  readonly unstaged: string[];
  readonly untracked: string[];
}

export type GitSnapshotResult =
  | { readonly ok: true; readonly value: GitSnapshot }
  | { readonly ok: false; readonly message: string };

/**
 * Читает только краткое состояние git через argv, без shell и без мутаций.
 * Снимок попадает в агентский контекст, чтобы агент видел незакоммиченные
 * изменения, но расширение само не выполняет команды, меняющие репозиторий.
 */
export function defaultGitExecutable(platform = process.platform): string {
  return platform === 'win32' ? 'C:\\Program Files\\Git\\cmd\\git.exe' : '/usr/bin/git';
}
export async function getGitSnapshot(cwd: string, configuredExecutable = defaultGitExecutable()): Promise<GitSnapshotResult> {
  try {
    const git = await resolveTrustedExecutable('git', cwd, configuredExecutable);
    const [branchResult, statusResult] = await Promise.all([
      execFileAsync(git, ['-c', 'core.fsmonitor=false', 'branch', '--show-current'], { cwd, encoding: 'utf8', env: safeGitEnvironment() }),
      execFileAsync(git, ['-c', 'core.fsmonitor=false', 'status', '--porcelain=v1'], { cwd, encoding: 'utf8', env: safeGitEnvironment() }),
    ]);
    const staged: string[] = [];
    const unstaged: string[] = [];
    const untracked: string[] = [];
    for (const line of statusResult.stdout.split('\n')) {
      if (line.length < 4) continue;
      const state = line.slice(0, 2);
      const file = line.slice(3);
      if (state === '??') untracked.push(file);
      else {
        if (state[0] !== ' ') staged.push(file);
        if (state[1] !== ' ') unstaged.push(file);
      }
    }
    return { ok: true, value: { branch: branchResult.stdout.trim() || 'HEAD', staged, unstaged, untracked } };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }
}
