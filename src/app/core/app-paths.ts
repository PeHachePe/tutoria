/**
 * URL segments of each area and screen (2.2), written only here. The route configs use the
 * segments; links, redirects and guards use the absolute paths of APP_PATHS, built from them.
 * Development pages have their own in `dev/dev-paths.ts`, so production does not carry them.
 */
export const SEGMENTS = {
  login: 'login',
  student: { area: 'alumno', exercise: 'ejercicio', settings: 'ajustes', data: 'datos' },
  teacher: {
    area: 'docente',
    live: 'en-vivo',
    history: 'historico',
    exercises: 'ejercicios',
    /** The form of a new exercise, under the bank. */
    newExercise: 'nuevo',
    /** The blocks of a group and what is assigned in them (4.3b). */
    blocks: 'bloques',
    groups: 'grupos',
  },
  admin: { area: 'admin', users: 'usuarios', system: 'sistema' },
} as const;

const { student, teacher, admin } = SEGMENTS;

/** Absolute paths of the screens, for `routerLink`, `navigateByUrl` and redirects. */
export const APP_PATHS = {
  /** Leads to the home of the role, or to the login without a session (homeRedirect). */
  root: '/',
  login: `/${SEGMENTS.login}`,
  student: {
    catalog: `/${student.area}`,
    /** The workspace of an exercise as assigned in a block (2.5c): its attempts are those of the assignment. */
    exercise: (assignmentId: string) => `/${student.area}/${student.exercise}/${assignmentId}`,
    settings: `/${student.area}/${student.settings}`,
    data: `/${student.area}/${student.data}`,
  },
  teacher: {
    live: `/${teacher.area}/${teacher.live}`,
    attempt: (attemptId: string) => `/${teacher.area}/${teacher.live}/${attemptId}`,
    history: `/${teacher.area}/${teacher.history}`,
    exercises: `/${teacher.area}/${teacher.exercises}`,
    newExercise: `/${teacher.area}/${teacher.exercises}/${teacher.newExercise}`,
    /** The form of an exercise of the bank (4.3). */
    exercise: (exerciseId: string) => `/${teacher.area}/${teacher.exercises}/${exerciseId}`,
    blocks: `/${teacher.area}/${teacher.blocks}`,
    groups: `/${teacher.area}/${teacher.groups}`,
  },
  admin: {
    users: `/${admin.area}/${admin.users}`,
    system: `/${admin.area}/${admin.system}`,
  },
} as const;

/** Query parameter of the login with the page to come back to (roleGuard, afterSignInPath). */
export const REDIRECT_PARAM = 'redirect';

/** Query parameters of the student's screens (2.5c), part of the URLs like the segments. */
export const STUDENT_PARAMS = {
  /** The tab of the catalog: the id of the group. */
  group: 'grupo',
  /** The attempt of the workspace, by its number; without it, the latest. */
  attempt: 'intento',
} as const;

/** The value of `?asignatura=` that shows the whole bank (4.3). */
export const ALL_SUBJECTS = 'todas';

/** The value of `?bloque=` that follows the whole group in the live panel (D-068). */
export const TEACHER_ALL_BLOCKS = 'todos';

/** Query parameters of the teacher's screens (D-046), part of the URLs like the segments. */
export const TEACHER_PARAMS = {
  /** The group followed live, or whose blocks are shown: its id. */
  group: 'grupo',
  /** The block of that group: its id, or `todos` for the whole group live. */
  block: 'bloque',
  /** The exercise a new one copies («Duplicar», 4.3): its id. */
  copy: 'copia',
  /** Filters of the exercise bank (4.3): the text searched for. */
  search: 'buscar',
  /** The subjects of the bank: the id of one, or `todas`; without it, those of the user. */
  subject: 'asignatura',
  /** The difficulty of the bank. */
  difficulty: 'dificultad',
  /** Only the exercises the user wrote: any value. */
  mine: 'mios',
  /** The archived exercises instead of the others (4.3d): any value. */
  archived: 'archivados',
  /** The page of the bank, from 1. */
  page: 'pagina',
} as const;
