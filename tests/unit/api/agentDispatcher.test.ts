import * as vscode from 'vscode';
import { HarnessAgentDispatcher, manualHandoffLabel } from '../../../src/api/agentDispatcher';
import { canonicalCommandMetadata } from '../../../src/api/commandPolicy';
import type { AgentInvocationContext } from '../../../src/api/types';
jest.mock('../../../src/locales/activation', () => ({ getI18nService: () => ({ t: (key: string, params?: Record<string, string>) => params ? `${key}:${JSON.stringify(params)}` : key }) }));

const writeCtx = {
  protocolName: 'STEP PLAN STEP-009', workspaceRoot: '/workspace', manifest: {},
  targetStep: { mutationPolicy: { allowed: ['planning/tasks/STEP-009.md'] } },
} as AgentInvocationContext;
describe('HarnessAgentDispatcher lifecycle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('для write-команды показывает manual handoff без executor lifecycle', async () => {
    const dispatcher = new HarnessAgentDispatcher();
    await expect(dispatcher.invoke(writeCtx)).resolves.toEqual({ ok: false, messageKey: 'harness.agent.manualFallback', params: { message: 'STEP PLAN STEP-009' } });
  });

  it.each(['STEP ADD', 'PROJECT QUICK FIX', 'SKILL FIND', 'SKILL INSTALL', 'SKILL CREATE', 'GIT COMMIT'])('не повторяет hostile free-text %s в Output Channel или UI params', async (textCommand) => {
    const dispatcher = new HarnessAgentDispatcher();
    // Нейтральный маркер ловит утечку обычного intent, которую redaction
    // secret-shaped значений не способна обнаружить.
    const ordinaryIntent = 'ordinary-intent-sentinel';
    const unsafe = { ...writeCtx, protocolName: `${textCommand}: ${ordinaryIntent} to\rken=real-secret\n\u001b[31mxoxb-1234567890-secret\u2028\u202e` } as AgentInvocationContext;
    const result = await dispatcher.invoke(unsafe);
    expect(result).toEqual(expect.objectContaining({ ok: false, messageKey: 'harness.agent.manualFallback' }));
    expect(result.params?.message).toBe(`harness.agent.manualHandoff.textCommand:{"command":"${textCommand}"}`);
    expect(result.params?.message).not.toMatch(/ordinary-intent-sentinel|real-secret|xoxb-|[\r\n\u001b\u2028\u2029\u202e]/u);
    const output = (vscode.window.createOutputChannel as jest.Mock).mock.results.at(-1)?.value;
    const lines = (output.appendLine as jest.Mock).mock.calls.map(([line]) => String(line));
    expect(lines.every((line) => !/ordinary-intent-sentinel|real-secret|xoxb-|[\r\n\u001b\u2028\u2029\u202e]/u.test(line))).toBe(true);
    expect(lines).toContain(result.params?.message);
  });

  it.each(['STEP ADD', 'PROJECT QUICK FIX', 'SKILL FIND', 'SKILL INSTALL', 'SKILL CREATE', 'GIT COMMIT'])('не повторяет pure-normal free-text %s в Output Channel или UI params', async (textCommand) => {
    const dispatcher = new HarnessAgentDispatcher();
    // Отдельный обычный intent не содержит secret/control fragment и не даёт
    // implementation скрыть утечку за detector-based redaction веткой.
    const ordinaryIntent = 'ordinary-intent-sentinel';
    const normal = { ...writeCtx, protocolName: `${textCommand}: add public roadmap card ${ordinaryIntent}` } as AgentInvocationContext;
    const result = await dispatcher.invoke(normal);
    expect(result).toEqual(expect.objectContaining({ ok: false, messageKey: 'harness.agent.manualFallback' }));
    expect(result.params?.message).toBe(`harness.agent.manualHandoff.textCommand:{"command":"${textCommand}"}`);
    expect(result.params?.message).not.toContain(ordinaryIntent);
    const output = (vscode.window.createOutputChannel as jest.Mock).mock.results.at(-1)?.value;
    const lines = (output.appendLine as jest.Mock).mock.calls.map(([line]) => String(line));
    expect(lines.every((line) => !line.includes(ordinaryIntent))).toBe(true);
    expect(lines).toContain(result.params?.message);
  });

  it.each(['STEP ADD', 'PROJECT QUICK FIX', 'SKILL FIND', 'SKILL INSTALL', 'SKILL CREATE', 'GIT COMMIT'])('локализует неисполняемый descriptor %s, не добавляя free text', (textCommand) => {
    const ru = { t: (key: string, params?: Record<string, string>) => key === 'harness.agent.manualHandoff.textCommand' ? `${params?.command}: неисполняемый шаблон` : key };
    const en = { t: (key: string, params?: Record<string, string>) => key === 'harness.agent.manualHandoff.textCommand' ? `${params?.command}: non-executable template` : key };
    const ordinaryIntent = 'ordinary-intent-sentinel';
    const metadata = canonicalCommandMetadata(`${textCommand}: ${ordinaryIntent} token=real-secret`);
    expect(metadata).toBeDefined();
    expect(manualHandoffLabel(metadata!, ru as never)).toBe(`${textCommand}: неисполняемый шаблон`);
    expect(manualHandoffLabel(metadata!, en as never)).toBe(`${textCommand}: non-executable template`);
  });

  it('сохраняет exact canonical command без free text, включая optional GIT COMMIT', () => {
    const ru = { t: (key: string) => key };
    expect(manualHandoffLabel(canonicalCommandMetadata('STEP FIX STEP-009')!, ru as never)).toBe('STEP FIX STEP-009');
    expect(manualHandoffLabel(canonicalCommandMetadata('GIT COMMIT')!, ru as never)).toBe('GIT COMMIT');
  });

  it('цепочка с поздним free text получает descriptor в обоих sink', async () => {
    const dispatcher = new HarnessAgentDispatcher();
    const result = await dispatcher.invoke({
      ...writeCtx,
      protocolName: 'GIT CHECK > COMMIT: ordinary-intent-sentinel > PUSH > PR',
    });
    expect(result.params?.message).toBe('harness.agent.manualHandoff.textCommand:{"command":"GIT CHECK > GIT COMMIT > GIT PUSH > GIT PR"}');
    const output = (vscode.window.createOutputChannel as jest.Mock).mock.results.at(-1)?.value;
    expect((output.appendLine as jest.Mock).mock.calls.map(([line]) => String(line))).toEqual([result.params?.message]);
    expect(result.params?.message).not.toContain('ordinary-intent-sentinel');
  });

  it.each(['\r\nGIT PUSH\u2028', '\tGIT PUSH\u2029'])('normalizes outer control bytes before exact handoff: %j', async (command) => {
    const dispatcher = new HarnessAgentDispatcher();
    const result = await dispatcher.invoke({ ...writeCtx, protocolName: command });
    expect(result.params?.message).toBe('GIT PUSH');
    const output = (vscode.window.createOutputChannel as jest.Mock).mock.results.at(-1)?.value;
    expect((output.appendLine as jest.Mock).mock.calls.map(([line]) => String(line))).toEqual(['GIT PUSH']);
  });

  it.each([
    ['HARNESS UPDATE CHECK TO v1.2.3', 'HARNESS UPDATE CHECK TO v1.2.3'],
    ['HARNESS UPDATE CHECK TO v1.2.3 > APPLY', 'HARNESS UPDATE CHECK TO v1.2.3 > HARNESS UPDATE APPLY TO v1.2.3'],
  ])('показывает safe release target как exact command в обоих handoff sink: %s', async (command, expected) => {
    const dispatcher = new HarnessAgentDispatcher();
    const result = await dispatcher.invoke({ ...writeCtx, protocolName: command });
    expect(result).toEqual({ ok: false, messageKey: 'harness.agent.manualFallback', params: { message: expected } });
    const output = (vscode.window.createOutputChannel as jest.Mock).mock.results.at(-1)?.value;
    expect((output.appendLine as jest.Mock).mock.calls.map(([line]) => String(line))).toEqual([expected]);
  });

  it.each([
    'HARNESS UPDATE CHECK TO v1\u001b[31m',
    'HARNESS UPDATE CHECK TO v1\u202e',
    'GIT PUSH > CHECK',
    'GIT CHECK > STEP REVIEW STEP-009',
    'STEP PLAN STEP-009 > REVIEW STEP-010',
  ])('блокирует invalid target или CTS-цепочку без manual handoff: %j', async (command) => {
    const dispatcher = new HarnessAgentDispatcher();
    const result = await dispatcher.invoke({ ...writeCtx, protocolName: command });
    expect(result).toEqual({
      ok: false,
      messageKey: 'harness.agent.preValidation',
      params: { message: 'harness.agent.preValidation.invalidCommand' },
    });
    const output = (vscode.window.createOutputChannel as jest.Mock).mock.results.at(-1)?.value;
    const lines = (output.appendLine as jest.Mock).mock.calls.map(([line]) => String(line));
    expect(lines).toEqual(['harness.agent.output.invalidCommand']);
    expect(lines.join('\n')).not.toMatch(/manualFallback|v1\u001b|v1\u202e/u);
  });

  it.each(['STEP ADD', 'PROJECT QUICK FIX', 'SKILL FIND', 'SKILL INSTALL', 'SKILL CREATE', 'GIT COMMIT'])('control-only text останавливает %s до handoff даже без Command Palette', async (textCommand) => {
    const dispatcher = new HarnessAgentDispatcher();
    await expect(dispatcher.invoke({ ...writeCtx, protocolName: `${textCommand}: \u001b\u2028\u202e` })).resolves.toEqual({
      ok: false,
      messageKey: 'harness.agent.preValidation',
      params: { message: 'harness.agent.preValidation.invalidCommand' },
    });
  });
});
