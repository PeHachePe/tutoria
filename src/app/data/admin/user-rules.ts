/**
 * The rules of the accounts (CU-06, D-072), shared by the mock data and the Edge Function
 * `admin-users`. The Edge Function imports this file as it is, so it must not import anything: the
 * Edge Runtime resolves every import, also those of types, and only with their extension (D-042).
 */

export const MAX_USER_NAME_LENGTH = 100;

/** The longest address the standard allows (RFC 5321). */
export const MAX_EMAIL_LENGTH = 254;

export const MIN_PASSWORD_LENGTH = 8;

/**
 * In characters, as any site counts them: what NIST asks to accept at least, and short enough for
 * the 72 bytes bcrypt reads in Supabase Auth, unless it is full of accents or emoji.
 */
export const MAX_PASSWORD_LENGTH = 64;

/**
 * Accounts disabled in one request (5.2g): more than finish in a school in a year, and few enough
 * for the bans of Auth, one by one, to answer in time.
 */
export const MAX_DISABLE_BATCH = 100;

/**
 * Accounts created in one request (5.2h): Auth creates them one by one, so the screen sends a long
 * list in parts this size, which answer in time and tell how far it got.
 */
export const MAX_CREATE_BATCH = 25;

export type UserChangeProblem = 'own_role' | 'own_status' | 'has_groups' | 'has_enrollments';

/** What ties a user to the classes: the groups they teach and their enrollments. */
export interface UserLinks {
  readonly groups: number;
  readonly enrollments: number;
}

/**
 * Why the change cannot be made, or null. `role` and `status` are those of the target now. An
 * administrator never takes away their own role nor disables themselves (CU-06, 3b), and the role
 * only changes for someone without groups or enrollments: a teacher would leave groups nobody
 * manages and a student would stay enrolled (D-072).
 */
export function userChangeProblem(
  callerId: string,
  target: { readonly id: string; readonly role: string; readonly status: string },
  changes: { readonly role?: string; readonly status?: string },
  links: UserLinks,
): UserChangeProblem | null {
  const changesRole = changes.role !== undefined && changes.role !== target.role;
  const changesStatus = changes.status !== undefined && changes.status !== target.status;
  if (target.id === callerId) {
    if (changesRole && changes.role !== 'admin') return 'own_role';
    if (changesStatus && changes.status === 'disabled') return 'own_status';
  }
  if (changesRole && links.groups > 0) return 'has_groups';
  if (changesRole && links.enrollments > 0) return 'has_enrollments';
  return null;
}

/** Trimmed and in lower case, as Supabase Auth keeps it. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
