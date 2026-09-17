import { DispatchContext, HarnessCommand, dispatchViaAgent } from './baseCommand';

export const runCommand: HarnessCommand = {
  id: 'harness.run',
  protocolName: 'RUN STEP-NNN',
  inputKind: 'stepPicker',
  initGuard: 'require-initialized',
  stepScoped: true,
  dispatch: (ctx: DispatchContext) => dispatchViaAgent(ctx, 'RUN STEP-NNN'),
};
