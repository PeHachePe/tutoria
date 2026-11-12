import type { ToolRequest } from '../../../data/tutor';
import { type CodeFix, type FixChange, previewFix } from '../../../data/tutor/code-fix';
import { type TurnAction, waitsForStudent } from '../tutor-store';

/** How the chat shows an action of the tutor (2.5e): a line that says what it did, or a button. */
export type ActionView =
  | { readonly kind: 'note'; readonly icon: string; readonly text: string; readonly undo?: boolean }
  | {
      readonly kind: 'button';
      readonly icon: string;
      readonly text: string;
      readonly hint?: string;
    }
  | { readonly kind: 'failed'; readonly text: string };

/** An id of the database: the tutor names an exercise by it, which says nothing to the student. */
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const LANGUAGE_NAMES: Record<string, string> = {
  es: $localize`:@@tutorAction.language.es:español`,
  en: $localize`:@@tutorAction.language.en:inglés`,
  ca: $localize`:@@tutorAction.language.ca:catalán`,
};

const THEME_NAMES: Record<string, string> = {
  light: $localize`:@@tutorAction.theme.light:Tema claro`,
  dark: $localize`:@@tutorAction.theme.dark:Tema oscuro`,
  system: $localize`:@@tutorAction.theme.system:Tema del sistema`,
};

const PLACES: Record<string, { readonly icon: string; readonly text: string }> = {
  catalog: { icon: 'list', text: $localize`:@@tutorAction.navigate.catalog:Ir a los ejercicios` },
  settings: {
    icon: 'settings',
    text: $localize`:@@tutorAction.navigate.settings:Ir a los ajustes`,
  },
  data: { icon: 'shield', text: $localize`:@@tutorAction.navigate.data:Ver mis datos registrados` },
};

const POINTS: Record<string, string> = {
  failingTest: $localize`:@@tutorAction.point.failingTest:Te señalo la prueba que falla`,
  hiddenTests: $localize`:@@tutorAction.point.hiddenTests:Te señalo las comprobaciones ocultas`,
};

/** The buttons of what only our tutor does in the code and with the submission (2.5f). */
const CODE_BUTTONS: Record<string, { readonly icon: string; readonly text: string }> = {
  insertSkeleton: {
    icon: 'add',
    text: $localize`:@@tutorAction.insert:Poner la función en el editor`,
  },
  formatCode: {
    icon: 'format_align_left',
    text: $localize`:@@tutorAction.format:Formatear el código`,
  },
  runTests: { icon: 'play_arrow', text: $localize`:@@tutorAction.run:Ejecutar las pruebas` },
  submitAttempt: { icon: 'send', text: $localize`:@@tutorAction.submit:Entregar el ejercicio` },
};

/**
 * What a fix changes, so the student sees the slip and learns from it: «Línea 4: retrun → return»,
 * «Línea 3: falta )», «Línea 2: sobra ;».
 */
function fixHint(line: number, changes: readonly FixChange[]): string {
  const list = changes
    .map(({ before, after }) => {
      if (!before) return $localize`:@@tutorAction.fix.missing:falta ${after}:after:`;
      if (!after) return $localize`:@@tutorAction.fix.extra:sobra ${before}:before:`;
      return `${before} → ${after}`;
    })
    .join(', ');
  return $localize`:@@tutorAction.fix.hint:Línea ${line}:line:: ${list}:changes:`;
}

/** How the run the tutor started went (2.5f). */
function runText(result: unknown): string {
  const run = result as
    { readonly loaded?: false; readonly passed?: number; readonly total?: number } | undefined;
  if (run?.loaded === false) {
    return $localize`:@@tutorAction.ran.notRun:Pruebas ejecutadas: el código no se ha podido ejecutar`;
  }
  if (run?.passed === undefined) return $localize`:@@tutorAction.ran:Pruebas ejecutadas`;
  return $localize`:@@tutorAction.ran.count:Pruebas ejecutadas: ${run.passed}:passed: de ${run.total}:total: superadas`;
}

/** The queries of the tutor, as the chat says them («Ha consultado tu progreso»). */
const QUERIES: Record<string, string> = {
  getMyProgress: $localize`:@@tutorAction.query.progress:tu progreso`,
  searchExercises: $localize`:@@tutorAction.query.exercises:tus ejercicios`,
  getExerciseStats: $localize`:@@tutorAction.query.stats:tus intentos`,
  getSettings: $localize`:@@tutorAction.query.settings:tus ajustes`,
};

/** «tu progreso, tus ejercicios»: what the tutor looked up before answering. */
export function queriedText(names: readonly string[]): string {
  const known = names.map((name) => QUERIES[name]).filter(Boolean);
  if (known.length === 0) return '';
  const list = known.join(', ');
  return $localize`:@@tutorAction.queried:Ha consultado ${list}:list:`;
}

/**
 * What the chat shows of an action: what it did once done, a button while it waits. A fix is shown
 * against the code as it is now (2.5f): what it changes, or that the student already fixed it.
 */
