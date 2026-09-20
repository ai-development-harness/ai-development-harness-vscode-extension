import { DispatchContext, HarnessCommand, dispatchViaAgent } from './baseCommand';

export const implementCommand: HarnessCommand = {
  id: 'harness.implement',
  protocolName: 'STEP IMPLEMENT STEP-NNN',
  inputKind: 'stepPicker',
  initGuard: 'require-initialized',
  stepScoped: true,
  dispatch: (ctx: DispatchContext) => dispatchViaAgent(ctx, 'STEP IMPLEMENT STEP-NNN'),
};
