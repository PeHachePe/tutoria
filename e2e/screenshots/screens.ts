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
];
