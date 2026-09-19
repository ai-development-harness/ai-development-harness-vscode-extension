import * as fs from 'node:fs/promises';
import * as path from 'node:path';

function isContained(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

/**
 * Проверяет manifest/agent path до filesystem-вызова и затем сверяет realpath.
 * Поэтому `..`, absolute path и symlink, ведущий за workspace, не становятся
 * способом передать внешний файл в prompt или перезагрузить его в editor.
 */
export async function resolveWorkspaceFile(workspaceRoot: string, workspaceRelativePath: string): Promise<string> {
  if (!workspaceRelativePath || path.isAbsolute(workspaceRelativePath) || path.win32.isAbsolute(workspaceRelativePath)) {
    throw new Error(`Недопустимый абсолютный путь: ${workspaceRelativePath}`);
  }
  const lexicalRoot = path.resolve(workspaceRoot);
  const lexicalCandidate = path.resolve(lexicalRoot, workspaceRelativePath);
  if (!isContained(lexicalRoot, lexicalCandidate)) {
    throw new Error(`Путь выходит за пределы workspace: ${workspaceRelativePath}`);
  }
  const [realRoot, realCandidate] = await Promise.all([fs.realpath(lexicalRoot), fs.realpath(lexicalCandidate)]);
  if (!isContained(realRoot, realCandidate)) {
    throw new Error(`Symlink выводит путь за пределы workspace: ${workspaceRelativePath}`);
  }
  return realCandidate;
}

/** Допускает только безопасный относительный путь для результата агента. */
export function validateWorkspaceRelativePath(workspaceRelativePath: string): string {
  if (!workspaceRelativePath || path.isAbsolute(workspaceRelativePath) || path.win32.isAbsolute(workspaceRelativePath)) {
    throw new Error(`Недопустимый путь результата агента: ${workspaceRelativePath}`);
  }
  const normalized = path.normalize(workspaceRelativePath);
  if (normalized === '..' || normalized.startsWith(`..${path.sep}`)) {
    throw new Error(`Путь результата агента выходит за пределы workspace: ${workspaceRelativePath}`);
  }
  return normalized;
}

/**
 * Deleted files остаются допустимым результатом агента: их не надо reload-ить.
 * Для существующего файла обязательна realpath-проверка, поэтому symlink не
 * может подменить разрешённый relative path внешним документом.
 */
export async function validateChangedWorkspacePaths(workspaceRoot: string, paths: readonly string[]): Promise<string[]> {
  return Promise.all(paths.map(async (file) => {
    const normalized = validateWorkspaceRelativePath(file);
    try {
      await resolveWorkspaceFile(workspaceRoot, normalized);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    return normalized;
  }));
}
