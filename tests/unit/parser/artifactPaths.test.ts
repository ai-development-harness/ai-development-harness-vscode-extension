import { resolveHarnessArtifactPath } from '../../../src/parser/artifactPaths';
import { ManifestData } from '../../../src/parser/types';

const manifest: ManifestData = {
  harness: { version: '1', release: 'fixture' },
  project: { initialized: true, name: 'fixture', initializedAt: null },
  language: {
    default: 'ru', agentResponses: 'ru', documentation: 'ru', commitMessages: 'ru', codeComments: 'ru',
    testNames: 'ru', fixtures: 'ru', githubTemplates: 'ru', releaseNotes: 'ru',
  },
  sources: {
    localBrief: 'PROJECT_BRIEF.local.md', projectOverview: 'docs/PROJECT.md', requirements: 'nested/requirements/SPEC.md',
    architecture: 'nested/architecture.md', roadmap: 'planning/PLAN.md', status: 'planning/STATUS.md',
  },
  protocol: {
    file: 'planning/EXECUTION_PROTOCOL.md', taskDirectory: 'planning/tasks', reviewDirectory: 'planning/reviews',
    auditDirectory: 'planning/audits', skillSearchDirectory: 'planning/skill-searches', skillRegistry: 'docs/skills/REGISTRY.md',
    harnessUpdateDirectory: 'planning/harness-updates',
  },
  repository: {
    gitPolicy: '.project/git-policy.toml', harnessPolicy: '.project/harness-update.toml',
    harnessUpdatePolicy: '.project/harness-update.toml', harnessLock: '.project/harness.lock.json',
    harnessValidation: 'tools/harness/validate.py', harnessCI: '.github/workflows/harness-integrity.yml',
  },
};

describe('resolveHarnessArtifactPath', () => {
  it('резолвит оба allowlisted артефакта поколения 1 от их manifest anchors', () => {
    expect(resolveHarnessArtifactPath(manifest, 'adrDirectory')).toBe('nested/adr');
    expect(resolveHarnessArtifactPath(manifest, 'requirementsStatus')).toBe('nested/requirements/STATUS.md');
  });

  it('возвращает unavailable для неподдерживаемого поколения без guessing', () => {
    const unsupported = { ...manifest, harness: { ...manifest.harness, version: '2' } };

    expect(resolveHarnessArtifactPath(unsupported, 'adrDirectory')).toBeUndefined();
    expect(resolveHarnessArtifactPath(unsupported, 'requirementsStatus')).toBeUndefined();
  });
});
