import type { StoredAttemptStatus } from '../attempt';
import {
  answerHintLevel,
  type Emotion,
  type HintLevel,
  type Intensity,
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

/** Each hint level goes further: it makes the student think, switches on an idea, then takes off. */
const MAX_INTENSITY: Intensity = 3;

const HINT_REACTIONS: Record<HintLevel, ReactionKind> = {
  1: 'thinking',
  2: 'lightbulb',
  3: 'rocket',
};

/** The reactions the scripted tutor takes turns with, so all of them show up in the app. */
const ELUSION_REACTIONS: readonly ReactionKind[] = [
  'wink',
  'secret',
  'seriously',
  'throw',
  'grumpy',
];
const QUESTION_REACTIONS: readonly ReactionKind[] = ['applause', 'mind-blown', 'laugh', 'fire'];
const PROACTIVE_REACTIONS: readonly ReactionKind[] = ['eyes', 'empathy'];

/**
 * Ways of asking for the solution instead of a hint, in the three languages of the interface (2.9),
 * written without accents: the message is compared without them.
 */
const ELUSION_PATTERN =
  /soluci|solution|resuelvel|hazlo tu|dame el codigo|escribe(me)? (el|la|tu) (codigo|funcion)|codigo (completo|entero)|escriu(-me)? el codi|dona'?m el codi|write (me )?the (code|function)|give me the code/;

const STATEMENT_PATTERN = /enunciado|enunciat|statement/;

/**
 * The answer of the scripted tutor (4.3). The level follows the rules of the server (2.6), with the
 * same function. It never gives the
 * solution: asking for it gets a question back and is recorded as an elusion.
 */
export function scriptedAnswer({
  kind,
  message,
  code,
  status,
  previous,
}: ScriptInput): ScriptedAnswer {
  const hintLevel = answerHintLevel(kind, previous);
  const answer = (
    text: string,
    emotion: Emotion,
    reaction: ReactionKind,
    // The scripted tutor shows the reactions at their fullest; the real one chooses (2.6)
    intensity: Intensity = MAX_INTENSITY,
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
        : answer(PROACTIVE_MESSAGE, 'encouragement', proactiveReaction(previous));
    case 'question': {
      const question = withoutAccents(message ?? '');
      // Asking for the solution gets a joke: «hey, not that»
      if (ELUSION_PATTERN.test(question)) {
        // Each time a different joke: a wink, the monkeys, «seriously?», something thrown, then a
        // mock anger
        const elusions = previous.filter((interaction) => interaction.elusion).length;
        const joke = ELUSION_REACTIONS[elusions % ELUSION_REACTIONS.length];
        return answer(ELUSION_ANSWER, 'surprise', joke, MAX_INTENSITY, true);
      }
      if (status === 'passed') return answer(PASSED_ANSWER, 'celebration', 'party');
      if (STATEMENT_PATTERN.test(question)) return answer(STATEMENT_ANSWER, 'joy', 'hearts');
      if (!code.trim()) return answer(START_ANSWER, 'encouragement', 'cheer');
      // A question with code to look at: it applauds the effort, its mind is blown, or it laughs
      return answer(hint, 'joy', QUESTION_REACTIONS[previous.length % QUESTION_REACTIONS.length]);
    }
  }
}

function withoutAccents(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** The proactive tutor takes turns: it looks in, then shows it understands. */
function proactiveReaction(previous: readonly TutorInteraction[]): ReactionKind {
  const before = previous.filter((interaction) => interaction.trigger === 'proactive').length;
  return PROACTIVE_REACTIONS[before % PROACTIVE_REACTIONS.length];
}
