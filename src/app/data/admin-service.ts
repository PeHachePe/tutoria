import type { UserLinks } from './admin/user-rules';
import type { AiModelCheck, AiProviderSetting } from './ai-provider-setting';
import type { Subject } from './subject';
import type { AppUser, Role, UserStatus } from './user';

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
   * Throws `invalid` with any `UserChangeProblem` (`admin/user-rules.ts`) and `not_found` without
   * the user.
   */
  abstract updateUser(userId: string, changes: UserChanges): Promise<AppUser>;

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