export function actionView({ call, status, result }: TurnAction, code = ''): ActionView {
  if (status === 'failed') {
    const action = waitsForStudent(call) ? buttonOf(call, code).text : doneText(call);
    return {
      kind: 'failed',
      text: $localize`:@@tutorAction.failed:No se ha podido hacer: ${action}:action:`,
    };
  }
  if (status === 'pending' && call.name === 'proposeFix') {
    const preview = previewFix(code, call.arguments as unknown as CodeFix);
    if (!preview.ok) {
      return {
        kind: 'note',
        icon: preview.problem === 'unchanged' ? 'check' : 'info',
        text:
          preview.problem === 'unchanged'
            ? $localize`:@@tutorAction.fix.done:Ya lo has corregido tú`
            : $localize`:@@tutorAction.fix.gone:Tu código ha cambiado: esta corrección ya no encaja`,
      };
    }
  }
  if (status === 'pending' || status === 'running') return buttonOf(call, code);
  // The settings asked for were already so: nothing changed, nothing to undo
  const changed = (result as { readonly changed?: object } | undefined)?.changed;
  if (status === 'done' && changed && Object.keys(changed).length === 0) {
    return {
      kind: 'note',
      icon: 'check',
      text: $localize`:@@tutorAction.unchanged:Ya lo tenías así`,
      undo: false,
    };
  }
  // Of an earlier visit: what it offered may never have been pressed
  if (status === 'past' && waitsForStudent(call)) {
    return {
      kind: 'note',
      icon: 'history',
      text: $localize`:@@tutorAction.offered:Te propuso: ${buttonOf(call, code).text}:action:`,
    };
  }
  return {
    kind: 'note',
    icon: status === 'undone' ? 'undo' : 'check',
    text:
      status === 'undone'
        ? $localize`:@@tutorAction.undone:Ajustes como estaban`
        : doneText(call, result),
    // Only what the tutor changed in this visit can go back
    undo: status === 'done' && call.name === 'updateSettings',
  };
}

function buttonOf(call: ToolRequest, code: string): Extract<ActionView, { kind: 'button' }> {
  const args = call.arguments;
  switch (call.name) {
    case 'proposeFix': {
      const fix = args as unknown as CodeFix;
      const preview = previewFix(code, fix);
      return {
        kind: 'button',
        icon: 'auto_fix_high',
        text: $localize`:@@tutorAction.fix:Aplicar la corrección`,
        ...(preview.ok ? { hint: fixHint(fix.line, preview.changes) } : {}),
      };
    }
    case 'insertSkeleton':
    case 'formatCode':
    case 'runTests':
    case 'submitAttempt':
      return { kind: 'button', ...CODE_BUTTONS[call.name] };
    case 'openExercise': {
      const exercise = String(args['exercise']);
      return {
        kind: 'button',
        icon: 'arrow_forward',
        text:
          exercise === 'next'
            ? $localize`:@@tutorAction.open.next:Abrir el siguiente ejercicio`
            : ID.test(exercise)
              ? $localize`:@@tutorAction.open:Abrir el ejercicio`
              : $localize`:@@tutorAction.open.named:Abrir «${exercise}:exercise:»`,
      };
    }
    case 'navigate':
      return { kind: 'button', ...PLACES[String(args['to'])] };
    case 'updateSettings': {
      const language = LANGUAGE_NAMES[String(args['language'])];
      return {
        kind: 'button',
        icon: 'translate',
        text: $localize`:@@tutorAction.language:Cambiar el idioma a ${language}:language:`,
        hint: $localize`:@@tutorAction.language.hint:La página se vuelve a cargar`,
      };
    }
    default:
      return { kind: 'button', icon: 'play_arrow', text: doneText(call) };
  }
}

/** What the tutor did, in words. */
function doneText(call: ToolRequest, result?: unknown): string {
  const args = call.arguments;
  switch (call.name) {
    case 'highlightLines': {
      const lines = (args['lines'] as readonly { readonly line: number }[]).map(
        (mark) => mark.line,
      );
      if (lines.length === 0)
        return $localize`:@@tutorAction.unmarked:He quitado las marcas del código`;
      const list = lines.join(', ');
      return lines.length === 1
        ? $localize`:@@tutorAction.marked.one:He marcado la línea ${list}:line: del código`
        : $localize`:@@tutorAction.marked.many:He marcado las líneas ${list}:lines: del código`;
    }
    case 'pointAt':
      return args['target'] === 'example'
        ? $localize`:@@tutorAction.point.example:Te señalo el ejemplo ${args['example']}:example:`
        : POINTS[String(args['target'])];
    case 'setLayout':
      return $localize`:@@tutorAction.layout:He cambiado la disposición de la pantalla`;
    case 'updateSettings': {
      const changed = (result as { readonly changed?: Record<string, unknown> } | undefined)
        ?.changed;
      const theme = changed?.['theme'] ?? args['theme'];
      return theme && Object.keys(changed ?? args).length === 1
        ? THEME_NAMES[String(theme)]
        : $localize`:@@tutorAction.settings:He cambiado tus ajustes`;
    }
    case 'openExercise':
      return $localize`:@@tutorAction.opened:Ejercicio abierto`;
    case 'insertSkeleton':
      return $localize`:@@tutorAction.inserted:Función puesta en el editor`;
    case 'formatCode':
      return (result as { readonly formatted?: boolean } | undefined)?.formatted === false
        ? $localize`:@@tutorAction.formatted.already:Tu código ya estaba ordenado`
        : $localize`:@@tutorAction.formatted:Código formateado`;
    case 'runTests':
      return runText(result);
    case 'submitAttempt':
      return (result as { readonly submitted?: boolean } | undefined)?.submitted === false
        ? $localize`:@@tutorAction.notSubmitted:Has seguido revisando: no se ha entregado`
        : $localize`:@@tutorAction.submitted:Ejercicio entregado`;
    case 'proposeFix':
      return $localize`:@@tutorAction.fixed:Línea ${args['line']}:line: corregida`;
    case 'navigate':
      return PLACES[String(args['to'])].text;
    default:
      return call.name;
  }
}
