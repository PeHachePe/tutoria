// What a user manual of docs/manual says (7.0c, D-080, D-098), whatever its format: its sections in
// order and its texts. markdown.mjs and html.mjs write it, from what e2e/manual/manual.spec.ts kept
// of each guided task.

/** The key of the welcome among the tasks done (e2e/manual/panel.ts). */
export const WELCOME = 'welcome';
/** The tours of a screen («Recorrer esta pantalla») have this id (`tour-${screen}`). */
const TOUR_PREFIX = 'tour-';

/** Each manual, by the id of its profile (e2e/manual/profiles.ts), in their order. */
export const MANUALS = {
  student: {
    file: 'alumno',
    title: 'Manual del alumnado',
    intro:
      'Cómo se usa TutorIA como alumno o alumna: ver tus ejercicios, resolverlos con la ayuda del tutor, entregarlos y ajustar la aplicación a tu gusto.',
  },
  teacher: {
    file: 'docente',
    title: 'Manual del profesorado',
    intro:
      'Cómo se usa TutorIA como docente: preparar tus clases y sus asignaturas, escribir y asignar ejercicios, seguir la clase en vivo y ver cómo evoluciona cada grupo.',
  },
  admin: {
    file: 'administracion',
    title: 'Manual de la administración',
    intro:
      'Cómo se usa TutorIA desde la administración: las cuentas de usuario, el proveedor de IA y las asignaturas. La administración puede hacer además todo lo que hace un docente.',
  },
};

export const TEXTS = {
  /** For the reader: the day of the screens it shows. */
  edition: (date) => `Edición del ${date}`,
  /** For whoever maintains it, out of sight of the reader (docs/manual/README.md says the rest). */
  generated: 'Generado con npm run manual desde las tareas guiadas: no se edita a mano.',
  inTheApp:
    'Todo lo que cuenta este manual está también dentro de la aplicación: el botón «Ayuda» (?), arriba a la derecha, hace estas mismas tareas contigo sobre tus propios datos.',
  index: 'Índice',
  welcome: 'Bienvenida',
  welcomeIntro:
    'Lo primero que ves al entrar por primera vez. Se puede volver a ver desde «Ayuda» › «Ver la bienvenida».',
  unavailable: 'La ayuda de la aplicación te la ofrece en cuanto puedes hacerla.',
  whatYouDo: 'Qué haces:',
  step: (position, title) => `Paso ${position}: ${title}`,
  sharedTitle: 'Las tareas del docente',
  sharedIntro: (manual) =>
    `Entras también en todas las pantallas del docente, con estas tareas. Se cuentan en el ${manual}, con las mismas pantallas:`,
};

/** The anchors of the welcome and of the tasks shared with another manual. */
export const ANCHORS = { welcome: 'bienvenida', shared: 'tareas-compartidas' };

/** The profiles named by the arguments of `npm run manual`, by the name of their file; all by default. */
export function parseProfiles(args) {
  const all = Object.keys(MANUALS);
  if (args.length === 0) return all;
  return args.map((name) => {
    const profile = all.find((id) => MANUALS[id].file === name);
    if (!profile) {
      const names = all.map((id) => MANUALS[id].file).join(', ');
      throw new Error(`Manual desconocido: «${name}». Los hay de: ${names}.`);
    }
    return profile;
  });
}

/**
 * The parts of the manual of a profile, after its welcome: the first steps in their order, the
 * how-tos and the tours of each screen, as `index` (what the help panel listed) has them; and the
 * manual that tells the tasks it shares with another profile, if any.
 */
export function manualSections(profile, index) {
  const byId = (id) => index.tasks.find((task) => task.id === id);
  const firstSteps = index.firstSteps.map(byId).filter(Boolean);
  const rest = index.tasks.filter((task) => !index.firstSteps.includes(task.id));
  const sections = [
    { title: 'Primeros pasos', tasks: firstSteps },
    { title: '¿Cómo se hace…?', tasks: rest.filter((task) => !task.id.startsWith(TOUR_PREFIX)) },
    {
      title: 'Recorridos de pantalla',
      tasks: rest.filter((task) => task.id.startsWith(TOUR_PREFIX)),
    },
  ].filter((section) => section.tasks.length > 0);
  const sharedWith = profile === 'admin' && index.shared.length > 0 ? MANUALS.teacher : null;
  return { sections, shared: sharedWith && { manual: sharedWith, tasks: index.shared } };
}

/** The steps done of a task; a task that was possible and has none would make the manual lie. */
export function stepsOf(key, records) {
  const steps = records[key]?.steps;
  if (!steps?.length) throw new Error(`La tarea «${key}» no tiene pasos: no se completó.`);
  return steps;
}
