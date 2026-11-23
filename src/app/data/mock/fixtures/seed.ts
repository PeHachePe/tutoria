import type { MockTables } from '../mock-tables';
import { ATTEMPTS, EVENTS, INTERACTIONS } from './activity';
import { ASSIGNMENTS, CLASS_BLOCKS, EXERCISE_SUBJECTS, EXERCISES, TESTS } from './exercises';
import {
  HISTORY_ASSIGNMENTS,
  HISTORY_CLASS_BLOCKS,
  HISTORY_CLASS_MEMBERS,
  HISTORY_CLASSES,
  HISTORY_ENROLLMENTS,
  HISTORY_GROUPS,
  HISTORY_USERS,
} from './history';
import { SUBJECTS } from './subjects';
import { CLASS_MEMBERS, CLASSES, ENROLLMENTS, GROUPS, USERS } from './users';

/**
 * Change it whenever the fixtures change: the mock data saved in a browser with another version is
 * discarded and replaced with the new seed.
 */
export const SEED_VERSION = 19;

/** The data both worlds share: the mock data starts from it and `npm run seed` turns it into SQL. */
export const SEED: MockTables = {
  // This year, then the five before it (history.ts)
  users: [...USERS, ...HISTORY_USERS],
  subjects: SUBJECTS,
  classes: [...CLASSES, ...HISTORY_CLASSES],
  classMembers: [...CLASS_MEMBERS, ...HISTORY_CLASS_MEMBERS],
  groups: [...GROUPS, ...HISTORY_GROUPS],
  enrollments: [...ENROLLMENTS, ...HISTORY_ENROLLMENTS],
  classBlocks: [...CLASS_BLOCKS, ...HISTORY_CLASS_BLOCKS],
  exercises: EXERCISES,
  exerciseSubjects: EXERCISE_SUBJECTS,
  tests: TESTS,
  assignments: [...ASSIGNMENTS, ...HISTORY_ASSIGNMENTS],
  attempts: ATTEMPTS,
  interactions: INTERACTIONS,
  events: EVENTS,
  passwords: {},
  // Nobody has seen the guided help yet: every account starts with its welcome (2.12)
  guideStates: {},
  // Free plans only (D-053): when Flash-Lite is saturated (503 or no answer), the Gemma models of
  // the same API and key, each with its own quota; slower, so they get more time
  aiProvider: {
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    model: 'gemini-3.5-flash-lite',
    timeoutMs: 10_000,
    fallbacks: [
      { model: 'gemma-4-31b-it', timeoutMs: 30_000 },
      { model: 'gemma-4-26b-a4b-it', timeoutMs: 30_000 },
    ],
  },
};
