import { InjectionToken } from '@angular/core';

/**
 * Creates the Worker of each run (4.3). A token, so the tests give a double instead: jsdom has no
 * Workers. The Angular builder bundles the worker file on its own from this `new URL(…)`.
 */
export const CODE_RUNNER_WORKER = new InjectionToken<() => Worker>('CODE_RUNNER_WORKER', {
  factory: () => () =>
    new Worker(new URL('./code-runner.worker', import.meta.url), { type: 'module' }),
});
