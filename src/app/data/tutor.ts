import type { AppLocale } from '../core/i18n/locale';
import type { CheckTest } from './code-runner/run-result';
import type { TranslatableExercise } from './localized-text';
import type { ProactiveReason } from '../shared/proactive-reason';
import type {
  Emotion,
  HintLevel,
  Intensity,
  ToolRequest,
  ToolResult,
  TutorTrigger,
} from './tutor/tutor-contract';

// The contract the Edge Function `tutor` shares with the app lives in a file without imports
export {
  answerHintLevel,
  type Emotion,
  EMOTION_REACTIONS,
  EMOTIONS,
  type HintLevel,
  type Intensity,
  isStuckMessage,
  type LeveledTurn,
  MAX_HINT_LEVEL,
  REACTION_KINDS,
  REACTION_USES,
  raisesHintLevel,
  type ReactionKind,
  reachedHintLevel,
  skeletonBlock,
  skeletonCode,
  skeletonParameters,
  type ToolRequest,
  type ToolResult,
  TUTOR_TRIGGERS,
  type TutorEvent,
  type TutorTrigger,
} from './tutor/tutor-contract';
// Shared with the server too, and with the teacher's panel
export { PROACTIVE_REASONS, type ProactiveReason } from '../shared/proactive-reason';

/** What the client sends to the tutor (2.6). */
export interface TutorRequest {
  /**
   * Chosen by the client for each turn and sent again when it retries it: the server answers a
   * request it already recorded with that answer, so a retry never raises the level twice (2.6).
   */
  readonly requestId: string;
  readonly attemptId: string;
  readonly kind: TutorTrigger;
  /** Only for `question`. */
  readonly message?: string;
  /** Why the tutor steps in (2.7): only for `proactive`, and required. */
  readonly reason?: ProactiveReason;
  /** Current editor content, so the tutor always sees the latest code. */
  readonly code: string;
  /** Language of the interface, which the tutor answers in (D-033). */
  readonly language: AppLocale;
  /**
   * What the queries the tutor asked for gave, run by the app: the same request goes again with
   * them, and the tutor answers with the data (2.5e).
   */
  readonly results?: readonly ToolResult[];
}

/**
 * A turn of a teacher trying an exercise as a student (4.3e, D-061): the exercise as it is in the
 * form, saved or not, and the try so far, which lives only in the browser. Nothing of it is kept.
 */
export interface TutorPreviewRequest extends Omit<TutorRequest, 'attemptId'> {
  readonly preview: TutorPreview;
}

/** What the tutor knows of an attempt, sent by the app because no attempt exists. */
export interface TutorPreview {
  readonly exercise: TranslatableExercise & {
    readonly functionName: string;
    readonly parameters: readonly string[];
    readonly tests: readonly CheckTest[];
  };
  readonly status: 'in_progress' | 'tests_failed' | 'passed';
  /** What the last run gave, with the ids of a check (`test-1`…); null before running. */
  readonly lastRun: {
    readonly passed: number;
    readonly failed: number;
    readonly failedTestIds: readonly string[];
  } | null;
  /** The earlier turns of the try, oldest first, so the hint level goes up as with a student. */
  readonly previous: readonly PreviewTurn[];
}

/** An earlier turn of a try, as the server needs it. */
export interface PreviewTurn {
  readonly trigger: TutorTrigger;
  readonly hintLevel: HintLevel;
  readonly studentMessage: string | null;
  readonly transcript: string;
  readonly emotion: Emotion;
  readonly intensity: Intensity;
  readonly elusion: boolean;
  readonly actions: readonly ToolRequest[];
}

/** Table `tutor_interaction`, written only by the server. */
export interface TutorInteraction {
  readonly id: string;
  readonly attemptId: string;
  readonly trigger: TutorTrigger;
  readonly hintLevel: HintLevel;
  /** What the student wrote or said; null for proactive interventions. */
  readonly studentMessage: string | null;
  /** The tutor's answer. */
  readonly transcript: string;
  readonly emotion: Emotion;
  readonly intensity: Intensity;
  /** The student tried to get the solution. */
  readonly elusion: boolean;
  /** What the tutor did with its tools (2.5e); none if not said. */
  readonly actions?: readonly ToolRequest[];
  readonly promptVersion: string;
  readonly createdAt: string;
}
