import { DispatchContext, HarnessCommand, dispatchViaAgent } from './baseCommand';

export const reconcileCommand: HarnessCommand = {
  id: 'harness.reconcile',
  protocolName: 'PROJECT RECONCILE',
  inputKind: 'none',
  initGuard: 'require-initialized',
  stepScoped: false,
  dispatch: (ctx: DispatchContext) => dispatchViaAgent(ctx, 'PROJECT RECONCILE'),
};
