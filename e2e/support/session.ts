import type { Page } from '@playwright/test';

import { SEED, SEED_VERSION } from '../../src/app/data/mock/fixtures/seed';
import { ADMIN_ID, DAW_STUDENT_IDS, TEACHER_ID } from '../../src/app/data/mock/fixtures/users';

/** Seed users of each role, the same ones the dev toolbar offers. */
export const USERS = {
  student: DAW_STUDENT_IDS[0],
  /** Hugo: exercises in every status and hints asked, for the screenshots of the catalog. */
  studentHalfway: DAW_STUDENT_IDS[1],
  teacher: TEACHER_ID,
  admin: ADMIN_ID,
} as const;

/** localStorage keys of the mock data (data/mock/mock-db.ts and mock-network.ts). */
const DB_KEY = 'tutoria.mock-db';
const SESSION_KEY = 'tutoria.mock-session';
const LATENCY_KEY = 'tutoria.mock-latency';

/** When the seed user saw the notice on the registered data, for the tests that skip it. */
const NOTICE_SEEN_AT = '2026-09-15T08:00:00.000Z';

/**
 * The mock database as MockDb saves it, with the notice seen by `userId`: since step 2.2 the notice
 * lives in `app_user.privacy_notice_seen_at` (D-041), so it is part of the data, not a key of its own.
 */
function databaseWithNoticeSeen(userId: string): string {
  const users = SEED.users.map((user) =>
    user.id === userId ? { ...user, privacyNoticeSeenAt: NOTICE_SEEN_AT } : user,
  );
  return JSON.stringify({ version: SEED_VERSION, tables: { ...SEED, users } });
}

/**
 * Starts every page of the test with the given session (or none) and without simulated latency, as
 * the dev toolbar would leave it, and with the notice on the registered data already seen, unless a
 * test about the notice says otherwise. It must run before the first `page.goto()`.
 */
export async function startAs(
  page: Page,
  userId: string | null,
  { dataNoticeSeen = true } = {},
): Promise<void> {
  await page.addInitScript(
    ({ dbKey, sessionKey, latencyKey, userId, database }) => {
      // Only on the first load of the test: later reloads keep what the app saved (sign out…)
      if (sessionStorage.getItem('e2e-started')) return;
      sessionStorage.setItem('e2e-started', 'yes');
      localStorage.clear();
      localStorage.setItem(latencyKey, JSON.stringify({ min: 0, max: 0 }));
      if (userId) localStorage.setItem(sessionKey, userId);
      if (database) localStorage.setItem(dbKey, database);
    },
    {
      dbKey: DB_KEY,
      sessionKey: SESSION_KEY,
      latencyKey: LATENCY_KEY,
      userId,
      database: userId && dataNoticeSeen ? databaseWithNoticeSeen(userId) : null,
    },
  );
}
