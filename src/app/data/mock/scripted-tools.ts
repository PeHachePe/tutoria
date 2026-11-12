import type { AttemptStatus } from '../attempt';
import type { ContentLocale } from '../localized-text';
import type { ToolRequest, ToolResult } from '../tutor';
import { suggestFix } from '../tutor/code-fix';
import { TUTOR_SCRIPTS } from './fixtures/tutor-script';

/**
 * What the scripted tutor does with its tools (2.5e): ask for data first, or answer with actions.
 * Null when the message is not about anything a tool does.
 */
export type ScriptedTools =
  | { readonly queries: readonly ToolRequest[] }
  | { readonly text: string; readonly actions: readonly ToolRequest[] };

/** The ways of asking that the scripted tutor understands, compared without accents. */
const PATTERNS = {
  subjects: /que asignaturas|which subjects|quines assignatures/,
  stats: /errores|fallos|intentos|mistakes|errors|attempts|errades|intents/,
  progress: /cuant|how many|quant/,
  next: /siguiente|next one|seguent/,
  open: /ponme|abre(me)?|otro ejercicio|another exercise|open (an?|another)|posa'?m|obre|un altre/,
  dark: /(modo|tema) oscuro|dark (mode|theme)|(mode|tema) fosc/,
  light: /(modo|tema) claro|light (mode|theme)|(mode|tema) clar/,
  english: /en ingles|in english|en angles/,
  mark: /resalta|marca(me)? la|highlight|ressalta/,
  settings: /ajustes|settings|configuracio/,
  fix: /arregl|corrig|correg|despiste|\bfix\b|distraccio/,
  format: /formatea|ordena(me)? el codigo|indenta|\bformat|tidy|endreca/,
  run: /ejecuta|run the tests|run my code|executa/,
  submit: /entregal|entregar|entrega(me)? el|submit|lliura/,
};

/** The code and the attempt, for what only our tutor does in them (2.5f). */
export interface ScriptedCode {
  readonly code: string;
  readonly functionName: string;
  readonly status: AttemptStatus;
}

/** «de bucles», «about loops»: the topic of the exercise asked for. */
const TOPIC = /(?:de|about|sobre) ([a-z]+)\s*[?!.]*$/;

/** «la línea 3», «line 3», «la línia 3». */
const LINE = /(?:linea|line|linia) (\d+)/;

export function scriptedTools(
  message: string,
  results: readonly ToolResult[] | undefined,
  language: ContentLocale,
  { code, functionName, status }: ScriptedCode = {
    code: '',
    functionName: '',
    status: 'in_progress',
  },
): ScriptedTools | null {
  const say = TUTOR_SCRIPTS[language].tools;
  const text = message.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const query = (name: string, args: Record<string, unknown> = {}) =>
    results ? answerWith(results, language) : { queries: [{ name, arguments: args }] };

  if (PATTERNS.subjects.test(text)) return query('getMyProgress');
  if (PATTERNS.progress.test(text)) {
    return query(PATTERNS.stats.test(text) ? 'getExerciseStats' : 'getMyProgress');
  }
  // What only our tutor does in the code and with the submission, with a button (2.5f)
  if (PATTERNS.fix.test(text)) {
    const fix = suggestFix(code, { functionName });
    return fix
      ? { text: say.fix(fix.line), actions: [{ name: 'proposeFix', arguments: { ...fix } }] }
      : { text: say.noFix, actions: [] };
  }
  if (PATTERNS.format.test(text)) {
    return { text: say.format, actions: [{ name: 'formatCode', arguments: {} }] };
  }
  if (PATTERNS.submit.test(text)) {
    return status === 'passed'
      ? { text: say.submit, actions: [{ name: 'submitAttempt', arguments: {} }] }
      : { text: say.notPassed, actions: [{ name: 'runTests', arguments: {} }] };
  }
  if (PATTERNS.run.test(text)) {
    return { text: say.run, actions: [{ name: 'runTests', arguments: {} }] };
  }
  if (PATTERNS.next.test(text)) {
    return {
      text: say.openNext,
      actions: [{ name: 'openExercise', arguments: { exercise: 'next' } }],
    };
  }
  if (PATTERNS.open.test(text)) {
    const topic = TOPIC.exec(text)?.[1];
    return query('searchExercises', { ...(topic ? { text: topic } : {}), status: 'pending' });
  }
  if (PATTERNS.dark.test(text) || PATTERNS.light.test(text)) {
    const theme = PATTERNS.dark.test(text) ? 'dark' : 'light';
    return { text: say.theme, actions: [{ name: 'updateSettings', arguments: { theme } }] };
  }
  if (PATTERNS.english.test(text)) {
    return {
      text: say.language,
      actions: [{ name: 'updateSettings', arguments: { language: 'en' } }],
    };
  }
  if (PATTERNS.mark.test(text)) {
    const line = Number(LINE.exec(text)?.[1] ?? 1);
    return {
      text: say.mark(line),
      actions: [{ name: 'highlightLines', arguments: { lines: [{ line, note: say.markNote }] } }],
    };
  }
  if (PATTERNS.settings.test(text)) {
    return { text: say.settings, actions: [{ name: 'navigate', arguments: { to: 'settings' } }] };
  }
  return null;
}

/** The answer once the data arrived: what it says, and the button to open what it found. */
function answerWith(results: readonly ToolResult[], language: ContentLocale): ScriptedTools {
  const say = TUTOR_SCRIPTS[language].tools;
  const [{ name, result }] = results;
  if (typeof result !== 'object' || result === null || 'error' in result) {
    return { text: say.unavailable, actions: [] };
  }
  switch (name) {
    case 'getMyProgress': {
      const { subjects, total } = result as {
        readonly subjects: readonly { readonly subject: string }[];
        readonly total: { pending: number; submitted: number; assigned: number };
      };
      const names = subjects.map((each) => each.subject).join(', ');
      return {
        text: `${say.subjects(names)} ${say.progress(total.pending, total.submitted, total.assigned)}`,
        actions: [],
      };
    }
    case 'getExerciseStats': {
      const { runs, failedRuns, hints } = result as {
        readonly runs: number;
        readonly failedRuns: number;
        readonly hints: number;
      };
      return { text: say.stats(runs, failedRuns, hints), actions: [] };
    }
    default: {
      const [found] = (result as { readonly exercises: readonly { id: string; title: string }[] })
        .exercises;
      return found
        ? {
            text: say.open(found.title),
            actions: [{ name: 'openExercise', arguments: { exercise: found.id } }],
          }
        : { text: say.noMatch, actions: [] };
    }
  }
}
