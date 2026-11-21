import type { Subject } from './subject';
import type { ClassGroup, ClassOutcome, SchoolClass } from './user';

/** A group as the screen of its class shows it. */
export interface ManagedGroup {
  readonly group: ClassGroup;
  readonly subject: Subject;
  readonly teacherName: string;
  readonly studentCount: number;
  /** Somebody opened an attempt in it: it cannot be removed. */
  readonly started: boolean;
  /** The user teaches it, or is the administrator: they change it and its students. */
  readonly mine: boolean;
}

/** A class as the user looks after it (5.2d, D-081). */
export interface ManagedClass {
  readonly schoolClass: SchoolClass;
  /** Every group of the class, those of other teachers too. */
  readonly groups: readonly ManagedGroup[];
  /** Its creator or the administrator: they rename it and, while it has no groups, delete it. */
  readonly canEdit: boolean;
  /**
   * Of this year or a later one, or reopened (5.2e, D-082): one of a past year is read only for
   * everybody, but it is still duplicated.
   */
  readonly open: boolean;
}

/** A group of a class as another teacher sees it (5.2d): its subject, its split and its teacher. */
export interface ClassSubject {
  readonly subjectId: string;
  readonly label: string | null;
  readonly teacherName: string;
}

/** A class of the school as a teacher chooses one to join, with its groups. */
export interface SchoolClassEntry {
  readonly schoolClass: SchoolClass;
  readonly groups: readonly ClassSubject[];
}

/** What a class is: its name and year. */
export type ClassDraft = Pick<SchoolClass, 'name' | 'schoolYear'>;

/** A new group of a class: a subject, a label for a split and its teacher. */
export type GroupDraft = Pick<ClassGroup, 'subjectId' | 'label' | 'teacherId'>;

/** Of an existing group, only its label and (the administrator) its teacher change. */
export type GroupChanges = Pick<ClassGroup, 'label' | 'teacherId'>;

/** What a duplicated group brings of its source (5.2c). */
export interface DuplicateOptions {
  /** Its blocks, with their exercises, order and visibility. */
  readonly blocks: boolean;
  /** The dates of those blocks, moved to the new year in whole weeks; without them, none. */
  readonly dates: boolean;
  /** The active students of the class and of each group. */
  readonly students: boolean;
}

/** Who a class lists: a student or, for the administrator, a teacher. */
export interface UserRef {
  readonly id: string;
  readonly name: string;
  readonly email: string;
}

/** A student of a class, or of one of its groups only (a subject taken from another class). */
export interface RosterStudent {
  readonly student: UserRef;
  /** A disabled account stays where it was, but cannot be enrolled anywhere else. */
  readonly active: boolean;
  /** In the class: groups of the whole class take them. */
  readonly member: boolean;
  /** Their final evaluation in the class (5.2g); null without one, or out of the class. */
  readonly outcome: ClassOutcome | null;
  /**
   * Out of the class, the class of its year they are a student of (5.2g): they take a subject from
   * it, and are not added to this one, as a student has one class a year. Null for the others.
   */
  readonly otherClass: string | null;
  /** The groups of the class they are in. */
  readonly groupIds: readonly string[];
}

/**
 * The last class of a student up to the year of the class they are chosen for, and their outcome in
 * it (5.2g): where they come from, or where they are this year.
 */
export interface PreviousClass {
  readonly name: string;
  readonly schoolYear: string;
  readonly outcome: ClassOutcome | null;
}

/** A student to enroll, and where they come from (5.2g). */
export interface ClassCandidate {
  readonly student: UserRef;
  /** Null for a student who never had a class. */
  readonly previous: PreviousClass | null;
}

/** A line of a pasted list and the student it names (5.2d), with where they come from (5.2g). */
export interface StudentMatch extends ClassCandidate {
  readonly entry: string;
}

/** Where students are enrolled: the class (and its groups of the whole class) or one group. */
export type EnrollTarget =
  { readonly kind: 'class'; readonly id: string } | { readonly kind: 'group'; readonly id: string };

export const MIN_STUDENT_SEARCH_LENGTH = 2;
export const MAX_STUDENT_SEARCH_RESULTS = 20;
/** Students enrolled in one request: a bound for a request, more than a screen chooses at once. */
export const MAX_ENROLLMENT_BATCH = 50;
/** Groups made in one request (5.2c): more subjects than a class has. */
export const MAX_GROUP_BATCH = 20;
/** Students evaluated in one request (5.2g), as `set_class_outcomes`: more than a class has. */
export const MAX_OUTCOME_BATCH = 100;
/** Lines of a pasted list read at once: more than any class has. */
export const MAX_PASTED_LINES = 500;
/** As `class_group_label_format`: «Desdoble inglés». */
export const MAX_GROUP_LABEL_LENGTH = 30;
/** As `school_class_school_year_format`: `2026/27`. */
export const SCHOOL_YEAR_PATTERN = /^\d{4}\/\d{2}$/;

