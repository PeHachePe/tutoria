import { FRESH_STUDENT_ID, NEW_TEACHER_ID } from '../../src/app/data/mock/fixtures/users';
import { USERS } from '../support/session';

/** The profiles of the guided help, as `npm run manual` names them (scripts/manual.mjs). */
export type ManualProfileId = 'student' | 'teacher' | 'admin';

export interface ManualProfile {
  readonly id: ManualProfileId;
  /** Who does the tasks: a user of the seed with data enough for every task to be possible. */
  readonly user: string;
  /**
   * A user who has not done the first steps yet, so the panel lists them in their order: those of
   * `user` are done by the data, and the panel only celebrates them.
   */
  readonly newcomer: string;
  /** Where the user lands, to open the help panel. */
  readonly home: string;
  /**
   * Pages where the tasks that are not possible from `home` can start: those of a page that is a
   * place only while it is open, as the detail of an attempt.
   */
  readonly alsoFrom?: readonly string[];
  /** Tests the tasks are split into, run in parallel. */
  readonly shards: number;
  /**
   * The profile whose tasks this one also has: its manual links to them instead of repeating them
   * (the administration does all the tasks of the teacher, D-093).
   */
  readonly sharesWith?: ManualProfileId;
}

export const MANUAL_PROFILES: readonly ManualProfile[] = [
  {
    id: 'student',
    // Lucía: has practised again an exercise she submitted, so she has attempts to go back to
    user: USERS.student,
    newcomer: FRESH_STUDENT_ID,
    home: '/alumno',
    shards: 3,
  },
  {
    id: 'teacher',
    user: USERS.teacher,
    newcomer: NEW_TEACHER_ID,
    home: '/docente',
    // An attempt of the seed with failed runs, hints and the submission (as e2e/screenshots)
    alsoFrom: ['/docente/en-vivo/70000000-0000-4000-8000-000000000011'],
    shards: 4,
  },
  {
    id: 'admin',
    user: USERS.admin,
    newcomer: USERS.admin,
    home: '/admin',
    shards: 2,
    sharesWith: 'teacher',
  },
];
