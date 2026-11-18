import type { UserLinks } from './admin/user-rules';
import type { AiProviderSetting } from './ai-provider-setting';
import type { Subject } from './subject';
import type { AppUser, ClassGroup, Enrollment, Role, UserStatus } from './user';

export interface NewUser {
  readonly name: string;
  readonly email: string;
  readonly role: Role;
  /** Set by the administration and handed over in person: the app sends no email (D-072). */
  readonly password: string;
}

export interface UserChanges {
  readonly name?: string;
  readonly role?: Role;
  readonly status?: UserStatus;
  /** The new password, when the administration resets it. */
  readonly password?: string;
}

/** An account as the administration lists it (5.1b): with what ties it to the classes. */
export interface UserEntry {
  readonly user: AppUser;
  /** The groups they teach or are enrolled in, by name and without repeating one. */
  readonly groupNames: readonly string[];
  /** While there are any, the role does not change (D-072). */
  readonly links: UserLinks;
}

/** A new group has no id yet; an existing one keeps it. */
export type GroupDraft = Omit<ClassGroup, 'id'> & { readonly id?: string };

/** A new subject has no id yet; an existing one keeps it. */
export type SubjectDraft = Omit<Subject, 'id'> & { readonly id?: string };

/**
 * Users, groups, enrollment and system settings: administrators only. Abstract class without a decorator:
 * it is the injection token (4.2, D-005). Refined in phase 5.
 */
export abstract class AdminService {
  /** Every account, by name, with its groups. */
  abstract listUsers(): Promise<UserEntry[]>;

  /**
   * Creates the account: public sign-up is disabled (2.3). Throws `invalid` with an email that
   * already has an account (CU-06, 3a).
   */
  abstract createUser(user: NewUser): Promise<AppUser>;

  /**
   * Throws `invalid` with any `UserChangeProblem` (`admin/user-rules.ts`) and `not_found` without
   * the user.
   */
  abstract updateUser(userId: string, changes: UserChanges): Promise<AppUser>;

  /** The subjects of the groups (2.5c), in their source language and translated. */
  abstract listSubjects(): Promise<Subject[]>;

  abstract saveSubject(subject: SubjectDraft): Promise<Subject>;

  abstract listGroups(): Promise<ClassGroup[]>;

  abstract saveGroup(group: GroupDraft): Promise<ClassGroup>;

  abstract listEnrollments(groupId: string): Promise<Enrollment[]>;

  abstract enroll(groupId: string, userId: string): Promise<Enrollment>;

  abstract unenroll(enrollmentId: string): Promise<void>;

  abstract getAiProvider(): Promise<AiProviderSetting>;

  abstract setAiProvider(setting: AiProviderSetting): Promise<void>;
}
