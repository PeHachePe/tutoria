import { runJob } from './run-job';
import type { RunRequest } from '../../code-runner/run-result';

// Mock code runner (4.3): one Worker per run, so an endless loop only blocks this thread, which
// the page ends after the time limit, and a run never sees what the previous one left behind.
addEventListener('message', ({ data }: MessageEvent<RunRequest>) => {
  runJob(data, (message) => postMessage(message));
});
