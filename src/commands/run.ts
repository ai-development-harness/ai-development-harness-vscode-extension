import { DispatchContext, HarnessCommand, dispatchViaAgent } from './baseCommand';

export const runCommand: HarnessCommand = {
  id: 'harness.run',
  protocolName: 'STEP RUN STEP-NNN',
  inputKind: 'stepPicker',
  initGuard: 'require-initialized',
  stepScoped: true,
  dispatch: (ctx: DispatchContext) => dispatchViaAgent(ctx, 'STEP RUN STEP-NNN'),
};
