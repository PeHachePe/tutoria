import type { USERS } from '../support/session';

/** A finished screen for `npm run screenshots` (5.6): the code of its ficha, its URL and its user. */
export interface Screen {
  /** Code of its ficha in docs/screens, such as `02-catalogo`. */
  readonly code: string;
  readonly path: string;
  /** Role of the seed user that sees it (support/session.ts), or null for a screen without a session. */
  readonly user: keyof typeof USERS | null;
}

/**
 * Screens with their step closed. Each screen step adds its entry when it closes, so the
 * screenshots of a delivery only show finished screens.
 */
export const SCREENS: readonly Screen[] = [
  { code: '01-acceso', path: '/login', user: null },
  { code: '02-catalogo', path: '/alumno', user: 'studentHalfway' },
  // Exercise 3 (Suma de los elementos de un vector), the model of the statements (2.5)
  {
    code: '03-trabajo',
    path: '/alumno/ejercicio/40000000-0000-4000-8000-000000000003',
    user: 'studentHalfway',
  },
  { code: '05-ajustes', path: '/alumno/ajustes', user: 'studentHalfway' },
  { code: '05b-datos', path: '/alumno/datos', user: 'studentHalfway' },
  { code: '06-en-vivo', path: '/docente/en-vivo', user: 'teacher' },
  // An attempt of the seed with failed runs, hints answered by the tutor and the submission
  {
    code: '07-detalle',
    path: '/docente/en-vivo/70000000-0000-4000-8000-000000000011',
    user: 'teacher',
  },
  { code: '08-ejercicios', path: '/docente/ejercicios', user: 'teacher' },
  // The form of exercise 3 (Suma de los elementos de un vector), started by the students (4.3)
  {
    code: '08b-ejercicio',
    path: '/docente/ejercicios/40000000-0000-4000-8000-000000000003',
    user: 'teacher',
  },
  // The blocks of 1.º DAW A in basic programming, with due dates and a hidden block (4.3b)
  {
    code: '08c-bloques',
    path: '/docente/bloques?grupo=20000000-0000-4000-8000-000000000001',
    user: 'teacher',
  },
  // The same group a year before, closed: its blocks read only, with the notice (5.2f)
  {
    code: '08c-bloques-cerrado',
    path: '/docente/bloques?grupo=20000000-0000-4000-8000-000000000177',
    user: 'teacher',
  },
  // The history of 1.º DAW A in basic programming: five blocks, the resit in grey, due dates (4.4)
  {
    code: '09-historico',
    path: '/docente/historico?grupo=20000000-0000-4000-8000-000000000001',
    user: 'teacher',
  },
  // The accounts of the seed, by name: the administration first, with «Tú» (5.1b)
  { code: '10-usuarios', path: '/admin/usuarios', user: 'admin' },
  // The groups of Marta, with 1.º DAW A in basic programming open and its students (5.2b)
  {
    code: '11-grupos',
    path: '/docente/grupos?grupo=20000000-0000-4000-8000-000000000001',
    user: 'teacher',
  },
  // 1.º DAW A a year before, closed: its final evaluation still to do, at sight (5.2g)
  {
    code: '11-grupos-evaluacion',
    path: '/docente/grupos?clase=c0000000-0000-4000-8000-000000000118',
    user: 'teacher',
  },
  // The AI provider of the seed, Gemini with two fallbacks, and the three subjects (5.3b)
  { code: '12-sistema', path: '/admin/sistema', user: 'admin' },
];
