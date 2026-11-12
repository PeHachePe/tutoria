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

/**
 * A call to one of the tools of the tutor (2.5e, `tutor-tools.ts`): its name and its arguments,
 * checked by the server against the contract before they reach the app.
 */
export interface ToolRequest {
  readonly name: string;
  readonly arguments: Readonly<Record<string, unknown>>;
}

/** What a query gave, run by the app and sent back with the same request (2.5e, D-051). */
export interface ToolResult extends ToolRequest {
  /** The data of the query, or why it failed (`{ error }`). */
  readonly result: unknown;
}

/**
 * Each answer arrives as `meta` → `delta`(s) → `done`. When the model needs data of the student
 * first, the answer is only `query`: the app runs those queries and asks again with their results
 * (2.5e).
 */
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
      /**
       * What the tutor does with its tools (2.5e): the views at once, the rest with a button the
       * student presses. Without it, none.
       */
      readonly actions?: readonly ToolRequest[];
    }
  | { readonly type: 'delta'; readonly text: string }
  | { readonly type: 'query'; readonly calls: readonly ToolRequest[] }
  | {
      readonly type: 'done';
      readonly interactionId: string | null;
      /** The model chose not to intervene. */
      readonly silent: boolean;
    };

/** What the level depends on: the earlier turns of the attempt, by kind, level and what was said. */
export interface LeveledTurn {
  readonly trigger: TutorTrigger;
  /** Null while the answer has not said it. */
  readonly hintLevel: HintLevel | null;
  /** What the student wrote; null for a hint or an intervention of the tutor. */
  readonly studentMessage: string | null;
}

/**
 * The level the help has reached: the highest of the hints so far, 0 before the first. An answer that
 * was not a hint counts once it went past level 1, which only being stuck does (2.5d).
 */
export function reachedHintLevel(previous: readonly LeveledTurn[]): HintLevel | 0 {
  return previous.reduce<HintLevel | 0>(
    (level, turn) =>
      turn.hintLevel !== null &&
      (turn.trigger === 'hint' || turn.hintLevel > 1) &&
      turn.hintLevel > level
        ? turn.hintLevel
        : level,
    0,
  );
}

/**
 * The level of the next answer, decided by the server (2.6): a hint raises it, up to 3; a question
 * or an intervention of the tutor is answered at the current one, at least 1. Saying again that they
 * are stuck («no sé», «no me acuerdo») raises it too, without waiting for «Pedir pista» (2.5d).
 */
export function answerHintLevel(
  kind: TutorTrigger,
  previous: readonly LeveledTurn[],
  message?: string,
): HintLevel {
  const reached = reachedHintLevel(previous);
  const current = Math.max(reached, 1);
  if (kind === 'hint') return Math.min(reached + 1, MAX_HINT_LEVEL) as HintLevel;
  if (kind === 'question' && stuckAgain(previous, message)) {
    return Math.min(current + 1, MAX_HINT_LEVEL) as HintLevel;
  }
  return current as HintLevel;
}

/** Opens and closes a block of code in an answer, as the chat shows it. */
const CODE_FENCE = '```';

/** A name a parameter can have: a plain identifier, no default value nor destructuring. */
const PARAMETER_NAME = /^[A-Za-z_$][\w$]*$/;

/** For the parameters the suggested names do not cover. */
const FALLBACK_PARAMETER_NAMES = 'abcdefgh';

/**
 * The empty skeleton of a function in a block of code (2.5d): its signature and its closing brace,
 * nothing inside. It is the only code the tutor gives, and the server writes it, never the model: with
 * the names the model suggests when they are plain identifiers, and letters for any missing.
 */
export function skeletonBlock(
  functionName: string,
  parameters: number,
  names: readonly string[] = [],
): string {
  const code = skeletonCode(functionName, skeletonParameters(parameters, names));
  return [`${CODE_FENCE}js`, code, CODE_FENCE].join('\n');
}

/**
 * The names of the parameters of the skeleton: those suggested that are plain identifiers, and
 * letters for any missing. They also go with «Insertar» (`insertSkeleton`, 2.5f).
 */
export function skeletonParameters(parameters: number, names: readonly string[] = []): string[] {
  const valid = names.filter((name) => PARAMETER_NAME.test(name));
  return Array.from(
    { length: parameters },
    (_, index) => valid[index] ?? FALLBACK_PARAMETER_NAMES[index],
  );
}

/** The empty function, as the block shows it and «Insertar» writes it in the editor (2.5f). */
export function skeletonCode(functionName: string, parameters: readonly string[]): string {
  return `function ${functionName}(${parameters.join(', ')}) {\n}`;
}

/** Whether a turn got more help than the level reached before it without a hint being asked. */
export function raisesHintLevel(turn: LeveledTurn, before: readonly LeveledTurn[]): boolean {
  return (
    turn.trigger !== 'hint' &&
    turn.hintLevel !== null &&
    turn.hintLevel > Math.max(reachedHintLevel(before), 1)
  );
}

/**
 * Ways of saying «I don't know», «I don't remember» or «I'm stuck» in the three languages of the
 * interface (D-033), compared in lower case and without accents. A bare «no se» needs an ending that
 * makes it «no sé» («no se como seguir»), as «no se ejecuta» is not being stuck.
 */
const STUCK_PATTERNS: readonly RegExp[] = [
  /\bno (?:lo |ho )?se(?= *(?:$|[.,;:!?)]|hacer|seguir|continuar|empezar|fer|(?:como|por donde|por on|que|nada|ni|com)\b))/,
  /\b(?:ni|no) idea\b/,
  /\bno (?:me |me'n |men )?(?:acuerdo|recuerdo|recordo)\b/,
  /\bno (?:lo |la |ho )?(?:entiendo|pillo|capto|entenc)\b/,
  /\b(?:atascad|bloquead|encallad|encallat|bloquejat)/,
  /\bsigo sin (?:saber|entender)/,
  /\b(?:do ?n'?t|do not|didn'?t) (?:know|remember|understand|get it)\b/,
  /\b(?:can'?t|cannot) remember\b/,
  /\bstuck\b/,
];

/** Whether the student says they do not know how to go on (2.5d). */
export function isStuckMessage(message: string | null | undefined): boolean {
  if (!message) return false;
  const text = message
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[\u2018\u2019\u00b4`]/g, "'");
  return STUCK_PATTERNS.some((pattern) => pattern.test(text));
}

/** Stuck now and the last time they said something, past the interventions of the tutor. */
function stuckAgain(previous: readonly LeveledTurn[], message: string | undefined): boolean {
  const said = previous.filter((turn) => turn.trigger !== 'proactive').at(-1);
  return (
    isStuckMessage(message) && said?.trigger === 'question' && isStuckMessage(said.studentMessage)
  );
}
