import type { RunTest } from '../../../src/app/data/code-runner/run-result.ts';
import type {
  Emotion,
  HintLevel,
  Intensity,
  TutorTrigger,
} from '../../../src/app/data/tutor/tutor-contract.ts';
import type { ModelAnswer } from './model-answer.ts';

/** An earlier turn of the conversation, oldest first. */
export interface PreviousTurn {
  readonly trigger: TutorTrigger;
  readonly hintLevel: HintLevel;
  readonly studentMessage: string | null;
  readonly transcript: string;
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
  /** The code the server has: the last run's while the attempt is not back in progress. */
  readonly currentCode: string;
  readonly exercise: {
    readonly title: string;
    readonly statement: string;
    readonly functionName: string;
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
}

/** The provider the administrator chose (`app_setting.ai_provider`); its key is a secret. */
export interface ProviderSetting {
  readonly baseUrl: string;
  readonly model: string;
  /** The model that answers when the main one fails, of the same provider (D-044). */
  readonly fallbackModel?: string;
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
  /** When the user's latest calls to the model since `since` were made, newest first. */
  latestCalls(userId: string, since: Date, limit: number): Promise<readonly Date[]>;
  providerSetting(): Promise<ProviderSetting | null>;
  /** The answer and its process event, all or nothing (`record_tutor_interaction`). */
  recordAnswer(answer: NewAnswer): Promise<RecordOutcome>;
}
