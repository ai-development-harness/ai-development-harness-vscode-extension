import { DispatchContext, HarnessCommand, dispatchViaAgent } from './baseCommand';

export const fixCommand: HarnessCommand = {
  id: 'harness.fix',
  protocolName: 'FIX STEP-NNN',
  inputKind: 'stepPicker',
  initGuard: 'require-initialized',
  stepScoped: true,
  dispatch: (ctx: DispatchContext) => dispatchViaAgent(ctx, 'FIX STEP-NNN'),
};
