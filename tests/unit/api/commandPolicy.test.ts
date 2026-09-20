import { canonicalCommandMetadata, requiresWriteAccess, writeInvocationPolicy } from '../../../src/api/commandPolicy';

const step = { mutationPolicy: { allowed: ['planning/tasks/STEP-009.md'] } } as never;

describe('CTS policy для manual handoff', () => {
  it.each([
    'PROJECT INIT', 'PROJECT STATUS', 'PROJECT RECONCILE', 'PROJECT QUICK FIX: intent',
    'STEP ADD: intent', 'STEP NEXT', 'STEP PLAN STEP-009', 'STEP IMPLEMENT STEP-009',
    'STEP REVIEW STEP-009', 'STEP FIX STEP-009', 'STEP RUN STEP-009', 'STEP AUDIT STEP-009',
    'SKILL FIND: intent', 'SKILL INSTALL: owner/repository', 'SKILL CREATE: intent',
    'GITHUB GENERATE TEMPLATES', 'RELEASE CHECK', 'HARNESS UPDATE CHECK', 'HARNESS UPDATE APPLY',
    'GIT CHECK', 'GIT COMMIT', 'GIT PUSH', 'GIT PR', 'GIT SYNC',
  ])('имеет явную effect policy для canonical CTS command %s', (command) => {
    expect(writeInvocationPolicy(command, step)).toBeDefined();
  });

  it.each([
    ['SKILL INSTALL: owner/repository', 'filesystem-write', true],
    ['SKILL CREATE: новый локальный skill', 'filesystem-write', true],
    ['GITHUB GENERATE TEMPLATES', 'filesystem-write', true],
    ['HARNESS UPDATE APPLY', 'filesystem-write', true],
    ['GIT COMMIT', 'filesystem-write', true],
    ['GIT PUSH', 'remote-mutation', true],
    ['GIT PR', 'remote-mutation', true],
  ])('не классифицирует mutation %s как read-only', (command, effect, requiresWrite) => {
    const policy = writeInvocationPolicy(command, step);
    expect(policy).toEqual(expect.objectContaining({ effect, requiresWrite }));
    expect(requiresWriteAccess(command, step)).toBe(requiresWrite);
  });

  it('fail-closed для unknown или неполной policy', () => {
    expect(writeInvocationPolicy('GIT UNKNOWN')).toBeUndefined();
    expect(requiresWriteAccess('GIT UNKNOWN')).toBeUndefined();
    expect(writeInvocationPolicy('STEP PLAN STEP-009')).toBeUndefined();
  });

  it.each([
    ['GIT CHECK > PUSH > PR', 'remote-mutation'],
    ['HARNESS UPDATE CHECK > APPLY', 'filesystem-write'],
    ['GIT CHECK > COMMIT: intent > PUSH > PR', 'remote-mutation'],
  ])('агрегирует наиболее сильный effect для CTS chain %s', (command, effect) => {
    expect(writeInvocationPolicy(command, step)).toEqual(expect.objectContaining({ effect, requiresWrite: true }));
  });

  it('не принимает continuation alias как начальный segment', () => {
    expect(canonicalCommandMetadata('HARNESS APPLY')).toBeUndefined();
    expect(writeInvocationPolicy('HARNESS APPLY')).toBeUndefined();
  });

  it.each([
    'GIT PUSH > CHECK',
    'GIT CHECK > STEP REVIEW STEP-009',
    'STEP PLAN STEP-009 > REVIEW STEP-010',
  ])('fail-closed отклоняет структурно некорректную CTS-цепочку %s', (command) => {
    expect(canonicalCommandMetadata(command)).toBeUndefined();
    expect(writeInvocationPolicy(command, step)).toBeUndefined();
  });

  it.each([
    ['HARNESS UPDATE CHECK TO v1.2.3', 'HARNESS UPDATE CHECK TO v1.2.3'],
    ['HARNESS UPDATE CHECK TO v1.2.3 > APPLY', 'HARNESS UPDATE CHECK TO v1.2.3 > HARNESS UPDATE APPLY TO v1.2.3'],
  ])('сохраняет literal TO в normalized safe release target %s', (command, expected) => {
    expect(canonicalCommandMetadata(command)).toEqual(expect.objectContaining({ command: expected, hasFreeText: false }));
  });

  it.each([
    'HARNESS UPDATE CHECK TO v1\u001b[31m',
    'HARNESS UPDATE CHECK TO v1\u202e',
    'HARNESS UPDATE CHECK TO v 1',
  ])('отклоняет небезопасный release target до handoff: %j', (command) => {
    expect(canonicalCommandMetadata(command)).toBeUndefined();
    expect(writeInvocationPolicy(command, step)).toBeUndefined();
  });

  it.each([
    ['STEP ADD: intent', 'STEP ADD', 'required', true],
    ['PROJECT QUICK FIX: intent', 'PROJECT QUICK FIX', 'required', true],
    ['SKILL FIND: intent', 'SKILL FIND', 'required', true],
    ['SKILL INSTALL: intent', 'SKILL INSTALL', 'required', true],
    ['SKILL CREATE: intent', 'SKILL CREATE', 'required', true],
    ['GIT COMMIT: intent', 'GIT COMMIT', 'optional', true],
    ['GIT COMMIT', 'GIT COMMIT', 'optional', false],
  ])('извлекает CTS input metadata для %s', (command, family, input, hasFreeText) => {
    expect(canonicalCommandMetadata(command)).toEqual(expect.objectContaining({ family, input, hasFreeText }));
  });
});
