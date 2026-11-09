import type { Page } from '@playwright/test';

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
const SESSION_KEY = 'tutoria.mock-session';
const LATENCY_KEY = 'tutoria.mock-latency';
/** Prefix of the key that remembers the notice on the registered data (student/settings/settings-store.ts). */
const DATA_NOTICE_KEY = 'tutoria.data-notice-seen';

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
    ({ sessionKey, latencyKey, noticeKey, userId, dataNoticeSeen }) => {
      // Only on the first load of the test: later reloads keep what the app saved (sign out…)
      if (sessionStorage.getItem('e2e-started')) return;
      sessionStorage.setItem('e2e-started', 'yes');
      localStorage.clear();
      localStorage.setItem(latencyKey, JSON.stringify({ min: 0, max: 0 }));
      if (userId) localStorage.setItem(sessionKey, userId);
      if (userId && dataNoticeSeen) localStorage.setItem(`${noticeKey}.${userId}`, 'true');
    },
    {
      sessionKey: SESSION_KEY,
      latencyKey: LATENCY_KEY,
      noticeKey: DATA_NOTICE_KEY,
      userId,
      dataNoticeSeen,
    },
  );
}
