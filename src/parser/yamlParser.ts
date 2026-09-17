import { readFile } from 'node:fs/promises';
import { parse as parseYaml } from 'yaml';
import { ManifestData, ManifestError, Result, err, ok } from './types';

/**
 * ADR-001: единственный источник путей протокола — `.project/manifest.yaml`
 * конкретного проекта. Хардкод директорий и угадывание по вариантам — не
 * применяются: отсутствующий/повреждённый манифест даёт явную типизированную
 * ошибку, а не исключение и не молчаливый fallback.
 */
export async function parseManifest(
  manifestPath: string
): Promise<Result<ManifestData, ManifestError>> {
  let raw: string;
  try {
    raw = await readFile(manifestPath, 'utf8');
  } catch {
    return err({ kind: 'not-found', path: manifestPath });
  }

  let doc: unknown;
  try {
    doc = parseYaml(raw);
  } catch (error) {
    return err({
      kind: 'invalid-yaml',
      path: manifestPath,
      message: error instanceof Error ? error.message : String(error),
    });
  }

  return buildManifestData(doc, manifestPath);
}

function buildManifestData(
  doc: unknown,
  manifestPath: string
): Result<ManifestData, ManifestError> {
  const root = asRecord(doc);
  if (!root) {
    return err({ kind: 'invalid-yaml', path: manifestPath, message: 'документ не является объектом' });
  }

  const missing = (field: string): Result<ManifestData, ManifestError> =>
    err({ kind: 'missing-field', path: manifestPath, field });

  const harnessSection = asRecord(root.harness);
  if (!harnessSection) return missing('harness');
  const version = asString(harnessSection.version);
  if (version === undefined) return missing('harness.version');
  const release = asString(harnessSection.release);
  if (release === undefined) return missing('harness.release');

  const projectSection = asRecord(root.project);
  if (!projectSection) return missing('project');
  const initialized = asBoolean(projectSection.initialized);
  if (initialized === undefined) return missing('project.initialized');

  const languageSection = asRecord(root.language);
  if (!languageSection) return missing('language');
  const languageFields = [
    'default',
    'agentResponses',
    'documentation',
    'commitMessages',
    'codeComments',
    'testNames',
    'fixtures',
    'githubTemplates',
    'releaseNotes',
  ] as const;
  const language = {} as Record<(typeof languageFields)[number], string>;
  for (const field of languageFields) {
    const value = asString(languageSection[field]);
    if (value === undefined) return missing(`language.${field}`);
    language[field] = value;
  }

  const sourcesSection = asRecord(root.sources);
  if (!sourcesSection) return missing('sources');
  const sourcesFields = [
    'localBrief',
    'projectOverview',
    'requirements',
    'architecture',
    'roadmap',
    'status',
  ] as const;
  const sources = {} as Record<(typeof sourcesFields)[number], string>;
  for (const field of sourcesFields) {
    const value = asString(sourcesSection[field]);
    if (value === undefined) return missing(`sources.${field}`);
    sources[field] = value;
  }

  const protocolSection = asRecord(root.protocol);
  if (!protocolSection) return missing('protocol');
  const protocolFields = [
    'file',
    'taskDirectory',
    'reviewDirectory',
    'auditDirectory',
    'skillSearchDirectory',
    'skillRegistry',
    'harnessUpdateDirectory',
  ] as const;
  const protocol = {} as Record<(typeof protocolFields)[number], string>;
  for (const field of protocolFields) {
    const value = asString(protocolSection[field]);
    if (value === undefined) return missing(`protocol.${field}`);
    protocol[field] = value;
  }

  const repositorySection = asRecord(root.repository);
  if (!repositorySection) return missing('repository');
  const repositoryFields = [
    'gitPolicy',
    'harnessPolicy',
    'harnessUpdatePolicy',
    'harnessLock',
    'harnessValidation',
    'harnessCI',
  ] as const;
  const repository = {} as Record<(typeof repositoryFields)[number], string>;
  for (const field of repositoryFields) {
    const value = asString(repositorySection[field]);
    if (value === undefined) return missing(`repository.${field}`);
    repository[field] = value;
  }

  return ok({
    harness: { version, release },
    project: {
      initialized,
      name: asString(projectSection.name) ?? null,
      initializedAt: asString(projectSection.initializedAt) ?? null,
    },
    language,
    sources,
    protocol,
    repository,
  });
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return undefined;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function asBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}
