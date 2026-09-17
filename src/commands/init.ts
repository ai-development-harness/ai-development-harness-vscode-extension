import { DispatchContext, HarnessCommand, dispatchViaAgent } from './baseCommand';

export const initCommand: HarnessCommand = {
  id: 'harness.init',
  protocolName: 'INIT PROJECT',
  inputKind: 'none',
  initGuard: 'require-uninitialized',
  stepScoped: false,
  dispatch: (ctx: DispatchContext) => dispatchViaAgent(ctx, 'INIT PROJECT'),
};
