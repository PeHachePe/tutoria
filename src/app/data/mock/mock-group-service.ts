import { inject, Service } from '@angular/core';

import { DataError } from '../data-error';
import {
  type ClassDraft,
  type DuplicateOptions,
  type EnrollTarget,
  type GroupChanges,
  type GroupDraft,
  GroupService,
  type ManagedClass,
  type ManagedGroup,
  MAX_ENROLLMENT_BATCH,
  MAX_GROUP_BATCH,
  MAX_GROUP_LABEL_LENGTH,
  MAX_STUDENT_SEARCH_RESULTS,
  MIN_STUDENT_SEARCH_LENGTH,
  type RosterStudent,
  SCHOOL_YEAR_PATTERN,
  type UserRef,
} from '../group-service';
import { schoolYearShiftDays } from '../school-year-shift';
import type { AppUser, ClassGroup, Enrollment, SchoolClass } from '../user';
import { copyGroupBlocks } from './copy-group-blocks';
import { canManageGroup, findRow, managesClass } from './mock-access';
import { MockDb } from './mock-db';
import { MockNetwork } from './mock-network';

/**
 * Classes, groups and enrollment in MockDb, with the rules of the RLS and the functions of 5.2a and
 * 5.2d: every teacher reads every class and joins any; another teacher's groups are `not_found`; a
 * group keeps its subject and is only removed while nobody started anything in it.
 */
@Service({ autoProvided: false })
export class MockGroupService extends GroupService {
  private readonly db = inject(MockDb);
  private readonly network = inject(MockNetwork);

  listClasses(): Promise<ManagedClass[]> {
    return this.network.request(() => {
      const user = this.db.requireUser('teacher', 'admin');
      const tables = this.db.tables();
      return sortClasses(tables.classes.filter((row) => managesClass(tables, user, row.id))).map(
        (schoolClass) => ({
          schoolClass,
          groups: tables.groups
            .filter((group) => group.classId === schoolClass.id)
            .map((group) => this.toManaged(user, group))
            .sort(
              (a, b) =>
                a.subject.name.localeCompare(b.subject.name, 'es') ||
                (a.group.label ?? '').localeCompare(b.group.label ?? '', 'es'),
            ),
          canEdit: canEditClass(user, schoolClass),
        }),
      );
    });
  }

  listAllClasses(): Promise<SchoolClass[]> {
    return this.network.request(() => {
      this.db.requireUser('teacher', 'admin');
      return sortClasses(this.db.tables().classes);
    });
  }

  createClass(
    draft: ClassDraft,
    subjectIds: readonly string[],
    teacherId: string,
  ): Promise<string> {
    return this.network.request(() => {
      const user = this.db.requireUser('teacher', 'admin');
      if (subjectIds.length > MAX_GROUP_BATCH || new Set(subjectIds).size !== subjectIds.length) {
        throw new DataError('invalid', 'Up to the maximum of subjects, each once');
      }
      if (subjectIds.length > 0 && user.role !== 'admin' && teacherId !== user.id) {
        throw new DataError('forbidden', 'A teacher creates groups of their own');
      }
      const found = this.findClass(draft);
      subjectIds.forEach((subjectId) =>
        this.checkNewGroup(found?.id ?? null, { subjectId, label: null, teacherId }),
      );
      const classId = found?.id ?? this.createClassRow(user, draft);
      for (const subjectId of subjectIds) {
        this.createGroup(classId, { subjectId, label: null, teacherId }, true);
      }
      return classId;
    });
  }

  saveClass(classId: string, draft: ClassDraft): Promise<void> {
    return this.network.request(() => {
      const user = this.db.requireUser('teacher', 'admin');
      const previous = findRow(this.db.tables().classes, classId);
      if (!canEditClass(user, previous)) {
        throw new DataError('forbidden', 'Only its creator or the administration');
      }
      const changed = { ...previous, ...this.checkClassDraft(draft, classId) };
      this.db.update('classes', (rows) => rows.map((row) => (row.id === classId ? changed : row)));
    });
  }

  removeClass(classId: string): Promise<void> {
    return this.network.request(() => {
      const user = this.db.requireUser('teacher', 'admin');
      const tables = this.db.tables();
      const schoolClass = findRow(tables.classes, classId);
      if (
        !canEditClass(user, schoolClass) ||
        tables.groups.some((group) => group.classId === classId)
      ) {
        throw new DataError('invalid', 'Only its creator or the administration, while empty');
      }
      this.db.update('classes', (rows) => rows.filter((row) => row.id !== classId));
      this.db.update('classMembers', (rows) => rows.filter((row) => row.classId !== classId));
    });
  }

