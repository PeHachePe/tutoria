import type { RunTest } from '../../../src/app/data/code-runner/run-result.ts';
import type { TranslatableExercise } from '../../../src/app/data/localized-text.ts';
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
  /** How the tutor answered, sent back with its message as the JSON it wrote (2.5d). */
  readonly emotion: Emotion;
  readonly intensity: Intensity;
  readonly elusion: boolean;
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
  /** Its texts in every language it has: the prompt takes those of the request (D-045). */
  readonly exercise: TranslatableExercise & {
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

/** How a provider wants the format of the answer asked: the JSON schema, plain JSON, or nothing. */
export type ResponseFormatMode = 'json_schema' | 'json_object' | 'none';

/** One model the tutor can ask: where, which, with which key and how (D-044). */
export interface ModelEndpoint {
  /** Up to the version, without `/chat/completions`. */
  readonly baseUrl: string;
  readonly model: string;
  /** Name of the secret with its key (`AI_API_KEY`…), never the key; null for none (Ollama). */
  readonly keySecret: string | null;
  readonly responseFormat: ResponseFormatMode;
  /** How long it may take to answer; 15 s if the setting says nothing (MODEL_TIMEOUT_MS). */
  readonly timeoutMs?: number;
}

/**
 * The models the administrator chose (`app_setting.ai_provider`): the main one and its fallbacks,
 * in order, of the same provider or of others with the chat API of OpenAI (D-044).
 */
export interface ProviderSetting {
  readonly models: readonly [ModelEndpoint, ...ModelEndpoint[]];
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