/**
 * Classes, their groups and their students (5.2a, 5.2d, RF-16). A class is shared by the teachers of
 * the school: any of them creates one or joins it with a group of theirs, and its students are
 * looked after by its teachers; each group stays its teacher's. The administrator manages all.
 * Abstract class without a decorator: it is the injection token (4.2, D-005).
 *
 * A class of a past year is closed (5.2e, D-082): every write to it, its groups or its students is
 * `forbidden`, for the administrator too, until the administrator reopens it. The final evaluation
 * of its students is the exception (5.2g).
 *
 * A group without a label is the group of the whole class: it takes the students of the class when
 * it is created and when the class is enrolled. One with a label is a split, enrolled by hand.
 */
export abstract class GroupService {
  /** Those the user teaches in or created, or all for an administrator. */
  abstract listClasses(): Promise<ManagedClass[]>;

  /** Every class of the school, to join one with a subject, with its groups. */
  abstract listAllClasses(): Promise<SchoolClassEntry[]>;

  /**
   * A class (or the one with that name and year, whatever its capitals, which the user joins) with
   * a group of the teacher in each subject, all or none; it returns the class. `forbidden` for groups
   * of another teacher; `invalid` with a blank name, a year not like `2026/27`, a teacher who is not
   * an active one, a subject the class already has or more than `MAX_GROUP_BATCH`.
   */
  abstract createClass(
    draft: ClassDraft,
    subjectIds: readonly string[],
    teacherId: string,
  ): Promise<string>;

  /** Its creator or the administrator (`forbidden` otherwise); `invalid` as `createClass`, or taken. */
  abstract saveClass(classId: string, draft: ClassDraft): Promise<void>;

  /** Its creator or the administrator, while it has no groups (`invalid`). */
  abstract removeClass(classId: string): Promise<void>;

  /**
   * The administrator reopens a class of a past year, or closes it again (5.2e); `forbidden` for
   * anybody else, `not_found` for a class that does not exist.
   */
  abstract reopenClass(classId: string, reopened: boolean): Promise<void>;

  /**
   * A group in any class, as `createClass`; `invalid` for a subject the class has with the same
   * label, or a label longer than `MAX_GROUP_LABEL_LENGTH`. It returns the group.
   */
  abstract addGroup(classId: string, draft: GroupDraft): Promise<string>;

  /** Only the administrator changes the teacher; `not_found` for a group of others. */
  abstract saveGroup(groupId: string, changes: GroupChanges): Promise<void>;

  /** `invalid` if a student started anything in it; `not_found` for a group of others. */
  abstract removeGroup(groupId: string): Promise<void>;

  /**
   * The class with the name and year of `draft` (created, or joined if it exists) with a copy of each
   * group given, with its subject, label and teacher and what `options` brings, all or none; it
   * returns the class. `not_found` for a class the user does not look after or a group of others,
   * `invalid` into the same class.
   */
  abstract duplicateClass(
    classId: string,
    draft: ClassDraft,
    groupIds: readonly string[],
    options: DuplicateOptions,
  ): Promise<string>;

  /** By name; `not_found` for a class the user does not look after. */
  abstract listRoster(classId: string): Promise<RosterStudent[]>;

  /**
   * The active students of the school without a class in the year of this one, by name, with their
   * last class before that year: those a new class is chosen from. Who finished the cycle or left
   * the school in that last class is left out (5.2g). `not_found` for a class the user does not look
   * after.
   */
  abstract listCandidates(classId: string): Promise<ClassCandidate[]>;

  /**
   * The final evaluation of some students of the class, or null to take it back (5.2g, D-084): any
   * teacher of the class or the administration, also in a closed class. `MAX_OUTCOME_BATCH` at most
   * and without repeating one (`invalid`); `not_found` for a class the user does not look after or a
   * student who is not in it.
   */
  abstract setOutcomes(
    classId: string,
    userIds: readonly string[],
    outcome: ClassOutcome | null,
  ): Promise<void>;

  /**
   * The active students a pasted list names, each line an email or a whole name (without accents
   * nor capitals), with their line and their last class up to the year of the class (5.2g); a line
   * that names nobody, or more than one, is left out.
   * `invalid` with more than `MAX_PASTED_LINES`, `not_found` as `listCandidates`.
   */
  abstract matchStudents(classId: string, entries: readonly string[]): Promise<StudentMatch[]>;

  /**
   * Active students not in the class (or the group), with their last class up to its year (5.2g);
   * none with a search shorter than the minimum.
   */
  abstract searchStudents(target: EnrollTarget, search: string): Promise<ClassCandidate[]>;

  /**
   * Into the class and its groups of the whole class, those of other teachers too, all or none:
   * `MAX_ENROLLMENT_BATCH` at most, active students only (`invalid`). Who is already there is
   * skipped.
   */
  abstract enrollInClass(classId: string, userIds: readonly string[]): Promise<void>;

  /** Out of the class and all its groups; their attempts are kept. */
  abstract removeFromClass(classId: string, userId: string): Promise<void>;

  /**
   * Into one group of the user, as `enrollInClass`; `invalid` too for anybody already in it,
   * `not_found` for a group of others.
   */
  abstract enroll(groupId: string, userIds: readonly string[]): Promise<void>;

  /** Out of one group of the user; their attempts are kept. */
  abstract unenroll(groupId: string, userId: string): Promise<void>;

  /**
   * The active teachers, by name, for the administrator to choose one. A teacher reads only their
   * own account, as the RLS of `app_user` gives it.
   */
  abstract listTeachers(): Promise<UserRef[]>;
}