  addGroup(classId: string, draft: GroupDraft): Promise<string> {
    return this.network.request(() => {
      const user = this.db.requireUser('teacher', 'admin');
      if (user.role !== 'admin' && draft.teacherId !== user.id) {
        throw new DataError('forbidden', 'A teacher creates groups of their own');
      }
      findRow(this.db.tables().classes, classId);
      const label = normalLabel(draft.label);
      this.checkNewGroup(classId, { ...draft, label });
      return this.createGroup(classId, { ...draft, label }, label === null).id;
    });
  }

  saveGroup(groupId: string, changes: GroupChanges): Promise<void> {
    return this.network.request(() => {
      const user = this.db.requireUser('teacher', 'admin');
      const previous = this.findGroup(groupId);
      const teacherChosen = changes.teacherId !== previous.teacherId;
      if (teacherChosen) this.checkTeacher(changes.teacherId);
      if (user.role !== 'admin' && changes.teacherId !== user.id) {
        throw new DataError('forbidden', 'A teacher does not hand their group over');
      }
      const label = normalLabel(changes.label);
      this.checkLabel(label);
      this.checkUnique({ ...previous, label }, groupId);
      const group: ClassGroup = { ...previous, label, teacherId: changes.teacherId };
      this.db.update('groups', (rows) => rows.map((row) => (row.id === groupId ? group : row)));
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

  duplicateClass(
    classId: string,
    draft: ClassDraft,
    groupIds: readonly string[],
    options: DuplicateOptions,
  ): Promise<string> {
    return this.network.request(() => {
      const user = this.db.requireUser('teacher', 'admin');
      const source = this.findManagedClass(user, classId);
      if (
        groupIds.length === 0 ||
        groupIds.length > MAX_GROUP_BATCH ||
        new Set(groupIds).size !== groupIds.length
      ) {
        throw new DataError('invalid', 'Between one and the maximum of groups, each once');
      }
      const groups = groupIds.map((groupId) => {
        const group = this.db.tables().groups.find((row) => row.id === groupId);
        if (!group || group.classId !== classId || !canManageGroup(user, group)) {
          throw new DataError('not_found');
        }
        return group;
      });
      const found = this.findClass(draft);
      if (found?.id === classId) throw new DataError('invalid', 'A class is copied into another');
      groups.forEach((group) => this.checkNewGroup(found?.id ?? null, group));
      const targetId = found?.id ?? this.createClassRow(user, draft);
      if (options.students) {
        this.addMembers(targetId, this.activeMembers(classId));
      }
      const shift = options.dates ? schoolYearShiftDays(source.schoolYear, draft.schoolYear) : null;
      for (const group of groups) {
        const copy = this.createGroup(targetId, group, !options.students && group.label === null);
        if (options.blocks) copyGroupBlocks(this.db, group.id, copy.id, shift);
        if (options.students) {
          this.addEnrollments(
            copy.id,
            [...this.enrolledIn(group.id)].filter((userId) => this.isActiveStudent(userId)),
          );
        }
      }
      return targetId;
    });
  }

  listRoster(classId: string): Promise<RosterStudent[]> {
    return this.network.request(() => {
      const user = this.db.requireUser('teacher', 'admin');
      this.findManagedClass(user, classId);
      const tables = this.db.tables();
      const groupIds = new Set(
        tables.groups.filter((group) => group.classId === classId).map((group) => group.id),
      );
      const members = new Set(
        tables.classMembers.filter((row) => row.classId === classId).map((row) => row.userId),
      );
      const people = new Set([
        ...members,
        ...tables.enrollments.filter((row) => groupIds.has(row.groupId)).map((row) => row.userId),
      ]);
      return [...people]
        .map((userId) => findRow(tables.users, userId))
        .sort((a, b) => a.name.localeCompare(b.name, 'es'))
        .map((student) => ({
          student: toRef(student),
          active: student.status === 'active',
          member: members.has(student.id),
          groupIds: tables.enrollments
            .filter((row) => row.userId === student.id && groupIds.has(row.groupId))
            .map((row) => row.groupId)
            .sort(),
        }));
    });
  }

  searchStudents(target: EnrollTarget, search: string): Promise<UserRef[]> {
    return this.network.request(() => {
      const user = this.db.requireUser('teacher', 'admin');
      let taken: ReadonlySet<string>;
      if (target.kind === 'class') {
        this.findManagedClass(user, target.id);
        taken = new Set(this.membersOf(target.id));
      } else {
        this.findGroup(target.id);
        taken = this.enrolledIn(target.id);
      }
      const text = fold(search.trim());
      if (text.length < MIN_STUDENT_SEARCH_LENGTH) return [];
      return this.db
        .tables()
        .users.filter(
          (candidate) =>
            isActive(candidate, 'student') &&
            !taken.has(candidate.id) &&
            (fold(candidate.name).includes(text) || candidate.email.includes(text)),
        )
        .sort((a, b) => a.name.localeCompare(b.name, 'es'))
        .slice(0, MAX_STUDENT_SEARCH_RESULTS)
        .map(toRef);
    });
  }

  enrollInClass(classId: string, userIds: readonly string[]): Promise<void> {
    return this.network.request(() => {
      const user = this.db.requireUser('teacher', 'admin');
      this.findManagedClass(user, classId);
      this.checkStudents(userIds, new Set());
      this.addMembers(classId, userIds);
      for (const group of this.db.tables().groups) {
        if (group.classId === classId && group.label === null) {
          this.addEnrollments(group.id, userIds);
        }
      }
    });
  }

  removeFromClass(classId: string, userId: string): Promise<void> {
    return this.network.request(() => {
      const user = this.db.requireUser('teacher', 'admin');
      this.findManagedClass(user, classId);
      const tables = this.db.tables();
      const groupIds = new Set(
        tables.groups.filter((group) => group.classId === classId).map((group) => group.id),
      );
      const isMember = (row: { classId: string; userId: string }) =>
        row.classId === classId && row.userId === userId;
      const isEnrolled = (row: Enrollment) => row.userId === userId && groupIds.has(row.groupId);
      if (!tables.classMembers.some(isMember) && !tables.enrollments.some(isEnrolled)) {
        throw new DataError('not_found');
      }
      this.db.update('classMembers', (rows) => rows.filter((row) => !isMember(row)));
      this.db.update('enrollments', (rows) => rows.filter((row) => !isEnrolled(row)));
    });
  }

  enroll(groupId: string, userIds: readonly string[]): Promise<void> {
    return this.network.request(() => {
      this.findGroup(groupId);
      this.checkStudents(userIds, this.enrolledIn(groupId));
      this.addEnrollments(groupId, userIds);
    });
  }

  unenroll(groupId: string, userId: string): Promise<void> {
    return this.network.request(() => {
      this.findGroup(groupId);
      if (!this.enrolledIn(groupId).has(userId)) throw new DataError('not_found');
      this.db.update('enrollments', (rows) =>
        rows.filter((row) => row.groupId !== groupId || row.userId !== userId),
      );
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

  /** As the checks of `school_class`: a name without surrounding spaces, a year, once per year. */
  private checkClassDraft(draft: ClassDraft, classId?: string): ClassDraft {
    const name = draft.name.trim();
    if (!name || !SCHOOL_YEAR_PATTERN.test(draft.schoolYear)) throw new DataError('invalid');
    const taken = this.db
      .tables()
      .classes.some(
        (row) =>
          row.id !== classId &&
          row.schoolYear === draft.schoolYear &&
          row.name.toLowerCase() === name.toLowerCase(),
      );
    if (taken) throw new DataError('invalid', 'A class with that name and year exists');
    return { name, schoolYear: draft.schoolYear };
  }

  /** As `find_or_create_class`: the class with that name, whatever its capitals, and year. */
  private findClass(draft: ClassDraft): SchoolClass | undefined {
    const name = draft.name.trim().toLowerCase();
    return this.db
      .tables()
      .classes.find(
        (row) => row.schoolYear === draft.schoolYear && row.name.toLowerCase() === name,
      );
  }

  /** A new class of the user, or `invalid`. */
  private createClassRow(user: AppUser, draft: ClassDraft): string {
    const created: SchoolClass = {
      ...this.checkClassDraft(draft),
      id: crypto.randomUUID(),
      createdBy: user.id,
      createdAt: new Date().toISOString(),
    };
    this.db.update('classes', (rows) => [...rows, created]);
    return created.id;
  }

  /**
   * The checks of a new group, before anything is written: all or none. In a class that does not
   * exist yet (`null`) no subject is taken.
   */
  private checkNewGroup(classId: string | null, draft: GroupDraft): void {
    this.checkTeacher(draft.teacherId);
    this.checkLabel(draft.label);
    if (!this.db.tables().subjects.some((subject) => subject.id === draft.subjectId)) {
      throw new DataError('invalid', 'No such subject');
    }
    if (classId !== null) this.checkUnique({ ...draft, classId });
  }

  /** As `check_group_teacher`. */
  private checkTeacher(teacherId: string): void {
    const teacher = this.db.tables().users.find((candidate) => candidate.id === teacherId);
    if (!teacher || !isActive(teacher, 'teacher')) {
      throw new DataError('invalid', 'The teacher of a group is an active teacher');
    }
  }

  private checkLabel(label: string | null): void {
    if (label !== null && label.length > MAX_GROUP_LABEL_LENGTH) {
      throw new DataError('invalid', 'A label is short');
    }
  }

  /** As `class_group_class_subject_label_key`: each subject once per class and label. */
  private checkUnique(
    group: Pick<ClassGroup, 'classId' | 'subjectId' | 'label'>,
    groupId?: string,
  ): void {
    const taken = this.db
      .tables()
      .groups.some(
        (row) =>
          row.id !== groupId &&
          row.classId === group.classId &&
          row.subjectId === group.subjectId &&
          row.label === group.label,
      );
    if (taken) throw new DataError('invalid', 'The class already has that subject');
  }

  /** As `create_class_group`, after its checks. */
  private createGroup(classId: string, draft: GroupDraft, withClassStudents: boolean): ClassGroup {
    const group: ClassGroup = {
      id: crypto.randomUUID(),
      classId,
      subjectId: draft.subjectId,
      label: draft.label,
      teacherId: draft.teacherId,
    };
    this.db.update('groups', (rows) => [...rows, group]);
    if (withClassStudents) this.addEnrollments(group.id, this.activeMembers(classId));
    return group;
  }

  /** Between one and the maximum, each once, active students not in `taken`. */
  private checkStudents(userIds: readonly string[], taken: ReadonlySet<string>): void {
    const valid =
      userIds.length > 0 &&
      userIds.length <= MAX_ENROLLMENT_BATCH &&
      new Set(userIds).size === userIds.length &&
      userIds.every((userId) => this.isActiveStudent(userId) && !taken.has(userId));
    if (!valid) throw new DataError('invalid', 'Only active students not there yet');
  }

  /** Into the class; who is there already is skipped. */
  private addMembers(classId: string, userIds: readonly string[]): void {
    const there = new Set(this.membersOf(classId));
    const rows = userIds
      .filter((userId) => !there.has(userId))
      .map((userId) => ({ classId, userId }));
    this.db.update('classMembers', (current) => [...current, ...rows]);
  }

  /** Into the group; who is there already is skipped. */
  private addEnrollments(groupId: string, userIds: readonly string[]): void {
    const there = this.enrolledIn(groupId);
    const rows = userIds
      .filter((userId) => !there.has(userId))
      .map((userId): Enrollment => ({ id: crypto.randomUUID(), groupId, userId }));
    this.db.update('enrollments', (current) => [...current, ...rows]);
  }

  private membersOf(classId: string): string[] {
    return this.db
      .tables()
      .classMembers.filter((row) => row.classId === classId)
      .map((row) => row.userId);
  }

  private activeMembers(classId: string): string[] {
    return this.membersOf(classId).filter((userId) => this.isActiveStudent(userId));
  }

  private isActiveStudent(userId: string): boolean {
    const user = this.db.tables().users.find((candidate) => candidate.id === userId);
    return user !== undefined && isActive(user, 'student');
  }

  /** A class the user looks after; any other is `not_found`, as the functions say. */
  private findManagedClass(user: AppUser, classId: string): SchoolClass {
    const tables = this.db.tables();
    const schoolClass = findRow(tables.classes, classId);
    if (!managesClass(tables, user, classId)) throw new DataError('not_found');
    return schoolClass;
  }

  /** A group the user manages; any other is `not_found`, as row level security hides it. */
  private findGroup(groupId: string): ClassGroup {
    const user = this.db.requireUser('teacher', 'admin');
    const group = findRow(this.db.tables().groups, groupId);
    if (!canManageGroup(user, group)) throw new DataError('not_found');
    return group;
  }

  private toManaged(user: AppUser, group: ClassGroup): ManagedGroup {
    const tables = this.db.tables();
    return {
      group,
      subject: findRow(tables.subjects, group.subjectId),
      teacherName: findRow(tables.users, group.teacherId).name,
      studentCount: this.enrolledIn(group.id).size,
      started: this.isStarted(group.id),
      mine: canManageGroup(user, group),
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

/** As the RLS of `school_class`: its creator, while a member of the staff, or the administrator. */
function canEditClass(user: AppUser, schoolClass: SchoolClass): boolean {
  return user.role === 'admin' || (user.role === 'teacher' && schoolClass.createdBy === user.id);
}

/** Trimmed, and none if blank, as `create_class_group`. */
function normalLabel(label: string | null): string | null {
  return label?.trim() || null;
}

/** The most recent year first, then by name. */
function sortClasses(classes: readonly SchoolClass[]): SchoolClass[] {
  return [...classes].sort(
    (a, b) => b.schoolYear.localeCompare(a.schoolYear) || a.name.localeCompare(b.name, 'es'),
  );
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
