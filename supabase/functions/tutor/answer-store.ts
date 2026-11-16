import type { RunTest } from '../../../src/app/data/code-runner/run-result.ts';
import type { TranslatableExercise } from '../../../src/app/data/localized-text.ts';
import type {
  Emotion,
  HintLevel,
  Intensity,
  ToolRequest,
  TutorTrigger,
} from '../../../src/app/data/tutor/tutor-contract.ts';
import type { ProviderSetting } from '../_shared/provider-setting.ts';
import type { ModelAnswer } from './model-answer.ts';

/** An earlier turn of the conversation, oldest first. */
export interface PreviousTurn {
  readonly trigger: TutorTrigger;
  readonly hintLevel: HintLevel;
  readonly studentMessage: string | null;
  readonly transcript: string;
  /** How the tutor answered, sent back with its message as the JSON it wrote (2.5d). */
  readonly emotion: Emotion;
  readonly intensity: Intensity;
  readonly elusion: boolean;
  /** What the tutor did with its tools (2.5e), so it knows it already did it. */
  readonly actions: readonly ToolRequest[];
}

/** What the last run left in its `run` event (2.8). */
export interface LastRun {
  readonly passed: number;
  readonly failed: number;
  readonly failedTestIds: readonly string[];
}

/** What the tutor needs to know of an attempt to answer about it. */
export interface TutorAttempt {
  readonly userId: string;
  /** Whether its owner's account is active (`app_user.status`). */
  readonly ownerActive: boolean;
  readonly status: 'in_progress' | 'tests_failed' | 'passed' | 'submitted';
  /** Whether its student still sees its assignment and is in its group (`is_open_attempt`). */
  readonly open: boolean;
  /** The code the server has: the last run's while the attempt is not back in progress. */
  readonly currentCode: string;
  /** Its texts in every language it has: the prompt takes those of the request (D-045). */
  readonly exercise: TranslatableExercise & {
    readonly functionName: string;
    /** The names of its parameters, in English; empty if the exercise does not have them (D-057). */
    readonly parameters: readonly string[];
    /** All of them, in their order: the prompt only shows the values of the visible ones. */
    readonly tests: readonly RunTest[];
  };
  readonly lastRun: LastRun | null;
  readonly previous: readonly PreviousTurn[];
}

/** An answer already recorded for a request, to give it back to a retry. */
export interface RecordedAnswer {
  readonly id: string;
  readonly attemptId: string;
  readonly hintLevel: HintLevel;
  readonly emotion: Emotion;
  readonly intensity: Intensity;
  readonly transcript: string;
  readonly elusion: boolean;
  readonly actions: readonly ToolRequest[];
}

/** What is kept of an answer: `answer` is null when the tutor chose to keep quiet. */
export interface NewAnswer {
  readonly attemptId: string;
  readonly requestId: string;
  readonly trigger: TutorTrigger;
  readonly hintLevel: HintLevel;
  readonly studentMessage: string | null;
  readonly answer: ModelAnswer | null;
  readonly promptVersion: string;
  readonly model: string;
  /** Answers of the model the validator turned down before this one: 0 to 2 (D-044). */
  readonly rejected: number;
}

/**
 * Whether the answer was kept, with its id (null if the tutor kept quiet), or why not: the request
 * was answered meanwhile, or the attempt was submitted or deleted.
 */
export type RecordOutcome =
  | { readonly status: 'recorded'; readonly interactionId: string | null }
  | { readonly status: 'duplicate' | 'submitted' | 'not_found' };

/** What the function reads and writes, with `service_role` (`SupabaseAnswerStore`). */
export interface AnswerStore {
  /** The user of a session token, or `null` if it is not valid. */
  userOf(token: string): Promise<string | null>;
  findAttempt(attemptId: string): Promise<TutorAttempt | null>;
  findAnswer(requestId: string): Promise<RecordedAnswer | null>;
  /** Keeps the queries the model asked for in a request, until the app answers them (2.5e). */
  keepQueries(requestId: string, userId: string, queries: readonly ToolRequest[]): Promise<void>;
  /** The queries the request of the user waits for, taken: once. `null` if it waits for none. */
  takeQueries(requestId: string, userId: string): Promise<readonly ToolRequest[] | null>;
  providerSetting(): Promise<ProviderSetting | null>;
  /** The answer and its process event, all or nothing (`record_tutor_interaction`). */
  recordAnswer(answer: NewAnswer): Promise<RecordOutcome>;
}
