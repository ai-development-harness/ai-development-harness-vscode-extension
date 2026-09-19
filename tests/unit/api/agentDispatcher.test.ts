import * as vscode from 'vscode';
import { HarnessAgentDispatcher, manualHandoffLabel } from '../../../src/api/agentDispatcher';
import type { AgentInvocationContext } from '../../../src/api/types';
jest.mock('../../../src/locales/activation', () => ({ getI18nService: () => ({ t: (key: string, params?: Record<string, string>) => params ? `${key}:${JSON.stringify(params)}` : key }) }));

const ctx = { protocolName: 'STEP AUDIT STEP-009', workspaceRoot: '/workspace', manifest: {} } as AgentInvocationContext;
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

  it('не запускает lifecycle и безопасно обрабатывает cancel', async () => {
    const dispatcher = new HarnessAgentDispatcher();
    dispatcher.cancel();
    await expect(dispatcher.invoke(ctx)).resolves.toEqual({ ok: false, messageKey: 'harness.agent.manualFallback', params: { message: 'STEP AUDIT STEP-009' } });
  });

  it.each(['STEP ADD', 'PROJECT QUICK FIX'])('не повторяет hostile free-text %s в Output Channel или UI params', async (textCommand) => {
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

  it.each(['STEP ADD', 'PROJECT QUICK FIX'])('не повторяет pure-normal free-text %s в Output Channel или UI params', async (textCommand) => {
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

  it.each(['STEP ADD', 'PROJECT QUICK FIX'])('локализует неисполняемый descriptor %s, не добавляя free text', (textCommand) => {
    const ru = { t: (key: string, params?: Record<string, string>) => key === 'harness.agent.manualHandoff.textCommand' ? `${params?.command}: неисполняемый шаблон` : key };
    const en = { t: (key: string, params?: Record<string, string>) => key === 'harness.agent.manualHandoff.textCommand' ? `${params?.command}: non-executable template` : key };
    const ordinaryIntent = 'ordinary-intent-sentinel';
    expect(manualHandoffLabel(`${textCommand}: ${ordinaryIntent} token=real-secret`, ru as never)).toBe(`${textCommand}: неисполняемый шаблон`);
    expect(manualHandoffLabel(`${textCommand}: ${ordinaryIntent} token=real-secret`, en as never)).toBe(`${textCommand}: non-executable template`);
  });

  it('сохраняет exact canonical command без free text', () => {
    const ru = { t: (key: string) => key };
    expect(manualHandoffLabel('STEP FIX STEP-009', ru as never)).toBe('STEP FIX STEP-009');
  });

  it('control-only text останавливается до handoff даже без Command Palette', async () => {
    const dispatcher = new HarnessAgentDispatcher();
    await expect(dispatcher.invoke({ ...writeCtx, protocolName: 'STEP ADD: \u001b\u2028\u202e' })).resolves.toEqual({
      ok: false,
      messageKey: 'harness.agent.preValidation',
      params: { message: 'harness.agent.preValidation.invalidCommand' },
    });
  });
});
