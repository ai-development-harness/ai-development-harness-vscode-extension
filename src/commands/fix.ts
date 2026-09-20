import { DispatchContext, HarnessCommand, dispatchViaAgent } from './baseCommand';

export const fixCommand: HarnessCommand = {
  id: 'harness.fix',
  protocolName: 'STEP FIX STEP-NNN',
  inputKind: 'stepPicker',
  initGuard: 'require-initialized',
  stepScoped: true,
  dispatch: (ctx: DispatchContext) => dispatchViaAgent(ctx, 'STEP FIX STEP-NNN'),
};
