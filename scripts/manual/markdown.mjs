// The user manuals of docs/manual (7.0c, D-080), written from what e2e/manual/manual.spec.ts kept
// of each guided task: the texts of each globe, read from the page, and its screenshot.

/** The key of the welcome among the tasks done (e2e/manual/panel.ts). */
const WELCOME = 'welcome';
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
 * The Markdown of the manual of a profile: an index and, for the welcome and each task, its steps
 * with the text of each globe and its screenshot. `index` is what the help panel listed and
 * `records` what was done of each task, by its key; `image` gives the path of a screenshot from
 * the manual.
 */
export function manualMarkdown({ profile, index, records, date, image }) {
  const manual = MANUALS[profile];
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
  const shared = index.shared.length > 0 ? sharedSection(profile, index.shared) : null;

  return (
    [
      `# ${manual.title}`,
      manual.intro,
      `> Generado con \`npm run manual\` el ${date} a partir de las tareas guiadas de la aplicación: cada tarea se hizo de principio a fin en el navegador, con los datos de demostración, y cada paso lleva el texto de su globo y su captura. No se edita a mano: se vuelve a generar cuando cambian las tareas o las pantallas.`,
      'Todo lo que cuenta este manual está también dentro de la aplicación: el botón «Ayuda» (?), arriba a la derecha, hace estas mismas tareas contigo sobre tus propios datos.',
      '## Índice',
      tableOfContents(sections, shared),
      '## <a id="bienvenida"></a>Bienvenida',
      'Lo primero que ves al entrar por primera vez. Se puede volver a ver desde «Ayuda» › «Ver la bienvenida».',
      stepsOf(WELCOME, records, image, '###'),
      ...sections.flatMap((section) => [
        `## ${section.title}`,
        ...section.tasks.map((task) => taskOf(task, records, image)),
      ]),
      ...(shared ? [shared.markdown] : []),
    ].join('\n\n') + '\n'
  );
}

function tableOfContents(sections, shared) {
  const lines = ['- [Bienvenida](#bienvenida)'];
  for (const section of sections) {
    lines.push(`- ${section.title}`);
    for (const task of section.tasks) lines.push(`  - [${task.title}](#${task.id})`);
  }
  if (shared) lines.push(`- [${shared.title}](#${shared.anchor})`);
  return lines.join('\n');
}

function taskOf(task, records, image) {
  const heading = `### <a id="${task.id}"></a>${task.title}`;
  if (task.unavailable) {
    return [
      heading,
      `_${task.summary}._ El navegador en que se generó el manual no lo permite, así que esta tarea no se ha podido recorrer; la ayuda de la aplicación la ofrece cuando es posible.`,
    ].join('\n\n');
  }
  return [heading, `_${task.summary}_`, stepsOf(task.id, records, image, '####')].join('\n\n');
}

function stepsOf(key, records, image, level) {
  const steps = records[key]?.steps;
  if (!steps?.length) throw new Error(`La tarea «${key}» no tiene pasos: no se completó.`);
  return steps
    .map((step, position) =>
      [
        `${level} ${position + 1}. ${step.title}`,
        step.text,
        ...(step.action ? [`**Qué haces:** ${step.action}`] : []),
        `![Paso ${position + 1}: ${step.title}](${image(step.image)})`,
      ].join('\n\n'),
    )
    .join('\n\n');
}

/** The tasks of another profile that this one also has: a link to each in that manual. */
function sharedSection(profile, tasks) {
  const other = profile === 'admin' ? MANUALS.teacher : null;
  const anchor = 'tareas-compartidas';
  const title = other ? 'Las tareas del docente' : 'Tareas compartidas';
  const markdown = [
    `## <a id="${anchor}"></a>${title}`,
    `Entras también en todas las pantallas del docente, con estas tareas. Se cuentan en el [${other?.title ?? 'otro manual'}](${other?.file}.md), con las mismas pantallas:`,
    tasks.map((task) => `- [${task.title}](${other?.file}.md#${task.id})`).join('\n'),
  ].join('\n\n');
  return { title, anchor, markdown };
}
