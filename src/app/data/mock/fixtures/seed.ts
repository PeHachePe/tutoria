import type { MockTables } from '../mock-tables';
import { ATTEMPTS, EVENTS, INTERACTIONS } from './activity';
import { ASSIGNMENTS, EXERCISES, TESTS } from './exercises';
import { ENROLLMENTS, GROUPS, USERS } from './users';

/**
 * Change it whenever the fixtures change: the mock data saved in a browser with another version is
 * discarded and replaced with the new seed.
 */
export const SEED_VERSION = 3;

/** The data both worlds share: the mock data starts from it and `npm run seed` turns it into SQL. */
export const SEED: MockTables = {
  users: USERS,
  groups: GROUPS,
  enrollments: ENROLLMENTS,
  exercises: EXERCISES,
  tests: TESTS,
  assignments: ASSIGNMENTS,
  attempts: ATTEMPTS,
  interactions: INTERACTIONS,
  events: EVENTS,
  aiProvider: {
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    model: 'gemini-2.5-flash',
  },
};
