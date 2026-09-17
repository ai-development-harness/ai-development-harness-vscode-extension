import { DispatchContext, HarnessCommand, dispatchViaAgent } from './baseCommand';

export const quickFixCommand: HarnessCommand = {
  id: 'harness.quickFix',
  protocolName: 'QUICK FIX',
  inputKind: 'text',
  initGuard: 'require-initialized',
  stepScoped: false,
  dispatch: (ctx: DispatchContext) => dispatchViaAgent(ctx, 'QUICK FIX'),
};
