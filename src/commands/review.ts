import { DispatchContext, HarnessCommand, dispatchViaAgent } from './baseCommand';

export const reviewCommand: HarnessCommand = {
  id: 'harness.review',
  protocolName: 'STEP REVIEW STEP-NNN',
  inputKind: 'stepPicker',
  initGuard: 'require-initialized',
  stepScoped: true,
  dispatch: (ctx: DispatchContext) => dispatchViaAgent(ctx, 'STEP REVIEW STEP-NNN'),
};
