import type { StoredAttemptStatus } from '../attempt';
import {
  answerHintLevel,
  type Emotion,
  type HintLevel,
  type Intensity,
  isStuckMessage,
  type ReactionKind,
  skeletonBlock,
  type TutorInteraction,
  type TutorTrigger,
} from '../tutor';
import type { ContentLocale } from '../localized-text';
import { syntaxBlocks, syntaxTopicsIn } from '../tutor/syntax-examples';
import { TUTOR_SCRIPTS } from './fixtures/tutor-script';

/** What the scripted tutor looks at: the request, the attempt and the conversation so far. */
export interface ScriptInput {
  readonly kind: TutorTrigger;
  readonly message?: string;
  readonly code: string;
  readonly status: StoredAttemptStatus;
  /** The earlier interactions of the attempt, oldest first. */
  readonly previous: readonly TutorInteraction[];
  /** The language of the interface, which the tutor answers in (D-033). */
  readonly language: ContentLocale;
  /** The function the exercise asks for, whose empty skeleton a stuck student gets (2.5d). */
  readonly exerciseFunction: ExerciseFunction;
}

/** The name of the function of an exercise and how many parameters it takes, from its tests. */
export interface ExerciseFunction {
  readonly name: string;
  readonly parameters: number;
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
 * same function, and it answers in the language of the request. It never gives the solution:
 * asking for it gets a question back and is recorded as an elusion.
 */
export function scriptedAnswer({
  kind,
  message,
  code,
  status,
  previous,
  language,
  exerciseFunction,
}: ScriptInput): ScriptedAnswer {
  const script = TUTOR_SCRIPTS[language];
  const hintLevel = answerHintLevel(kind, previous, message);
  const answer = (
    text: string,
    emotion: Emotion,
    reaction: ReactionKind,
    // The scripted tutor shows the reactions at their fullest; the real one chooses (2.6)
    intensity: Intensity = MAX_INTENSITY,
    elusion = false,
  ) => ({ text, hintLevel, emotion, reaction, intensity, elusion, silent: false });
  const hints = script.hints[hintLevel];
  const hint = hints[previous.length % hints.length];

  switch (kind) {
    case 'hint':
      return answer(hint, 'encouragement', HINT_REACTIONS[hintLevel]);
    case 'proactive':
      // Once is enough: right after stepping in, it lets the student work
      return previous.at(-1)?.trigger === 'proactive'
        ? { ...answer('', 'encouragement', 'eyes'), silent: true }
        : answer(script.proactive, 'encouragement', proactiveReaction(previous));
    case 'question': {
      const question = withoutAccents(message ?? '');
      // Asking for the solution gets a joke: «hey, not that»
      if (ELUSION_PATTERN.test(question)) {
        // Each time a different joke: a wink, the monkeys, «seriously?», something thrown, then a
        // mock anger
        const elusions = previous.filter((interaction) => interaction.elusion).length;
        const joke = ELUSION_REACTIONS[elusions % ELUSION_REACTIONS.length];
        return answer(script.elusion, 'surprise', joke, MAX_INTENSITY, true);
      }
      // How something is written: the examples of the catalog, as the server adds them (2.5d)
      const topics = syntaxTopicsIn(message);
      if (topics.length > 0) {
        return answer([script.syntax, syntaxBlocks(topics)].join('\n'), 'joy', 'lightbulb');
      }
      // Stuck before writing the function: its empty skeleton, the one code of the exercise (2.5d)
      // Only once: stuck again, the next step is the hint of the level it went up to
      const gaveSkeleton = previous.some((interaction) => interaction.transcript.includes('```'));
      const hasFunction = code.includes(`function ${exerciseFunction.name}`);
      if (isStuckMessage(message) && !hasFunction && !gaveSkeleton) {
        // It does not know the names of the parameters: a, b…
        const skeleton = skeletonBlock(exerciseFunction.name, exerciseFunction.parameters);
        const { before, after } = script.stuck;
        return answer([before, skeleton, after].join('\n'), 'encouragement', 'empathy');
      }
      if (status === 'passed') return answer(script.passed, 'celebration', 'party');
      if (STATEMENT_PATTERN.test(question)) return answer(script.statement, 'joy', 'hearts');
      if (!code.trim()) return answer(script.start, 'encouragement', 'cheer');
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
