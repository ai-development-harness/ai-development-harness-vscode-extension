import * as path from 'node:path';
import * as os from 'node:os';
import { parseManifest } from '../../../src/parser/yamlParser';
import { HARNESS_MANIFEST_REL_PATH } from '../../../src/parser/artifactPaths';

const FIXTURES = path.join(__dirname, '..', '..', 'fixtures', 'manifest');

describe('parseManifest', () => {
  it('читает реальный инициализированный манифест этого репозитория', async () => {
    const result = await parseManifest(path.join(FIXTURES, 'initialized.manifest.yaml'));
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.project.initialized).toBe(true);
    expect(result.value.project.name).toBe('harness-navigator');
    expect(result.value.harness.version).toBe('1');
    expect(result.value.language.default).toBe('ru');
    expect(result.value.protocol.file).toBe('planning/EXECUTION_PROTOCOL.md');
    expect(result.value.protocol.taskDirectory).toBe('planning/tasks');
    expect(result.value.sources.requirements).toBe('docs/requirements');
    expect(result.value.sources.roadmap).toBe('planning/PLAN.md');
    expect(result.value.repository.gitPolicy).toBe('.harness/git-policy.toml');
    expect(result.value.repository.harnessValidation).toBe('tools/harness/validate.py');
  });

  it('читает реальный неинициализированный манифест ai-development-harness-template', async () => {
    const result = await parseManifest(path.join(FIXTURES, 'uninitialized.manifest.yaml'));
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.project.initialized).toBe(false);
    expect(result.value.project.name).toBeNull();
    expect(result.value.project.initializedAt).toBeNull();
    // Пути протокола/источников не зависят от project.initialized — тот же контракт.
    expect(result.value.protocol.file).toBe('planning/EXECUTION_PROTOCOL.md');
    expect(result.value.sources.requirements).toBe('docs/requirements');
  });

  it('даёт явную ошибку NotFound на отсутствующий манифест, не exception', async () => {
    const result = await parseManifest(path.join(FIXTURES, 'does-not-exist.yaml'));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe('not-found');
  });

  it('не читает legacy `.project/manifest.yaml` как fallback, когда `.harness/manifest.yaml` отсутствует (FIX STEP-024 F-001)', async () => {
    const fs = await import('node:fs/promises');
    const legacyOnlyRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'harness-navigator-legacy-only-'));
    try {
      const legacyManifestPath = path.join(legacyOnlyRoot, '.project', 'manifest.yaml');
      await fs.mkdir(path.dirname(legacyManifestPath), { recursive: true });
      // Валидный по schema манифест — чтобы отличить "не нашёл файл" от "нашёл, но не смог распарсить".
      await fs.copyFile(path.join(FIXTURES, 'initialized.manifest.yaml'), legacyManifestPath);

      const result = await parseManifest(path.join(legacyOnlyRoot, HARNESS_MANIFEST_REL_PATH));

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.kind).toBe('not-found');
    } finally {
      await fs.rm(legacyOnlyRoot, { recursive: true, force: true });
    }
  });

  it('даёт явную ошибку InvalidYaml на битый YAML, не exception', async () => {
    const badYamlPath = path.join(__dirname, '..', '..', 'fixtures', 'manifest-invalid.tmp.yaml');
    const fs = await import('node:fs/promises');
    await fs.writeFile(badYamlPath, 'project:\n  initialized: true\n  name: [unterminated\n', 'utf8');
    try {
      const result = await parseManifest(badYamlPath);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.kind).toBe('invalid-yaml');
    } finally {
      await fs.rm(badYamlPath, { force: true });
    }
  });

  it('даёт явную ошибку MissingRequiredField, если обязательный ключ отсутствует', async () => {
    const incompletePath = path.join(__dirname, '..', '..', 'fixtures', 'manifest-incomplete.tmp.yaml');
    const fs = await import('node:fs/promises');
    await fs.writeFile(incompletePath, 'harness:\n  version: "1"\n  release: "0.1.1"\n', 'utf8');
    try {
      const result = await parseManifest(incompletePath);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.kind).toBe('missing-field');
      if (result.error.kind === 'missing-field') {
        expect(result.error.field).toBe('project');
      }
    } finally {
      await fs.rm(incompletePath, { force: true });
    }
  });

  it('даёт явную ошибку MissingRequiredField для отсутствующего вложенного поля (не только целой секции)', async () => {
    const missingNestedFieldPath = path.join(__dirname, '..', '..', 'fixtures', 'manifest-missing-nested.tmp.yaml');
    const fs = await import('node:fs/promises');
    const content = [
      'harness:',
      '  version: "1"',
      '  release: "0.1.1"',
      'project:',
      '  initialized: true',
      '  name: null',
      '  initializedAt: null',
      'language:',
      '  default: ru',
      '  agentResponses: ru',
      '  documentation: ru',
      '  commitMessages: ru',
      '  codeComments: ru',
      '  testNames: ru',
      '  fixtures: ru',
      '  githubTemplates: ru',
      '  releaseNotes: ru',
      'sources:',
      '  localBrief: PROJECT_BRIEF.local.md',
      '  projectOverview: docs/PROJECT.md',
      '  requirements: docs/requirements/SPEC.md',
      '  architecture: docs/architecture.md',
      '  status: planning/STATUS.md',
      'protocol:',
      '  file: planning/EXECUTION_PROTOCOL.md',
      '  taskDirectory: planning/tasks',
      '  reviewDirectory: planning/reviews',
      '  auditDirectory: planning/audits',
      '  skillSearchDirectory: planning/skill-searches',
      '  skillRegistry: docs/skills/REGISTRY.md',
      '  harnessUpdateDirectory: planning/harness-updates',
      'repository:',
      '  gitPolicy: .harness/git-policy.toml',
      '  harnessPolicy: .harness/harness-policy.toml',
      '  harnessUpdatePolicy: .harness/harness-update.toml',
      '  harnessLock: .harness/harness.lock.json',
      '  harnessValidation: tools/harness/validate.py',
      '  harnessCI: .github/workflows/harness-integrity.yml',
      '',
    ].join('\n');
    // Секция `sources` присутствует целиком, но в ней намеренно отсутствует поле `roadmap`.
    await fs.writeFile(missingNestedFieldPath, content, 'utf8');
    try {
      const result = await parseManifest(missingNestedFieldPath);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.kind).toBe('missing-field');
      if (result.error.kind === 'missing-field') {
        expect(result.error.field).toBe('sources.roadmap');
      }
    } finally {
      await fs.rm(missingNestedFieldPath, { force: true });
    }
  });

  it('даёт явную ошибку InvalidYaml, если документ синтаксически валиден, но не является объектом', async () => {
    const notObjectPath = path.join(__dirname, '..', '..', 'fixtures', 'manifest-not-object.tmp.yaml');
    const fs = await import('node:fs/promises');
    await fs.writeFile(notObjectPath, '- foo\n- bar\n', 'utf8');
    try {
      const result = await parseManifest(notObjectPath);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.kind).toBe('invalid-yaml');
    } finally {
      await fs.rm(notObjectPath, { force: true });
    }
  });
});
