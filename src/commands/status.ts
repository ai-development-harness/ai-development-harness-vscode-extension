import * as vscode from 'vscode';
import { DispatchContext, HarnessCommand } from './baseCommand';
import { listStepFiles } from './stepPicker';
import { computeProjectStatus, formatStatusSummary } from './projectStatus';

export const statusCommand: HarnessCommand = {
  id: 'harness.status',
  protocolName: 'PROJECT STATUS',
  inputKind: 'none',
  initGuard: 'none',
  stepScoped: false,
  async dispatch(ctx: DispatchContext): Promise<void> {
    const entries = await listStepFiles(ctx.workspaceRoot, ctx.manifest);
    const summary = computeProjectStatus(entries.map((entry) => entry.data));
    void vscode.window.showInformationMessage(formatStatusSummary(summary, ctx.i18n));
  },
};
