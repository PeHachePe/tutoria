import type { ProcessEvent } from './process-event';
import type { TutorInteraction } from './tutor';

// The result of a run lives with the code it shares with the Edge Function `execute` (D-042)
export type { RunLoadError, RunResult, TestResult } from './code-runner/run-result';

/** `not_started` is never stored: it describes an exercise without an attempt. */
export type AttemptStatus = 'not_started' | 'in_progress' | 'tests_failed' | 'passed' | 'submitted';

/** Status of an attempt that exists. */
export type StoredAttemptStatus = Exclude<AttemptStatus, 'not_started'>;

/** Table `attempt`. Only the server changes `status` and `finalCode` (2.4). */
export interface Attempt {
  readonly id: string;
  readonly exerciseId: string;
  readonly userId: string;
  /** The assignment it was opened from; null once unassigned. */
  readonly assignmentId: string | null;
  /** 1 counts for the class; the next ones are practice, each once the previous is submitted (2.5c). */
  readonly number: number;
  readonly currentCode: string;
  /** Frozen on submission. */
  readonly finalCode: string | null;
  readonly status: StoredAttemptStatus;
  readonly startedAt: string;
  readonly finishedAt: string | null;
  /** Changes with every save of the code and every change of status. */
  readonly updatedAt: string;
}

/** What the timeline of an attempt shows. */
export interface AttemptHistory {
  readonly attempt: Attempt;
  readonly events: readonly ProcessEvent[];
  readonly interactions: readonly TutorInteraction[];
}
