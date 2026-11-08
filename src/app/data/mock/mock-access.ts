import type { Attempt } from '../attempt';
import { DataError } from '../data-error';
import type { AppUser, ClassGroup } from '../user';
import type { MockTables } from './mock-tables';

/**
 * Access rules of the mock services. They imitate the row level security of 2.3, so the screens
 * behave the same with mock data as with Supabase.
 */

/** The row with `id`, or `DataError('not_found')`. */
export function findRow<Row extends { readonly id: string }>(
  rows: readonly Row[],
  id: string,
): Row {
  const row = rows.find((candidate) => candidate.id === id);
  if (!row) {
    throw new DataError('not_found');
  }
  return row;
}

/** Ids of the groups the user is enrolled in. */
export function enrolledGroupIds(tables: MockTables, userId: string): ReadonlySet<string> {
  return new Set(
    tables.enrollments.filter((enrollment) => enrollment.userId === userId).map((e) => e.groupId),
  );
}

/** Teachers manage their own groups; administrators, all of them. */
export function canManageGroup(user: AppUser, group: ClassGroup): boolean {
  return user.role === 'admin' || (user.role === 'teacher' && group.teacherId === user.id);
}

/** Students see their own data; teachers, that of the students in their groups; administrators, all. */
export function canSeeStudentData(tables: MockTables, user: AppUser, studentId: string): boolean {
  if (user.id === studentId || user.role === 'admin') {
    return true;
  }
  const groupIds = enrolledGroupIds(tables, studentId);
  return tables.groups.some((group) => groupIds.has(group.id) && canManageGroup(user, group));
}

/** The user's own attempt; anybody else's is `not_found`, as row level security hides it. */
export function findOwnAttempt(tables: MockTables, user: AppUser, attemptId: string): Attempt {
  const attempt = findRow(tables.attempts, attemptId);
  if (attempt.userId !== user.id) {
    throw new DataError('not_found');
  }
  return attempt;
}

export function now(): string {
  return new Date().toISOString();
}
