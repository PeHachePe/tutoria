import type { AppLocale } from '../core/locale';

export type HintLevel = 1 | 2 | 3;

/** The most concrete hint: asking for another one stays there (2.6). */
export const MAX_HINT_LEVEL: HintLevel = 3;

export type TutorTrigger = 'question' | 'hint' | 'proactive';

export type Emotion = 'joy' | 'surprise' | 'encouragement' | 'celebration';

export type Intensity = 1 | 2 | 3;

/**
 * The visual reactions the tutor can choose for an answer (1.8, D-035): each one has its own
 * choreography on screen. The emotion is the data the teacher analyses; the reaction is only how
 * it looks, so it is optional and falls back to the one of the emotion.
 */
export const REACTION_KINDS = [
  'hearts',
  'cheer',
  'trophy',
  'lightbulb',
  'rocket',
  'fire',
  'applause',
  'mind-blown',
  'paper-ball',
  'eyes',
  'laugh',
  'grumpy',
] as const;

export type ReactionKind = (typeof REACTION_KINDS)[number];

/** The reaction of each emotion, when the tutor does not choose one. */
export const EMOTION_REACTIONS: Record<Emotion, ReactionKind> = {
  joy: 'hearts',
  surprise: 'mind-blown',
  encouragement: 'cheer',
  celebration: 'trophy',
};

/** What the client sends to the tutor (2.6). */
export interface TutorRequest {
  readonly attemptId: string;
  readonly kind: TutorTrigger;
  /** Only for `question`. */
  readonly message?: string;
  /** Current editor content, so the tutor always sees the latest code. */
  readonly code: string;
  /** Language of the interface, which the tutor answers in (D-033). */
  readonly language: AppLocale;
}

/** Each answer arrives as `meta` → `delta`(s) → `done`. */
export type TutorEvent =
  | {
      readonly type: 'meta';
      readonly emotion: Emotion;
      readonly intensity: Intensity;
      readonly hintLevel: HintLevel;
      /** How the reaction looks; without it, the one of the emotion. */
      readonly reaction?: ReactionKind;
    }
  | { readonly type: 'delta'; readonly text: string }
  | {
      readonly type: 'done';
      readonly interactionId: string | null;
      /** The model chose not to intervene. */
      readonly silent: boolean;
    };

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
