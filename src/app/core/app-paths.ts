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
    exercise: (exerciseId: string) => `/${student.area}/${student.exercise}/${exerciseId}`,
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
