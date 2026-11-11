/**
 * What the tutor is and answers, shared by the app, the scripted tutor and the Edge Function `tutor`
 * (2.6): the events of an answer, the catalog of reactions and how the server decides the hint level.
 * The Edge Function imports this file as it is, so it must not import anything: the Edge Runtime
 * resolves every import, also those of types, and only with their extension (D-042).
 */

export type HintLevel = 1 | 2 | 3;

/** The most concrete hint: asking for another one stays there (2.6). */
export const MAX_HINT_LEVEL: HintLevel = 3;

export const TUTOR_TRIGGERS = ['question', 'hint', 'proactive'] as const;

export type TutorTrigger = (typeof TUTOR_TRIGGERS)[number];

export const EMOTIONS = ['joy', 'surprise', 'encouragement', 'celebration'] as const;

export type Emotion = (typeof EMOTIONS)[number];

export type Intensity = 1 | 2 | 3;

/**
 * The visual reactions the tutor can choose for an answer (1.8, D-035): each one has its own
 * choreography on screen. The emotion is the data the teacher analyses; the reaction is only how
 * it looks, so it is optional and falls back to the one of the emotion.
 */
export const REACTION_KINDS = [
  'hearts',
  'cheer',
  'party',
  'thinking',
  'lightbulb',
  'rocket',
  'fire',
  'applause',
  'mind-blown',
  'laugh',
  'wink',
  'secret',
  'seriously',
  'throw',
  'grumpy',
  'eyes',
  'empathy',
  'sleepy',
] as const;

export type ReactionKind = (typeof REACTION_KINDS)[number];

/**
 * When the tutor should choose each reaction: the real tutor gets this list in its prompt (2.6). The
 * jokes (wink to grumpy) are play acting with affection, open to any relaxed moment, never when the
 * student is frustrated (D-043, which widens D-036 and D-037).
 */
export const REACTION_USES: Record<ReactionKind, string> = {
  hearts: 'Warmth: the student understood something, or thanks the tutor.',
  cheer: 'Encouragement to start or to keep going.',
  party: 'Celebration: every test passes or the exercise is done.',
  thinking: 'A hint that makes the student think: a question back, a detail to look at.',
  lightbulb: 'An idea that switches on: the key of a hint.',
  rocket: 'A big step forward: much progress at once.',
  fire: 'On a roll: several good steps in a row.',
  applause: 'Good reasoning or a good question.',
  'mind-blown': 'Admiration: a brilliant idea or solution of the student.',
  laugh: 'Humour: the student made a joke, or something funny happened.',
  wink: 'A playful «nice try» or «I see what you did there»: a cheeky shortcut, a guess, a trick.',
  secret: '«My lips are sealed»: the student asks for the solution, or for something to keep.',
  seriously:
    'A mock «seriously?»: the same slip again, an odd idea, a joke of the student, or asking for the solution again.',
  throw:
    'Something thrown at the screen, playfully: a slip repeated once too often, a cheeky remark, insisting on the solution.',
  grumpy:
    'A mock anger, as play acting: a rebel semicolon, a slip the tutor «fights» with, insisting on the solution. It blows up only at intensity 3.',
  eyes: 'The tutor looks in on its own initiative, to see how it goes.',
  empathy: 'The student is stuck or frustrated: understanding before the help.',
  sleepy: 'A long time without activity: «are you still there?».',
};

/** The reaction of each emotion, when the tutor does not choose one. */
export const EMOTION_REACTIONS: Record<Emotion, ReactionKind> = {
  joy: 'hearts',
  surprise: 'mind-blown',
  encouragement: 'cheer',
  celebration: 'party',
};

/** Each answer arrives as `meta` → `delta`(s) → `done`. */
export type TutorEvent =
  | {
      readonly type: 'meta';
      readonly emotion: Emotion;
      readonly intensity: Intensity;
      readonly hintLevel: HintLevel;
      /** How the reaction looks; without it, the one of the emotion. */
      readonly reaction?: ReactionKind;
      /**
       * The student tried to get the solution: the chat offers the ways that do help, a hint or the
       * statement (D-044). Without it, false.
       */
      readonly elusion?: boolean;
    }
  | { readonly type: 'delta'; readonly text: string }
  | {
      readonly type: 'done';
      readonly interactionId: string | null;
      /** The model chose not to intervene. */
      readonly silent: boolean;
    };

/** What the level depends on: the earlier turns of the attempt, by kind and level. */
export interface LeveledTurn {
  readonly trigger: TutorTrigger;
  /** Null while the answer has not said it. */
  readonly hintLevel: HintLevel | null;
}

/** The level «Pedir pista» has reached: the highest of the hints so far, 0 before the first. */
export function reachedHintLevel(previous: readonly LeveledTurn[]): HintLevel | 0 {
  return previous.reduce<HintLevel | 0>(
    (level, turn) =>
      turn.trigger === 'hint' && turn.hintLevel !== null && turn.hintLevel > level
        ? turn.hintLevel
        : level,
    0,
  );
}

/**
 * The level of the next answer, decided by the server (2.6): a hint raises it, up to 3; a question
 * or an intervention of the tutor is answered at the current one, at least 1.
 */
export function answerHintLevel(kind: TutorTrigger, previous: readonly LeveledTurn[]): HintLevel {
  const reached = reachedHintLevel(previous);
  return (
    kind === 'hint' ? Math.min(reached + 1, MAX_HINT_LEVEL) : Math.max(reached, 1)
  ) as HintLevel;
}
