import { DispatchContext, HarnessCommand, dispatchViaAgent } from './baseCommand';

export const quickFixCommand: HarnessCommand = {
  id: 'harness.quickFix',
  protocolName: 'PROJECT QUICK FIX',
  inputKind: 'text',
  initGuard: 'require-initialized',
  stepScoped: false,
  dispatch: (ctx: DispatchContext) => dispatchViaAgent(ctx, 'PROJECT QUICK FIX'),
};
