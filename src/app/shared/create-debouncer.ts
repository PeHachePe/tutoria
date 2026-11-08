/** Runs the latest scheduled task once a wait has passed without another schedule. */
export interface Debouncer {
  /** Restarts the wait and replaces the pending task, if any. */
  schedule(task: () => void): void;
  /** Runs the pending task now, if there is one. */
  flush(): void;
  /** Drops the pending task. */
  cancel(): void;
  isPending(): boolean;
}

/** A debouncer with a wait of `ms` milliseconds, such as the autosave of the code (4.5). */
export function createDebouncer(ms: number): Debouncer {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pendingTask: (() => void) | undefined;

  const cancel = (): void => {
    clearTimeout(timer);
    timer = undefined;
    pendingTask = undefined;
  };

  const flush = (): void => {
    const task = pendingTask;
    cancel();
    task?.();
  };

  return {
    schedule(task) {
      cancel();
      pendingTask = task;
      timer = setTimeout(flush, ms);
    },
    flush,
    cancel,
    isPending: () => pendingTask !== undefined,
  };
}
