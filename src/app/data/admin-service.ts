import type { AiProviderSetting } from './ai-provider-setting';
import type { Subject } from './subject';
import type { AppUser, ClassGroup, Enrollment, Role, UserStatus } from './user';

export interface NewUser {
  readonly name: string;
  readonly email: string;
  readonly role: Role;
}

export interface UserChanges {
  readonly name?: string;
  readonly role?: Role;
  readonly status?: UserStatus;
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
  abstract listUsers(): Promise<AppUser[]>;

  /** Creates the account: public sign-up is disabled (2.3). */
  abstract createUser(user: NewUser): Promise<AppUser>;

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
