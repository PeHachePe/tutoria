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

/** Table `class_group`. */
export interface ClassGroup {
  readonly id: string;
  readonly name: string;
  /** For example, `2026/27`. */
  readonly schoolYear: string;
  readonly teacherId: string;
}

/** Table `enrollment`: one row per student and group. */
export interface Enrollment {
  readonly id: string;
  readonly groupId: string;
  readonly userId: string;
}
