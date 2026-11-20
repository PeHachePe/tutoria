export type Role = 'student' | 'teacher' | 'admin';

export type UserStatus = 'active' | 'disabled';

/** Table `app_user`: its id is the Supabase Auth user id. */
export interface AppUser {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly role: Role;
  readonly status: UserStatus;
  /** When the student accepted the notice on the registered data (RF-07), or null before. */
  readonly privacyNoticeSeenAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * Table `school_class` (5.2d, D-081): a class of the school («1.º DAW A · 2026/27»), once, shared
 * by the teachers who teach a subject in it.
 */
export interface SchoolClass {
  readonly id: string;
  readonly name: string;
  /** For example, `2026/27`. */
  readonly schoolYear: string;
  /** Who may rename or delete it, besides the administration; null once their account is gone. */
  readonly createdBy: string | null;
  readonly createdAt: string;
}

/** Table `class_member`: the students of a class, whom its groups take when created. */
export interface ClassMember {
  readonly classId: string;
  readonly userId: string;
}

/** Table `class_group`: a subject of a class, taught by one teacher. */
export interface ClassGroup {
  readonly id: string;
  readonly classId: string;
  /** What tells a split («desdoble») apart: «Desdoble inglés». Null for the group of the whole class. */
  readonly label: string | null;
  readonly teacherId: string;
  /** What the group studies (2.5c). */
  readonly subjectId: string;
}

/** Table `enrollment`: one row per student and group. */
export interface Enrollment {
  readonly id: string;
  readonly groupId: string;
  readonly userId: string;
}
