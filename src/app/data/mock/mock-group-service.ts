import { inject, Service } from '@angular/core';

import { DataError } from '../data-error';
import {
  type ClassDraft,
  type DuplicateOptions,
  type EnrolledStudent,
  type GroupDraft,
  GroupService,
  type ManagedGroup,
  MAX_ENROLLMENT_BATCH,
  MAX_GROUP_BATCH,
  MAX_STUDENT_SEARCH_RESULTS,
  MIN_STUDENT_SEARCH_LENGTH,
  SCHOOL_YEAR_PATTERN,
  type UserRef,
} from '../group-service';
import { schoolYearShiftDays } from '../school-year-shift';
import type { AppUser, ClassGroup, Enrollment } from '../user';
import { copyGroupBlocks } from './copy-group-blocks';
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
      const previous = id === undefined ? undefined : this.findGroup(id);
      const name = this.checkClass(draft, previous?.teacherId !== draft.teacherId);
      // A change keeps the subject: only a new group needs one that exists
      if (!previous) this.checkSubjects([draft.subjectId]);
      const group: ClassGroup = previous
        ? { ...previous, name, schoolYear: draft.schoolYear, teacherId: draft.teacherId }
        : { ...draft, id: crypto.randomUUID(), name };
      this.db.update('groups', (rows) =>
        previous ? rows.map((row) => (row.id === group.id ? group : row)) : [...rows, group],
      );
      return this.toManaged(group);
    });
  }

  createGroups(draft: ClassDraft, subjectIds: readonly string[]): Promise<ManagedGroup[]> {
    return this.network.request(() => {
      const name = this.checkClass(draft, true);
      this.checkSubjects(subjectIds);
      const groups = subjectIds.map((subjectId): ClassGroup => ({
        ...draft,
        id: crypto.randomUUID(),
        name,
        subjectId,
      }));
      this.db.update('groups', (rows) => [...rows, ...groups]);
      return groups.map((group) => this.toManaged(group));
    });
  }

  duplicateGroups(
    sourceGroupIds: readonly string[],
    draft: ClassDraft,
    options: DuplicateOptions,
  ): Promise<ManagedGroup[]> {
    return this.network.request(() => {
      checkBatch(sourceGroupIds);
      const name = this.checkClass(draft, true);
      const sources = sourceGroupIds.map((groupId) => this.findGroup(groupId));
      const groups = sources.map((source): ClassGroup => {
        const group: ClassGroup = {
          ...draft,
          id: crypto.randomUUID(),
          name,
          subjectId: source.subjectId,
        };
        this.db.update('groups', (rows) => [...rows, group]);
        if (options.blocks) {
          const shift = options.dates
            ? schoolYearShiftDays(source.schoolYear, draft.schoolYear)
            : null;
          copyGroupBlocks(this.db, source.id, group.id, shift);
        }
        if (options.students) this.copyStudents(source.id, group.id);
        return group;
      });
      return groups.map((group) => this.toManaged(group));
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

  enroll(
    groupId: string,
    userIds: readonly string[],
    alsoGroupIds: readonly string[] = [],
  ): Promise<EnrolledStudent[]> {
    return this.network.request(() => {
      this.findGroup(groupId);
      alsoGroupIds.forEach((id) => this.findGroup(id));
      const enrolled = this.enrolledIn(groupId);
      const users = this.db.tables().users;
      const valid =
        userIds.length > 0 &&
        userIds.length <= MAX_ENROLLMENT_BATCH &&
        alsoGroupIds.length <= MAX_GROUP_BATCH &&
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
      // In the other groups of the class, those already there are skipped
      const others = alsoGroupIds
        .filter((id) => id !== groupId)
        .flatMap((otherId) => {
          const there = this.enrolledIn(otherId);
          return userIds
            .filter((userId) => !there.has(userId))
            .map((userId) => ({ id: crypto.randomUUID(), groupId: otherId, userId }));
        });
      this.db.update('enrollments', (current) => [...current, ...rows, ...others]);
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

  /**
   * The checks of a group, in the order of Postgres: `check_group_teacher` (only when the teacher
   * is chosen, so a group of a disabled teacher stays editable), the RLS and the checks of the
   * table. The name without surrounding spaces.
   */
  private checkClass(draft: ClassDraft, teacherChosen: boolean): string {
    const user = this.db.requireUser('teacher', 'admin');
    const teacher = this.db.tables().users.find((candidate) => candidate.id === draft.teacherId);
    if (teacherChosen && (!teacher || !isActive(teacher, 'teacher'))) {
      throw new DataError('invalid', 'The teacher of a group is an active teacher');
    }
    if (user.role !== 'admin' && draft.teacherId !== user.id) {
      throw new DataError('forbidden', 'A teacher saves only groups of their own');
    }
    const name = draft.name.trim();
    if (!name || !SCHOOL_YEAR_PATTERN.test(draft.schoolYear)) throw new DataError('invalid');
    return name;
  }

  /** Subjects that exist, each once and not too many: the foreign key and the batch. */
  private checkSubjects(subjectIds: readonly string[]): void {
    checkBatch(subjectIds);
    const subjects = this.db.tables().subjects;
    if (!subjectIds.every((id) => subjects.some((subject) => subject.id === id))) {
      throw new DataError('invalid');
    }
  }

  /** The active students of a group into another, as `duplicate_groups`. */
  private copyStudents(sourceGroupId: string, targetGroupId: string): void {
    const { users, enrollments } = this.db.tables();
    const rows = enrollments
      .filter((row) => row.groupId === sourceGroupId)
      .filter((row) => isActive(findRow(users, row.userId), 'student'))
      .map((row): Enrollment => ({
        id: crypto.randomUUID(),
        groupId: targetGroupId,
        userId: row.userId,
      }));
    this.db.update('enrollments', (current) => [...current, ...rows]);
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
    const user = findRow(this.db.tables().users, enrollment.userId);
    return { enrollmentId: enrollment.id, student: toRef(user), active: user.status === 'active' };
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

/** Between one and `MAX_GROUP_BATCH`, each once. */
function checkBatch(ids: readonly string[]): void {
  if (ids.length === 0 || ids.length > MAX_GROUP_BATCH || new Set(ids).size !== ids.length) {
    throw new DataError('invalid', 'Between one and the maximum, each once');
  }
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
