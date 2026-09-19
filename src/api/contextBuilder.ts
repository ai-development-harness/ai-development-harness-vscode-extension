import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { getGitSnapshot } from '../git/gitHelper';
import { resolveHarnessArtifactPath } from '../parser/artifactPaths';
import type { AgentContextBundle, AgentInvocationContext } from './types';
import { resolveWorkspaceFile } from './workspacePaths';

export type ContextBuildResult = { readonly ok: true; readonly value: AgentContextBundle } | { readonly ok: false; readonly message: string };

async function readRequired(filePath: string): Promise<{ path: string; content: string }> {
  return { path: filePath, content: await fs.readFile(filePath, 'utf8') };
}

/** Resolved paths уже используют одну platform-specific form; suffix сравнение небезопасно. */
export function excludeRequirementsArtifact<T extends { readonly path: string }>(artifacts: readonly T[], requirementsPath: string): readonly T[] {
  return artifacts.filter((artifact) => artifact.path !== requirementsPath);
}

export function relevantSections(content: string, ids: readonly string[]): string {
  if (ids.length === 0) return '';
  // Требования — только заголовки третьего уровня; совпадение в traceability
  // другого REQ не должно раскрывать соседний раздел целиком.
  return content.split(/(?=^###\s)/m).filter((section) => ids.some((id) => new RegExp(`^###\\s+${id}\\b`, 'm').test(section))).join('\n');
}

/**
 * Формирует prompt только из путей manifest и зарегистрированной derivation ADR-005.
 * Произвольный обход workspace намеренно запрещён: неполный контекст безопаснее
 * неявной передачи файлов, которые пользователь не выбирал для Harness.
 */
export async function buildAgentContext(ctx: AgentInvocationContext): Promise<ContextBuildResult> {
  const { manifest, workspaceRoot, targetStep } = ctx;
  const adrDirectory = resolveHarnessArtifactPath(manifest, 'adrDirectory');
  if (!adrDirectory) return { ok: false, message: 'Не удалось определить каталог ADR из manifest.' };
  let artifacts: string[];
  try {
    artifacts = await Promise.all([
      resolveWorkspaceFile(workspaceRoot, manifest.protocol.file),
      resolveWorkspaceFile(workspaceRoot, '.project/manifest.yaml'),
      resolveWorkspaceFile(workspaceRoot, manifest.sources.requirements),
      ...(targetStep ? [resolveWorkspaceFile(workspaceRoot, path.join(manifest.protocol.taskDirectory, `${targetStep.id}.md`))] : []),
    ]);
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }
  let adrPaths: string[] = [];
  try {
    // ADR-005 разрешает каталог через derivation, а имя файла остаётся частью
    // labeled-markdown convention. Ищем только внутри этого allowlisted каталога.
    const realAdrDirectory = await resolveWorkspaceFile(workspaceRoot, adrDirectory);
    const names = await fs.readdir(realAdrDirectory);
    adrPaths = await Promise.all((targetStep?.adr ?? []).map(async (id) => {
      const name = names.find((candidate) => candidate.startsWith(`${id}-`) && candidate.endsWith('.md'));
      if (!name) throw new Error(`Не найден ADR ${id} в ${adrDirectory}.`);
      return resolveWorkspaceFile(workspaceRoot, path.join(adrDirectory, name));
    }));
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }
  artifacts.push(...adrPaths);
  try {
    const [contents, git] = await Promise.all([Promise.all(artifacts.map(readRequired)), getGitSnapshot(workspaceRoot)]);
    if (!git.ok) return { ok: false, message: `Не удалось прочитать git status: ${git.message}` };
    const requirementsPath = await resolveWorkspaceFile(workspaceRoot, manifest.sources.requirements);
    const requirements = contents.find((item) => item.path === requirementsPath)?.content ?? '';
    const prompt = [
      `Harness command: ${ctx.protocolName}`,
      ctx.freeText ? `User input: ${ctx.freeText}` : '',
      targetStep ? `Target STEP: ${targetStep.id}` : '',
      `Git branch: ${git.value.branch}`,
      `Git staged: ${git.value.staged.join(', ') || '-'}`,
      `Git unstaged: ${git.value.unstaged.join(', ') || '-'}`,
      `Git untracked: ${git.value.untracked.join(', ') || '-'}`,
      'Return exactly one JSON object: {"summary":"string","changedFiles":["workspace-relative/path"],"nextCommand":"CANONICAL COMMAND or null"}. All three keys are required. Do not use Markdown fences or add text outside this object.',
      // Сравниваем resolved paths, а не suffix: manifest хранит POSIX path,
      // тогда как Windows realpath использует обратные разделители.
      ...excludeRequirementsArtifact(contents, requirementsPath).map((item) => `\n--- ${path.relative(workspaceRoot, item.path)} ---\n${item.content}`),
      `\n--- relevant requirements ---\n${relevantSections(requirements, targetStep?.requirements ?? [])}`,
    ].filter(Boolean).join('\n');
    return { ok: true, value: { prompt, git: git.value, artifactPaths: artifacts } };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }
}
