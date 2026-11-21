import type { UserLinks } from './admin/user-rules';
import type { AiModelCheck, AiProviderSetting } from './ai-provider-setting';
import type { Subject } from './subject';
import type { PreviousClass, UserRef } from './group-service';
import type { AppUser, ClassOutcome, Role, UserStatus } from './user';

export interface NewUser {
  readonly name: string;
  readonly email: string;
  readonly role: Role;
  /** Set by the administration and handed over in person: the app sends no email (D-072). */
  readonly password: string;
}

/** A student of a list from secretaría (5.2h), with the password generated for them. */
export type NewStudent = Omit<NewUser, 'role'>;

/** What `createStudents()` did with each one. */
export interface CreateStudentsResult {
  /** The new accounts, in the order of the list. */
  readonly created: readonly AppUser[];
  /** The emails, normalized, that already had an account: nothing was done with them. */
  readonly existing: readonly string[];
  /** The emails whose account could not be created: none is left halfway. */
  readonly failed: readonly string[];
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
  /** The classes they were a student of, the latest first, with their evaluation (5.2g). */
  readonly classes: readonly PreviousClass[];
}

/**
 * An active student whose last class says that they finished the cycle or left the school (5.2g):
 * the administration still has to disable their account.
 */
export interface FinishedStudent {
  readonly student: UserRef;
  /** One of `FINISHED_OUTCOMES`. */
  readonly outcome: ClassOutcome;
  /** That last class: «2.º DAW A», `2025/26`. */
  readonly className: string;
  readonly schoolYear: string;
}

/** What `disableUsers()` did with each account. */
export interface DisableResult {
  readonly disabled: readonly string[];
  /** Those that do not exist, that the rules forbid (the administration itself) or that failed. */
  readonly failed: readonly string[];
}

/** A new subject has no id yet; an existing one keeps it. */
export type SubjectDraft = Omit<Subject, 'id'> & { readonly id?: string };

/**
 * Users, subjects and system settings: administrators only; the groups are in `GroupService`
 * (5.2a). Abstract class without a decorator: it is the injection token (4.2, D-005).
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
   * Creates the accounts of several students at once (5.2h), each as `createUser()` with the role of
   * a student; an email with an account is skipped and said. `MAX_CREATE_BATCH` at most, without
   * repeating an email and each valid, or nothing is created (`invalid`).
   */
  abstract createStudents(students: readonly NewStudent[]): Promise<CreateStudentsResult>;

  /**
   * Throws `invalid` with any `UserChangeProblem` (`admin/user-rules.ts`) and `not_found` without
   * the user.
   */
  abstract updateUser(userId: string, changes: UserChanges): Promise<AppUser>;

  /** By name: the accounts left to disable after the final evaluation (5.2g). */
  abstract listFinishedStudents(): Promise<FinishedStudent[]>;

  /**
   * Disables several accounts at once, each as `updateUser()` with `status: 'disabled'`, and says
   * which. `MAX_DISABLE_BATCH` at most and without repeating one (`invalid`).
   */
  abstract disableUsers(userIds: readonly string[]): Promise<DisableResult>;

  /** The subjects of the groups (2.5c), by name, in their source language and translated. */
  abstract listSubjects(): Promise<Subject[]>;

  /**
   * Creates the subject, or edits the one of its id (`not_found` without it). Throws `invalid` with
   * a blank name or translation, or a translation to its own language.
   */
  abstract saveSubject(subject: SubjectDraft): Promise<Subject>;

  /** Row `ai_provider` of `app_setting`, or null while none is saved (only the seed writes one). */
  abstract getAiProvider(): Promise<AiProviderSetting | null>;

  /** Throws `invalid` without the shape of a provider (`isValidAiProvider`). */
  abstract setAiProvider(setting: AiProviderSetting): Promise<void>;

  /**
   * Asks each model of the setting, saved or not, for a minimal answer, in order (5.3): one result per
   * model, or a single one with `invalid` or `host_not_allowed` for the main one. Saves nothing.
   */
  abstract checkAiProvider(setting: AiProviderSetting): Promise<AiModelCheck[]>;
}
