import { DispatchContext, HarnessCommand, dispatchViaAgent } from './baseCommand';

export const reconcileCommand: HarnessCommand = {
  id: 'harness.reconcile',
  protocolName: 'RECONCILE PROJECT',
  inputKind: 'none',
  initGuard: 'require-initialized',
  stepScoped: false,
  dispatch: (ctx: DispatchContext) => dispatchViaAgent(ctx, 'RECONCILE PROJECT'),
};
