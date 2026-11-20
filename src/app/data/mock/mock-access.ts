import type { Attempt } from '../attempt';
import { DataError } from '../data-error';
import type { ExerciseAssignment } from '../exercise';
import type { AppUser, ClassGroup, SchoolClass } from '../user';
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

/**
 * Who looks after a class and its students (5.2d), as `manages_class`: the administrator, its
 * teachers and the teacher who created it. For a member of the staff: its callers require one.
 */
export function managesClass(tables: MockTables, user: AppUser, classId: string): boolean {
  if (user.role === 'admin') return true;
  return (
    tables.classes.some((row) => row.id === classId && row.createdBy === user.id) ||
    tables.groups.some((group) => group.classId === classId && group.teacherId === user.id)
  );
}

/** The class of a group, which gives it its name and year (5.2d). */
export function classOfGroup(tables: MockTables, group: ClassGroup): SchoolClass {
  return findRow(tables.classes, group.classId);
}

/**
 * The assignment is shown to its students: neither it nor its block is hidden (2.5c), and the block
 * has reached its opening date (4.3d), as `is_visible_assignment`.
 */
export function isVisibleAssignment(tables: MockTables, assignment: ExerciseAssignment): boolean {
  const block = tables.classBlocks.find((candidate) => candidate.id === assignment.blockId);
  return (
    !assignment.isHidden &&
    block !== undefined &&
    !block.isHidden &&
    (block.opensAt === null || block.opensAt <= now())
  );
}

/**
 * Who sees an assignment, as its policy: a student of its group while it is visible, its teacher or
 * an administrator.
 */
export function canSeeAssignment(
  tables: MockTables,
  user: AppUser,
  assignment: ExerciseAssignment,
): boolean {
  if (canManageGroup(user, findRow(tables.groups, assignment.groupId))) {
    return true;
  }
  return (
    enrolledGroupIds(tables, user.id).has(assignment.groupId) &&
    isVisibleAssignment(tables, assignment)
  );
}

/** The assignment the user sees; any other is `not_found`, as row level security hides it. */
export function findVisibleAssignment(
  tables: MockTables,
  user: AppUser,
  assignmentId: string,
): ExerciseAssignment {
  const assignment = findRow(tables.assignments, assignmentId);
  if (!canSeeAssignment(tables, user, assignment)) {
    throw new DataError('not_found');
  }
  return assignment;
}

/**
 * The assignment the user opens attempts at, as `can_open_assignment`: one they see of a group they
 * are enrolled in. Its teacher and the administration try the exercise without an attempt (4.3e).
 */
export function findOpenableAssignment(
  tables: MockTables,
  user: AppUser,
  assignmentId: string,
): ExerciseAssignment {
  const assignment = findRow(tables.assignments, assignmentId);
  if (
    !enrolledGroupIds(tables, user.id).has(assignment.groupId) ||
    !isVisibleAssignment(tables, assignment)
  ) {
    throw new DataError('not_found');
  }
  return assignment;
}

/**
 * Who reads an attempt, as `can_read_attempt`: its student, the teacher of the group of its
 * assignment and the administration. Another teacher of the student does not (D-062).
 */
export function canReadAttempt(tables: MockTables, user: AppUser, attempt: Attempt): boolean {
  if (user.id === attempt.userId || user.role === 'admin') {
    return true;
  }
  const assignment = tables.assignments.find((candidate) => candidate.id === attempt.assignmentId);
  return (
    assignment !== undefined && canManageGroup(user, findRow(tables.groups, assignment.groupId))
  );
}

/** The user's own attempt; anybody else's is `not_found`, as row level security hides it. */
export function findOwnAttempt(tables: MockTables, user: AppUser, attemptId: string): Attempt {
  const attempt = findRow(tables.attempts, attemptId);
  if (attempt.userId !== user.id) {
    throw new DataError('not_found');
  }
  return attempt;
}

/**
 * The attempt its student still works on, as `is_open_attempt`: they are enrolled in the group of
 * its assignment and see it. Otherwise it is `forbidden` to run its code or to ask the tutor about
 * it, as `execute` and `tutor` answer (D-063).
 */
export function requireOpenAttempt(tables: MockTables, attempt: Attempt): void {
  const assignment = tables.assignments.find((candidate) => candidate.id === attempt.assignmentId);
  if (
    assignment === undefined ||
    !enrolledGroupIds(tables, attempt.userId).has(assignment.groupId) ||
    !isVisibleAssignment(tables, assignment)
  ) {
    throw new DataError('forbidden', 'The exercise is not open');
  }
}

export function now(): string {
  return new Date().toISOString();
}
