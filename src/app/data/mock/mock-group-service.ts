import { inject, Service } from '@angular/core';

import { DataError } from '../data-error';
import {
  type EnrolledStudent,
  type GroupDraft,
  GroupService,
  type ManagedGroup,
  MAX_ENROLLMENT_BATCH,
  MAX_STUDENT_SEARCH_RESULTS,
  MIN_STUDENT_SEARCH_LENGTH,
  SCHOOL_YEAR_PATTERN,
  type UserRef,
} from '../group-service';
import type { AppUser, ClassGroup, Enrollment } from '../user';
import { canManageGroup, findRow } from './mock-access';
import { MockDb } from './mock-db';
import { MockNetwork } from './mock-network';

/**
 * Groups and enrollment in MockDb, with the rules of the RLS of 5.2a: another teacher's groups are
 * `not_found`, a group keeps its subject and is only removed while nobody started anything in it.
 */
@Service({ autoProvided: false })
export class MockGroupService extends GroupService {
  private readonly db = inject(MockDb);
  private readonly network = inject(MockNetwork);

  listGroups(): Promise<ManagedGroup[]> {
    return this.network.request(() => {
      const user = this.db.requireUser('teacher', 'admin');
      return this.db
        .tables()
        .groups.filter((group) => canManageGroup(user, group))
        .map((group) => this.toManaged(group))
        .sort(
          (a, b) =>
            a.group.name.localeCompare(b.group.name, 'es') ||
            a.subject.name.localeCompare(b.subject.name, 'es'),
        );
    });
  }

  saveGroup({ id, ...draft }: GroupDraft): Promise<ManagedGroup> {
    return this.network.request(() => {
      const user = this.db.requireUser('teacher', 'admin');
      const previous = id === undefined ? undefined : this.findGroup(id);
      const tables = this.db.tables();
      // In the order of Postgres: `check_group_teacher`, the RLS, the checks and the foreign key.
      // The teacher is checked when chosen, so a group of a disabled teacher stays editable.
      const teacher = tables.users.find((candidate) => candidate.id === draft.teacherId);
      const chosen = previous?.teacherId !== draft.teacherId;
      if (chosen && (!teacher || !isActive(teacher, 'teacher'))) {
        throw new DataError('invalid', 'The teacher of a group is an active teacher');
      }
      if (user.role !== 'admin' && draft.teacherId !== user.id) {
        throw new DataError('forbidden', 'A teacher saves only groups of their own');
      }
      const name = draft.name.trim();
      if (!name || !SCHOOL_YEAR_PATTERN.test(draft.schoolYear)) throw new DataError('invalid');
      // A change keeps the subject: only a new group needs one that exists
      if (!previous && !tables.subjects.some((subject) => subject.id === draft.subjectId)) {
        throw new DataError('invalid');
      }
      const group: ClassGroup = previous
        ? { ...previous, name, schoolYear: draft.schoolYear, teacherId: draft.teacherId }
        : { ...draft, id: crypto.randomUUID(), name };
      this.db.update('groups', (rows) =>
        previous ? rows.map((row) => (row.id === group.id ? group : row)) : [...rows, group],
      );
      return this.toManaged(group);
    });
  }

  removeGroup(groupId: string): Promise<void> {
    return this.network.request(() => {
      this.findGroup(groupId);
      if (this.isStarted(groupId)) {
        throw new DataError('invalid', 'A group somebody started keeps their attempts');
      }
      this.db.update('groups', (rows) => rows.filter((row) => row.id !== groupId));
      this.db.update('enrollments', (rows) => rows.filter((row) => row.groupId !== groupId));
      this.db.update('classBlocks', (rows) => rows.filter((row) => row.groupId !== groupId));
      this.db.update('assignments', (rows) => rows.filter((row) => row.groupId !== groupId));
    });
  }

  listStudents(groupId: string): Promise<EnrolledStudent[]> {
    return this.network.request(() => {
      this.findGroup(groupId);
      return this.db
        .tables()
        .enrollments.filter((enrollment) => enrollment.groupId === groupId)
        .map((enrollment) => this.toEnrolled(enrollment))
        .sort((a, b) => a.student.name.localeCompare(b.student.name, 'es'));
    });
  }

