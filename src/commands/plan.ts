import { DispatchContext, HarnessCommand, dispatchViaAgent } from './baseCommand';

export const planCommand: HarnessCommand = {
  id: 'harness.plan',
  protocolName: 'PLAN STEP-NNN',
  inputKind: 'stepPicker',
  initGuard: 'require-initialized',
  stepScoped: true,
  dispatch: (ctx: DispatchContext) => dispatchViaAgent(ctx, 'PLAN STEP-NNN'),
};
