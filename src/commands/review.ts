import { DispatchContext, HarnessCommand, dispatchViaAgent } from './baseCommand';

export const reviewCommand: HarnessCommand = {
  id: 'harness.review',
  protocolName: 'REVIEW STEP-NNN',
  inputKind: 'stepPicker',
  initGuard: 'require-initialized',
  stepScoped: true,
  dispatch: (ctx: DispatchContext) => dispatchViaAgent(ctx, 'REVIEW STEP-NNN'),
};
