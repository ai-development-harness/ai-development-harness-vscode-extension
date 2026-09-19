import { DispatchContext, HarnessCommand, dispatchViaAgent } from './baseCommand';

export const planCommand: HarnessCommand = {
  id: 'harness.plan',
  protocolName: 'STEP PLAN STEP-NNN',
  inputKind: 'stepPicker',
  initGuard: 'require-initialized',
  stepScoped: true,
  dispatch: (ctx: DispatchContext) => dispatchViaAgent(ctx, 'STEP PLAN STEP-NNN'),
};
