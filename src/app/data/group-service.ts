import type { Subject } from './subject';
import type { ClassGroup } from './user';

/** A group as its screen shows it. */
export interface ManagedGroup {
  readonly group: ClassGroup;
  readonly subject: Subject;
  readonly teacherName: string;
  readonly studentCount: number;
  /** Somebody opened an attempt in it: it cannot be removed. */
  readonly started: boolean;
}

/** A new group has no id yet; of an existing one, only name, year and teacher change. */
export type GroupDraft = Omit<ClassGroup, 'id'> & { readonly id?: string };

/** Who a group lists: a student or, for the administrator, a teacher. */
export interface UserRef {
  readonly id: string;
  readonly name: string;
  readonly email: string;
}

export interface EnrolledStudent {
  readonly enrollmentId: string;
  readonly student: UserRef;
}

export const MIN_STUDENT_SEARCH_LENGTH = 2;
export const MAX_STUDENT_SEARCH_RESULTS = 20;
/** Students enrolled in one request: a bound for a request, more than a screen chooses at once. */
export const MAX_ENROLLMENT_BATCH = 50;
/** As `class_group_school_year_format`: `2026/27`. */
export const SCHOOL_YEAR_PATTERN = /^\d{4}\/\d{2}$/;

/**
 * Groups and their enrollment (5.2a, RF-16): a teacher manages their own groups, an administrator
 * all of them and their teacher. Abstract class without a decorator: it is the injection token
 * (4.2, D-005).
 */
export abstract class GroupService {
  /** Those the user teaches, or all for an administrator, by name and subject. */
  abstract listGroups(): Promise<ManagedGroup[]>;

  /**
   * A teacher saves only groups of their own (`forbidden` otherwise); `invalid` if the teacher is
   * not an active one, with an empty name or a year not like `2026/27`.
   */
  abstract saveGroup(draft: GroupDraft): Promise<ManagedGroup>;

  /** `invalid` if a student started anything in it; `not_found` for a group of others. */
  abstract removeGroup(groupId: string): Promise<void>;

  /** By name. `not_found` for a group of others. */
  abstract listStudents(groupId: string): Promise<EnrolledStudent[]>;

  /** Active students who are not in the group; none with a search shorter than the minimum. */
  abstract searchStudents(groupId: string, search: string): Promise<UserRef[]>;

  /**
   * In one request, `MAX_ENROLLMENT_BATCH` at most, all or none; `invalid` for anybody who is not
   * an active student or is already in the group, `not_found` for a group of others.
   */
  abstract enroll(groupId: string, userIds: readonly string[]): Promise<EnrolledStudent[]>;

  /** Their attempts are kept. */
  abstract unenroll(enrollmentId: string): Promise<void>;

  /**
   * The active teachers, by name, for the administrator to choose one. A teacher reads only their
   * own account, as the RLS of `app_user` gives it.
   */
  abstract listTeachers(): Promise<UserRef[]>;
}