  searchStudents(groupId: string, search: string): Promise<UserRef[]> {
    return this.network.request(() => {
      this.findGroup(groupId);
      const text = fold(search.trim());
      if (text.length < MIN_STUDENT_SEARCH_LENGTH) return [];
      const enrolled = this.enrolledIn(groupId);
      return this.db
        .tables()
        .users.filter(
          (user) =>
            isActive(user, 'student') &&
            !enrolled.has(user.id) &&
            (fold(user.name).includes(text) || user.email.includes(text)),
        )
        .sort((a, b) => a.name.localeCompare(b.name, 'es'))
        .slice(0, MAX_STUDENT_SEARCH_RESULTS)
        .map(toRef);
    });
  }

  enroll(groupId: string, userIds: readonly string[]): Promise<EnrolledStudent[]> {
    return this.network.request(() => {
      this.findGroup(groupId);
      const enrolled = this.enrolledIn(groupId);
      const users = this.db.tables().users;
      const valid =
        userIds.length > 0 &&
        userIds.length <= MAX_ENROLLMENT_BATCH &&
        new Set(userIds).size === userIds.length &&
        userIds.every((userId) => {
          const user = users.find((candidate) => candidate.id === userId);
          return user !== undefined && isActive(user, 'student') && !enrolled.has(userId);
        });
      if (!valid) throw new DataError('invalid', 'Only active students not in the group yet');
      const rows: Enrollment[] = userIds.map((userId) => ({
        id: crypto.randomUUID(),
        groupId,
        userId,
      }));
      this.db.update('enrollments', (current) => [...current, ...rows]);
      return rows.map((row) => this.toEnrolled(row));
    });
  }

  unenroll(enrollmentId: string): Promise<void> {
    return this.network.request(() => {
      const enrollment = findRow(this.db.tables().enrollments, enrollmentId);
      this.findGroup(enrollment.groupId);
      this.db.update('enrollments', (rows) => rows.filter((row) => row.id !== enrollmentId));
    });
  }

  listTeachers(): Promise<UserRef[]> {
    return this.network.request(() => {
      const caller = this.db.requireUser('teacher', 'admin');
      return this.db
        .tables()
        .users.filter(
          (user) => isActive(user, 'teacher') && (caller.role === 'admin' || user.id === caller.id),
        )
        .sort((a, b) => a.name.localeCompare(b.name, 'es'))
        .map(toRef);
    });
  }

  /** A group the user manages; any other is `not_found`, as row level security hides it. */
  private findGroup(groupId: string): ClassGroup {
    const user = this.db.requireUser('teacher', 'admin');
    const group = findRow(this.db.tables().groups, groupId);
    if (!canManageGroup(user, group)) throw new DataError('not_found');
    return group;
  }

  private toManaged(group: ClassGroup): ManagedGroup {
    const tables = this.db.tables();
    return {
      group,
      subject: findRow(tables.subjects, group.subjectId),
      teacherName: findRow(tables.users, group.teacherId).name,
      studentCount: this.enrolledIn(group.id).size,
      started: this.isStarted(group.id),
    };
  }

  private toEnrolled(enrollment: Enrollment): EnrolledStudent {
    return {
      enrollmentId: enrollment.id,
      student: toRef(findRow(this.db.tables().users, enrollment.userId)),
    };
  }

  private enrolledIn(groupId: string): ReadonlySet<string> {
    return new Set(
      this.db
        .tables()
        .enrollments.filter((enrollment) => enrollment.groupId === groupId)
        .map((enrollment) => enrollment.userId),
    );
  }

  /** As `is_started_group`: an attempt at an assignment of the group. */
  private isStarted(groupId: string): boolean {
    const { assignments, attempts } = this.db.tables();
    const ids = new Set(assignments.filter((row) => row.groupId === groupId).map((row) => row.id));
    return attempts.some(
      (attempt) => attempt.assignmentId !== null && ids.has(attempt.assignmentId),
    );
  }
}

function isActive(user: AppUser, role: AppUser['role']): boolean {
  return user.role === role && user.status === 'active';
}

function toRef({ id, name, email }: AppUser): UserRef {
  return { id, name, email };
}

/** In lower case and without accents, as `unaccent(lower(…))`. */
function fold(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
}
