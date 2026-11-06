import type { ProcessEvent } from './process-event';
import type { TutorInteraction } from './tutor';

/** `not_started` is never stored: it describes an exercise without an attempt. */
export type AttemptStatus = 'not_started' | 'in_progress' | 'tests_failed' | 'passed' | 'submitted';

/** Status of an attempt that exists. */
export type StoredAttemptStatus = Exclude<AttemptStatus, 'not_started'>;

/** Table `attempt`. Only the server changes `status` and `finalCode` (2.4). */
export interface Attempt {
  readonly id: string;
  readonly exerciseId: string;
  readonly userId: string;
  readonly assignmentId: string | null;
  readonly currentCode: string;
  /** Frozen on submission. */
  readonly finalCode: string | null;
  readonly status: StoredAttemptStatus;
  readonly startedAt: string;
  readonly finishedAt: string | null;
  /** Changes with every save of the code and every change of status. */
  readonly updatedAt: string;
}

/** Result of one test after a run. */
export interface TestResult {
  readonly testId: string;
  readonly passed: boolean;
  readonly timeout: boolean;
  /** Runtime error message, if any. */
  readonly error?: string;
  /** Input, expected and actual values: visible tests only. */
  readonly input?: readonly unknown[];
  readonly expected?: unknown;
  readonly actual?: unknown;
}

/** Result of running every test of an attempt. */
export interface RunResult {
  /** Decided by the server (or by the mock service). */
  readonly status: StoredAttemptStatus;
  readonly results: readonly TestResult[];
}

/** What the timeline of an attempt shows. */
export interface AttemptHistory {
  readonly attempt: Attempt;
  readonly events: readonly ProcessEvent[];
  readonly interactions: readonly TutorInteraction[];
}
