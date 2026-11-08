/**
 * Share of the left column the statement takes on wide screens, in percent (ficha 03): the student
 * moves it with the splitter between the statement and the code, and it is remembered per user in
 * this browser, as a convenience. The code keeps at least 30 %.
 */
export const STATEMENT_SHARE = { default: 45, min: 15, max: 70 } as const;

const STORAGE_KEY_PREFIX = 'tutoria.statement-share';

export function statementShareKey(userId: string): string {
  return `${STORAGE_KEY_PREFIX}.${userId}`;
}

export function readStatementShare(userId: string | undefined): number {
  if (!userId) return STATEMENT_SHARE.default;
  let saved: string | null = null;
  try {
    saved = localStorage.getItem(statementShareKey(userId));
  } catch {
    // Storage unavailable: the default share
  }
  const share = Number(saved);
  return saved && share >= STATEMENT_SHARE.min && share <= STATEMENT_SHARE.max
    ? share
    : STATEMENT_SHARE.default;
}

export function saveStatementShare(userId: string | undefined, share: number): void {
  if (!userId) return;
  try {
    localStorage.setItem(statementShareKey(userId), String(share));
  } catch {
    // Storage unavailable: the share lasts until the page is closed
  }
}
