import { canonicalNextCommand, StatusBarRefreshScheduler } from '../../../src/ui/statusBar';

describe('StatusBarRefreshScheduler', () => {
  it('батчит burst событий в один refresh не чаще заданного интервала', async () => {
    jest.useFakeTimers();
    const refresh = jest.fn(async () => undefined);
    const scheduler = new StatusBarRefreshScheduler(refresh, 1_000);
    scheduler.schedule(); scheduler.schedule(); scheduler.schedule();
    await jest.advanceTimersByTimeAsync(999);
    expect(refresh).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(1);
    expect(refresh).toHaveBeenCalledTimes(1);
    scheduler.dispose(); jest.useRealTimers();
  });

  it('не публикует отложенное обновление после dispose', async () => {
    jest.useFakeTimers();
    const refresh = jest.fn(async () => undefined);
    const scheduler = new StatusBarRefreshScheduler(refresh, 1_000);
    scheduler.schedule(); scheduler.dispose();
    await jest.advanceTimersByTimeAsync(1_000);
    expect(refresh).not.toHaveBeenCalled();
    jest.useRealTimers();
  });

  it('назначает ещё один refresh для события, пришедшего во время выполнения', async () => {
    jest.useFakeTimers();
    let finishRefresh: (() => void) | undefined;
    const refresh = jest.fn(() => new Promise<void>((resolve) => { finishRefresh = resolve; }));
    const scheduler = new StatusBarRefreshScheduler(refresh, 1_000);
    scheduler.schedule();
    await jest.advanceTimersByTimeAsync(1_000);
    expect(refresh).toHaveBeenCalledTimes(1);
    scheduler.schedule();
    finishRefresh?.();
    await Promise.resolve();
    await jest.advanceTimersByTimeAsync(1_000);
    expect(refresh).toHaveBeenCalledTimes(2);
    scheduler.dispose(); jest.useRealTimers();
  });
});

describe('canonicalNextCommand', () => {
  it.each([
    ['harness.plan', 'STEP-008', 'STEP PLAN STEP-008'],
    ['harness.fix', 'STEP-008', 'STEP FIX STEP-008'],
    ['harness.implement', 'STEP-008', 'STEP IMPLEMENT STEP-008'],
  ])('не раскрывает internal command id %s', (id, step, expected) => {
    expect(canonicalNextCommand(id, step)).toBe(expected);
  });
});
