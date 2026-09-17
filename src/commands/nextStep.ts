import * as vscode from 'vscode';
import { DispatchContext, HarnessCommand } from './baseCommand';
import { listStepFiles } from './stepPicker';
import { selectNextStep } from './nextStepSelector';

export const nextStepCommand: HarnessCommand = {
  id: 'harness.nextStep',
  protocolName: 'NEXT STEP',
  inputKind: 'none',
  initGuard: 'none',
  stepScoped: false,
  async dispatch(ctx: DispatchContext): Promise<void> {
    const entries = await listStepFiles(ctx.workspaceRoot, ctx.manifest);
    const result = selectNextStep(entries.map((entry) => entry.data));
    if (!result) {
      void vscode.window.showInformationMessage(ctx.i18n.t('harness.nextStep.none'));
      return;
    }
    const reason = ctx.i18n.t(result.reasonKey, result.reasonParams);
    const actionLabel = ctx.i18n.t('harness.nextStep.action');
    const picked = await vscode.window.showInformationMessage(reason, actionLabel);
    if (picked === actionLabel) {
      await vscode.commands.executeCommand(result.suggestedCommandId, result.step.id);
    }
  },
};
