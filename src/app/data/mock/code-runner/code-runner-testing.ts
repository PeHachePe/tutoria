import type { Provider } from '@angular/core';

import { CODE_RUNNER_WORKER } from './code-runner-worker';
import { runJob } from './run-job';
import type { RunMessage, RunRequest } from './run-protocol';

/** What a fake Worker does with the request it gets. */
export type WorkerScript = (request: RunRequest, worker: FakeWorker) => void;

/** Runs the real job in the same thread, as the Worker would in its own. */
export const RUN_IN_THREAD: WorkerScript = (request, worker) =>
  runJob(request, (message) => worker.emit(message));

/** Test double of the code runner's Worker, which jsdom lacks. */
export class FakeWorker {
  onmessage: ((event: MessageEvent<RunMessage>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  terminated = false;

  constructor(private readonly script: WorkerScript = RUN_IN_THREAD) {}

  postMessage(request: RunRequest): void {
    queueMicrotask(() => this.script(request, this));
  }

  /** Sends a message to the page, unless the page already ended the Worker. */
  emit(message: RunMessage): void {
    if (!this.terminated) this.onmessage?.({ data: message } as MessageEvent<RunMessage>);
  }

  terminate(): void {
    this.terminated = true;
  }
}

/** The mock code runner with Workers that run in the same thread (the explorer, the screens). */
export function provideInThreadCodeRunner(): Provider {
  return { provide: CODE_RUNNER_WORKER, useValue: () => new FakeWorker() as unknown as Worker };
}
