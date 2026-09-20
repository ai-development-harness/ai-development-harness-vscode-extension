import { DispatchContext, HarnessCommand, dispatchViaAgent } from './baseCommand';

export const addStepCommand: HarnessCommand = {
  id: 'harness.addStep',
  protocolName: 'STEP ADD',
  inputKind: 'text',
  initGuard: 'require-initialized',
  stepScoped: false,
  dispatch: (ctx: DispatchContext) => dispatchViaAgent(ctx, 'STEP ADD'),
};
