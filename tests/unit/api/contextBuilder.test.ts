import * as path from 'node:path';
import { buildAgentContext, excludeRequirementsArtifact, relevantSections } from '../../../src/api/contextBuilder';
import type { AgentInvocationContext } from '../../../src/api/types';
import type { ManifestData, StepData } from '../../../src/parser/types';

jest.mock('../../../src/git/gitHelper', () => ({
  getGitSnapshot: jest.fn(async () => ({ ok: true, value: { branch: 'fixture', staged: [], unstaged: [], untracked: [] } })),
}));

const ROOT = path.join(__dirname, '../../fixtures/projects/apiContext');
const manifest: ManifestData = {
  harness: { version: '1', release: 'fixture' }, project: { initialized: true, name: 'fixture', initializedAt: null },
  language: { default: 'ru', agentResponses: 'ru', documentation: 'ru', commitMessages: 'ru', codeComments: 'ru', testNames: 'ru', fixtures: 'ru', githubTemplates: 'ru', releaseNotes: 'ru' },
  sources: { localBrief: 'PROJECT_BRIEF.local.md', projectOverview: 'docs/PROJECT.md', requirements: 'docs/requirements/SPEC.md', architecture: 'docs/architecture.md', roadmap: 'planning/PLAN.md', status: 'planning/STATUS.md' },
  protocol: { file: 'planning/EXECUTION_PROTOCOL.md', taskDirectory: 'planning/tasks', reviewDirectory: 'planning/reviews', auditDirectory: 'planning/audits', skillSearchDirectory: 'planning/skill-searches', skillRegistry: 'docs/skills/REGISTRY.md', harnessUpdateDirectory: 'planning/harness-updates' },
  repository: { gitPolicy: '.project/git-policy.toml', harnessPolicy: '.project/harness-policy.toml', harnessUpdatePolicy: '.project/harness-update.toml', harnessLock: '.project/harness.lock.json', harnessValidation: 'tools/harness/validate.py', harnessCI: '.github/workflows/harness-integrity.yml' },
};

const step: StepData = {
  id: 'STEP-010', title: 'fixture', status: 'В работе', type: 'IMPLEMENTATION', priority: 'Высокий', phase: 'MVP', dependsOn: [], requirements: ['REQ-987'], adr: ['ADR-987'], riskFlags: [], goal: '', context: '', scope: [], mutationPolicy: { allowed: [], conditional: [], forbidden: [] }, outOfScope: [], acceptanceCriteria: [], verification: [], deliverables: [], implementationPlan: { status: 'Ready', revision: '1', plannedAt: '', body: '' }, evidence: '', reviewStatus: { latestVerdict: 'NOT REVIEWED', latestReport: '' }, blocker: '',
};

function context(targetStep: StepData = step): AgentInvocationContext {
  return { protocolName: 'STEP PLAN STEP-010', workspaceRoot: ROOT, manifest, targetStep };
}

describe('buildAgentContext', () => {
  it('включает canonical selected STEP и generic ADR из allowlisted каталога', async () => {
    const result = await buildAgentContext(context());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.prompt).toContain('Harness command: STEP PLAN STEP-010');
      expect(result.value.prompt).toContain('Generic ADR fixture.');
      expect(result.value.prompt).toContain('Требование fixture.');
      expect(result.value.prompt).not.toContain('Соседнее требование не входит');
      expect(result.value.artifactPaths).toContain(path.join(ROOT, 'docs/adr/ADR-987-generic-name.md'));
    }
  });

  it('останавливает pre-validation, если linked ADR отсутствует', async () => {
    const result = await buildAgentContext(context({ ...step, adr: ['ADR-404'] }));
    expect(result).toEqual(expect.objectContaining({ ok: false, message: expect.stringContaining('ADR-404') }));
  });

  it('исключает full SPEC по exact Windows resolved path, сохраняя relevant REQ', () => {
    const requirementsPath = 'C:\\workspace\\docs\\requirements\\SPEC.md';
    const artifacts = [
      { path: requirementsPath, content: '### REQ-987\nНужное\n### REQ-988\nСоседнее' },
      { path: 'C:\\workspace\\planning\\EXECUTION_PROTOCOL.md', content: 'Protocol' },
    ];
    expect(excludeRequirementsArtifact(artifacts, requirementsPath)).toEqual([
      { path: 'C:\\workspace\\planning\\EXECUTION_PROTOCOL.md', content: 'Protocol' },
    ]);
    const promptRequirements = relevantSections(artifacts[0].content, ['REQ-987']);
    expect(promptRequirements).toContain('Нужное');
    expect(promptRequirements).not.toContain('Соседнее');
  });
});
