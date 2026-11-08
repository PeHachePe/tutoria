import { createDebouncer } from './create-debouncer';

describe('createDebouncer', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('runs the task once the wait has passed without another schedule', () => {
    const debouncer = createDebouncer(800);
    const task = vi.fn();

    debouncer.schedule(task);
    vi.advanceTimersByTime(799);
    expect(task).not.toHaveBeenCalled();
    expect(debouncer.isPending()).toBe(true);

    vi.advanceTimersByTime(1);
    expect(task).toHaveBeenCalledOnce();
    expect(debouncer.isPending()).toBe(false);
  });

  it('restarts the wait and keeps only the latest task on each schedule', () => {
    const debouncer = createDebouncer(800);
    const first = vi.fn();
    const latest = vi.fn();

    debouncer.schedule(first);
    vi.advanceTimersByTime(500);
    debouncer.schedule(latest);
    vi.advanceTimersByTime(500);
    expect(latest).not.toHaveBeenCalled();

    vi.advanceTimersByTime(300);
    expect(first).not.toHaveBeenCalled();
    expect(latest).toHaveBeenCalledOnce();
  });

  it('runs the pending task at once on flush, and only once', () => {
    const debouncer = createDebouncer(800);
    const task = vi.fn();

    debouncer.schedule(task);
    debouncer.flush();
    expect(task).toHaveBeenCalledOnce();
    expect(debouncer.isPending()).toBe(false);

    vi.advanceTimersByTime(800);
    expect(task).toHaveBeenCalledOnce();
  });

  it('does nothing on flush without a pending task', () => {
    const debouncer = createDebouncer(800);

    expect(() => debouncer.flush()).not.toThrow();
    expect(debouncer.isPending()).toBe(false);
  });

  it('drops the pending task on cancel', () => {
    const debouncer = createDebouncer(800);
    const task = vi.fn();

    debouncer.schedule(task);
    debouncer.cancel();
    vi.advanceTimersByTime(800);

    expect(task).not.toHaveBeenCalled();
    expect(debouncer.isPending()).toBe(false);
  });
});
