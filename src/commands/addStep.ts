import { DispatchContext, HarnessCommand, dispatchViaAgent } from './baseCommand';

export const addStepCommand: HarnessCommand = {
  id: 'harness.addStep',
  protocolName: 'ADD STEP',
  inputKind: 'text',
  initGuard: 'require-initialized',
  stepScoped: false,
  dispatch: (ctx: DispatchContext) => dispatchViaAgent(ctx, 'ADD STEP'),
};
