import type { RunResult, RunTest } from '../../../src/app/data/code-runner/run-result.ts';

/** What the function needs to know of an attempt before running it. */
export interface RunAttempt {
  readonly userId: string;
  /** Whether its owner's account is active (`app_user.status`). */
  readonly ownerActive: boolean;
  readonly status: 'in_progress' | 'tests_failed' | 'passed' | 'submitted';
  readonly functionName: string;
  /** All of them, hidden ones included, in their order. */
  readonly tests: readonly RunTest[];
}

/** Whether the run was kept, or why not: the attempt was submitted or deleted meanwhile. */
export type RecordOutcome = 'recorded' | 'submitted' | 'not_found';

/** What the function reads and writes, with `service_role` (`SupabaseRunStore`). */
export interface RunStore {
  /** The user of a session token, or `null` if it is not valid. */
  userOf(token: string): Promise<string | null>;
  findAttempt(attemptId: string): Promise<RunAttempt | null>;
  /** When the user's latest runs since `since` were received, newest first and `limit` at most. */
  latestRuns(userId: string, since: Date, limit: number): Promise<readonly Date[]>;
  /** The code that ran, the status it earned and the `run` event, all or nothing (`record_run`). */
  recordRun(attemptId: string, code: string, result: RunResult): Promise<RecordOutcome>;
}
