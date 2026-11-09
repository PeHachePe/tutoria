import type { StoredAttemptStatus } from '../attempt';
import {
  type Emotion,
  type HintLevel,
  type Intensity,
  MAX_HINT_LEVEL,
  type ReactionKind,
  type TutorInteraction,
  type TutorTrigger,
} from '../tutor';
import {
  ELUSION_ANSWER,
  PASSED_ANSWER,
  PROACTIVE_MESSAGE,
  START_ANSWER,
  STATEMENT_ANSWER,
  TUTOR_ANSWERS,
} from './fixtures/tutor-script';

/** What the scripted tutor looks at: the request, the attempt and the conversation so far. */
export interface ScriptInput {
  readonly kind: TutorTrigger;
  readonly message?: string;
  readonly code: string;
  readonly status: StoredAttemptStatus;
  /** The earlier interactions of the attempt, oldest first. */
  readonly previous: readonly TutorInteraction[];
}

/** What the model would return (2.6), plus the level the server decided. */
export interface ScriptedAnswer {
  readonly text: string;
  readonly hintLevel: HintLevel;
  readonly emotion: Emotion;
  readonly intensity: Intensity;
  /** The reaction the model chose (D-035). */
  readonly reaction: ReactionKind;
  readonly elusion: boolean;
  readonly silent: boolean;
}

/** Each hint level lights up a bit more: an idea, then fire, then the rocket of the last one. */
const HINT_REACTIONS: Record<HintLevel, ReactionKind> = { 1: 'lightbulb', 2: 'fire', 3: 'rocket' };

/** The reactions the scripted tutor takes turns with, so all of them show up in the app. */
const ELUSION_REACTIONS: readonly ReactionKind[] = ['paper-ball', 'grumpy'];
const QUESTION_REACTIONS: readonly ReactionKind[] = ['applause', 'mind-blown', 'laugh'];

/**
 * Ways of asking for the solution instead of a hint, in the three languages of the interface (2.9),
 * written without accents: the message is compared without them.
 */
const ELUSION_PATTERN =
  /soluci|solution|resuelvel|hazlo tu|dame el codigo|escribe(me)? (el|la|tu) (codigo|funcion)|codigo (completo|entero)|escriu(-me)? el codi|dona'?m el codi|write (me )?the (code|function)|give me the code/;

const STATEMENT_PATTERN = /enunciado|enunciat|statement/;

/** Words per chunk of the answer, as the mock writes it a little at a time. */
const WORDS_PER_CHUNK = 3;

/** The level the conversation has reached: each «Pedir pista» raised it (0 before the first). */
export function currentHintLevel(previous: readonly TutorInteraction[]): HintLevel | 0 {
  const hints = previous.filter((interaction) => interaction.trigger === 'hint').length;
  return Math.min(hints, MAX_HINT_LEVEL) as HintLevel | 0;
}

/**
 * The answer of the scripted tutor (4.3). The level follows the rules of the server (2.6): a hint
 * raises it, up to 3, and the rest is answered at the current one, at least 1. It never gives the
 * solution: asking for it gets a question back and is recorded as an elusion.
 */
export function scriptedAnswer({
  kind,
  message,
  code,
  status,
  previous,
}: ScriptInput): ScriptedAnswer {
  const current = currentHintLevel(previous);
  const hintLevel = (
    kind === 'hint' ? Math.min(current + 1, MAX_HINT_LEVEL) : Math.max(current, 1)
  ) as HintLevel;
  const answer = (
    text: string,
    emotion: Emotion,
    reaction: ReactionKind,
    intensity: Intensity = 1,
    elusion = false,
  ) => ({ text, hintLevel, emotion, reaction, intensity, elusion, silent: false });
  const hint = TUTOR_ANSWERS[hintLevel][previous.length % TUTOR_ANSWERS[hintLevel].length];

  switch (kind) {
    case 'hint':
      return answer(hint, 'encouragement', HINT_REACTIONS[hintLevel]);
    case 'proactive':
      // Once is enough: right after stepping in, it lets the student work
      return previous.at(-1)?.trigger === 'proactive'
        ? { ...answer('', 'encouragement', 'eyes'), silent: true }
        : answer(PROACTIVE_MESSAGE, 'encouragement', 'eyes', 2);
    case 'question': {
      const question = withoutAccents(message ?? '');
      // Asking for the solution gets a joke: «hey, not that»
      if (ELUSION_PATTERN.test(question)) {
        // Each time a different joke: the paper ball, then the grumpy face
        const elusions = previous.filter((interaction) => interaction.elusion).length;
        return answer(ELUSION_ANSWER, 'surprise', ELUSION_REACTIONS[elusions % 2], 2, true);
      }
      if (status === 'passed') return answer(PASSED_ANSWER, 'celebration', 'trophy', 2);
      if (STATEMENT_PATTERN.test(question)) return answer(STATEMENT_ANSWER, 'joy', 'hearts');
      if (!code.trim()) return answer(START_ANSWER, 'encouragement', 'cheer');
      // A question with code to look at: it applauds the effort, its mind is blown, or it laughs
      return answer(hint, 'joy', QUESTION_REACTIONS[previous.length % QUESTION_REACTIONS.length]);
    }
  }
}

/** The answer in chunks of a few words, which the mock sends one by one as `delta` events. */
export function typingChunks(text: string): string[] {
  const words = text.match(/\S+\s*/g) ?? [];
  const chunks: string[] = [];
  for (let start = 0; start < words.length; start += WORDS_PER_CHUNK) {
    chunks.push(words.slice(start, start + WORDS_PER_CHUNK).join(''));
  }
  return chunks;
}

function withoutAccents(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}
