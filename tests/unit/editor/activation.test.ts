import { CodeLensRefreshController } from '../../../src/editor/activation';

type IndexRevision = { revision: string };

describe('CodeLensRefreshController', () => {
  it('публикует ровно одну инвалидацию после замены index и не публикует при ошибке', async () => {
    jest.useFakeTimers();
    const nextIndex: IndexRevision = { revision: 'новый' };
    const loadNextIndex = jest.fn<Promise<IndexRevision | false>, []>()
      .mockResolvedValueOnce(nextIndex)
      .mockRejectedValueOnce(new Error('index load failed'));
    const applyNextIndex = jest.fn();
    const controller = new CodeLensRefreshController(loadNextIndex, applyNextIndex, 200);
    const listener = jest.fn();
    controller.onDidChangeCodeLenses(listener);

    controller.schedule();
    await jest.advanceTimersByTimeAsync(200);
    expect(loadNextIndex).toHaveBeenCalledTimes(1);
    expect(applyNextIndex).toHaveBeenCalledWith(nextIndex);
    expect(listener).toHaveBeenCalledTimes(1);

    controller.schedule();
    await jest.advanceTimersByTimeAsync(200);
    expect(loadNextIndex).toHaveBeenCalledTimes(2);
    expect(applyNextIndex).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledTimes(1);
    controller.dispose();
    jest.useRealTimers();
  });

  it('после dispose не выполняет ожидающий refresh и игнорирует новые watcher events', async () => {
    jest.useFakeTimers();
    const loadNextIndex = jest.fn<Promise<IndexRevision | false>, []>().mockResolvedValue({ revision: 'новый' });
    const applyNextIndex = jest.fn();
    const controller = new CodeLensRefreshController(loadNextIndex, applyNextIndex, 200);
    const listener = jest.fn();
    controller.onDidChangeCodeLenses(listener);

    controller.schedule();
    controller.dispose();
    await jest.advanceTimersByTimeAsync(200);
    controller.schedule();
    await jest.advanceTimersByTimeAsync(200);
    expect(loadNextIndex).not.toHaveBeenCalled();
    expect(applyNextIndex).not.toHaveBeenCalled();
    expect(listener).not.toHaveBeenCalled();
    jest.useRealTimers();
  });

  it('не публикует завершившийся refresh, если extension был disposed во время загрузки index', async () => {
    jest.useFakeTimers();
    let completeRefresh: ((next: IndexRevision | false) => void) | undefined;
    const loadNextIndex = jest.fn(() => new Promise<IndexRevision | false>((resolve) => { completeRefresh = resolve; }));
    const applyNextIndex = jest.fn();
    const controller = new CodeLensRefreshController(loadNextIndex, applyNextIndex, 200);
    const listener = jest.fn();
    controller.onDidChangeCodeLenses(listener);

    controller.schedule();
    await jest.advanceTimersByTimeAsync(200);
    controller.dispose();
    completeRefresh?.({ revision: 'новый' });
    await Promise.resolve();
    expect(applyNextIndex).not.toHaveBeenCalled();
    expect(listener).not.toHaveBeenCalled();
    jest.useRealTimers();
  });

  it('сохраняет последний index, когда свежий B завершается раньше устаревшего A', async () => {
    jest.useFakeTimers();
    let resolveA: ((next: IndexRevision | false) => void) | undefined;
    let resolveB: ((next: IndexRevision | false) => void) | undefined;
    const loadNextIndex = jest.fn<Promise<IndexRevision | false>, []>()
      .mockImplementationOnce(() => new Promise<IndexRevision | false>((resolve) => { resolveA = resolve; }))
      .mockImplementationOnce(() => new Promise<IndexRevision | false>((resolve) => { resolveB = resolve; }));
    const applied: string[] = [];
    const controller = new CodeLensRefreshController(loadNextIndex, (next) => applied.push(next.revision), 200);
    const listener = jest.fn();
    controller.onDidChangeCodeLenses(listener);

    controller.schedule();
    await jest.advanceTimersByTimeAsync(200);
    controller.schedule();
    await jest.advanceTimersByTimeAsync(200);
    resolveB?.({ revision: 'B' });
    await Promise.resolve();
    resolveA?.({ revision: 'A' });
    await Promise.resolve();

    expect(applied).toEqual(['B']);
    expect(listener).toHaveBeenCalledTimes(1);
    controller.dispose();
    jest.useRealTimers();
  });

  it('не применяет resolved false после ошибки чтения index', async () => {
    jest.useFakeTimers();
    const loadNextIndex = jest.fn<Promise<IndexRevision | false>, []>().mockResolvedValue(false);
    const applyNextIndex = jest.fn();
    const controller = new CodeLensRefreshController(loadNextIndex, applyNextIndex, 200);
    const listener = jest.fn();
    controller.onDidChangeCodeLenses(listener);

    controller.schedule();
    await jest.advanceTimersByTimeAsync(200);
    expect(applyNextIndex).not.toHaveBeenCalled();
    expect(listener).not.toHaveBeenCalled();
    controller.dispose();
    jest.useRealTimers();
  });
});
