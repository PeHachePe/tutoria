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

/** Query parameters of the teacher's screens (D-046), part of the URLs like the segments. */
export const TEACHER_PARAMS = {
  /** The group followed live: its id. */
  group: 'grupo',
  /** The block of that group: its id. */
  block: 'bloque',
} as const;
