import type { MockTables } from '../mock-tables';
import { ATTEMPTS, EVENTS, INTERACTIONS } from './activity';
import { ASSIGNMENTS, CLASS_BLOCKS, EXERCISE_SUBJECTS, EXERCISES, TESTS } from './exercises';
import { SUBJECTS } from './subjects';
import { ENROLLMENTS, GROUPS, USERS } from './users';

/**
 * Change it whenever the fixtures change: the mock data saved in a browser with another version is
 * discarded and replaced with the new seed.
 */
export const SEED_VERSION = 8;

/** The data both worlds share: the mock data starts from it and `npm run seed` turns it into SQL. */
export const SEED: MockTables = {
  users: USERS,
  subjects: SUBJECTS,
  groups: GROUPS,
  enrollments: ENROLLMENTS,
  classBlocks: CLASS_BLOCKS,
  exercises: EXERCISES,
  exerciseSubjects: EXERCISE_SUBJECTS,
  tests: TESTS,
  assignments: ASSIGNMENTS,
  attempts: ATTEMPTS,
  interactions: INTERACTIONS,
  events: EVENTS,
  aiProvider: {
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    model: 'gemini-3.5-flash-lite',
  },
};
