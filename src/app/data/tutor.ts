import type { AppLocale } from '../core/i18n/locale';
import type { HintLevel, Emotion, Intensity, TutorTrigger } from './tutor/tutor-contract';

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
  TUTOR_TRIGGERS,
  type TutorEvent,
  type TutorTrigger,
} from './tutor/tutor-contract';

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
  /** Current editor content, so the tutor always sees the latest code. */
  readonly code: string;
  /** Language of the interface, which the tutor answers in (D-033). */
  readonly language: AppLocale;
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
  readonly promptVersion: string;
  readonly createdAt: string;
}
