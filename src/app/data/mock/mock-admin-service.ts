import { inject, Service } from '@angular/core';

import {
  MAX_DISABLE_BATCH,
  MAX_EMAIL_LENGTH,
  MAX_PASSWORD_LENGTH,
  MAX_USER_NAME_LENGTH,
  MIN_PASSWORD_LENGTH,
  normalizeEmail,
  userChangeProblem,
} from '../admin/user-rules';
import { toUserEntry } from '../admin/user-entry';
import {
  AdminService,
  type DisableResult,
  type FinishedStudent,
  type NewUser,
  type SubjectDraft,
  type UserChanges,
  type UserEntry,
} from '../admin-service';
import {
  type AiModelCheck,
  type AiProviderSetting,
  isValidAiProvider,
} from '../ai-provider-setting';
import { DataError } from '../data-error';
import type { Subject } from '../subject';
import { type AppUser, type ClassGroup, FINISHED_OUTCOMES } from '../user';
import { classOfGroup, findRow, lastClassOf, now } from './mock-access';
import { groupName } from '../group-name';
import { MockDb } from './mock-db';
import { MockNetwork } from './mock-network';

/**
 * The accounts in MockDb, with the rules of the Edge Function `admin-users` (5.1a, D-072): only the
 * administration, an email has one account, and the same limits and changes as the function. The
 * subjects and the provider with the checks of their tables, and a check of the provider where any
 * model with `fail` in its name is not found (5.3). The groups are in `MockGroupService` (5.2a).
 */
@Service({ autoProvided: false })
export class MockAdminService extends AdminService {
  private readonly db = inject(MockDb);
  private readonly network = inject(MockNetwork);

  listUsers(): Promise<UserEntry[]> {
    return this.network.request(() => {
      this.db.requireUser('admin');
      const tables = this.db.tables();
      const { users, groups, enrollments } = tables;
      const namesOf = (keep: (group: ClassGroup) => boolean) =>
        groups
          .filter(keep)
          .map((group) => groupName(classOfGroup(tables, group).name, group.label));
      return [...users]
        .sort((a, b) => a.name.localeCompare(b.name, 'es'))
        .map((user) => {
          const enrolled = new Set(
            enrollments
              .filter((enrollment) => enrollment.userId === user.id)
              .map((enrollment) => enrollment.groupId),
          );
          return toUserEntry(
            user,
            namesOf((group) => group.teacherId === user.id),
            namesOf((group) => enrolled.has(group.id)),
            tables.classMembers
              .filter((member) => member.userId === user.id)
              .map((member) => {
                const { name, schoolYear } = findRow(tables.classes, member.classId);
                return { name, schoolYear, outcome: member.outcome };
              }),
          );
        });
    });
  }

  createUser({ name, email, role, password }: NewUser): Promise<AppUser> {
    return this.network.request(() => {
      this.db.requireUser('admin');
      const address = normalizeEmail(email);
      const tables = this.db.tables();
      if (address.length > MAX_EMAIL_LENGTH || !isValidPassword(password)) {
        throw new DataError('invalid');
      }
      if (tables.users.some((user) => user.email === address)) {
        throw new DataError('invalid', 'The email already has an account');
      }
      const createdAt = now();
      const user: AppUser = {
        id: crypto.randomUUID(),
        name: validName(name),
        email: address,
        role,
        status: 'active',
        privacyNoticeSeenAt: null,
        createdAt,
        updatedAt: createdAt,
      };
      this.db.update('users', (rows) => [...rows, user]);
      this.db.update('passwords', (passwords) => ({ ...passwords, [user.id]: password }));
      return user;
    });
  }

  updateUser(userId: string, changes: UserChanges): Promise<AppUser> {
    return this.network.request(() =>
      this.applyChanges(this.db.requireUser('admin'), userId, changes),
    );
  }

  listFinishedStudents(): Promise<FinishedStudent[]> {
    return this.network.request(() => {
      this.db.requireUser('admin');
      const tables = this.db.tables();
      return tables.users
        .filter(({ role, status }) => role === 'student' && status === 'active')
        .sort((a, b) => a.name.localeCompare(b.name, 'es'))
        .flatMap(({ id, name, email }) => {
          const last = lastClassOf(tables, id);
          return last?.outcome && FINISHED_OUTCOMES.includes(last.outcome)
            ? [
                {
                  student: { id, name, email },
                  outcome: last.outcome,
                  className: last.schoolClass.name,
                  schoolYear: last.schoolClass.schoolYear,
                },
              ]
            : [];
        });
    });
  }

  /** One by one, as the function: those that cannot be disabled are left out. */
  disableUsers(userIds: readonly string[]): Promise<DisableResult> {
    return this.network.request(() => {
      const caller = this.db.requireUser('admin');
      if (
        userIds.length === 0 ||
        userIds.length > MAX_DISABLE_BATCH ||
        new Set(userIds).size !== userIds.length
      ) {
        throw new DataError('invalid', 'Between 1 and 100 different accounts');
      }
      const disabled: string[] = [];
      const failed: string[] = [];
      for (const userId of userIds) {
        try {
          this.applyChanges(caller, userId, { status: 'disabled' });
          disabled.push(userId);
        } catch {
          failed.push(userId);
        }
      }
      return { disabled, failed };
    });
  }

  listSubjects(): Promise<Subject[]> {
    return this.network.request(() => {
      this.db.requireUser('admin');
      return [...this.db.tables().subjects].sort((a, b) => a.name.localeCompare(b.name, 'es'));
    });
  }

  saveSubject({ id, ...draft }: SubjectDraft): Promise<Subject> {
    return this.network.request(() => {
      this.db.requireUser('admin');
      const subject: Subject = { ...validSubject(draft), id: id ?? crypto.randomUUID() };
      if (id === undefined) {
        this.db.update('subjects', (rows) => [...rows, subject]);
      } else {
        findRow(this.db.tables().subjects, id);
        this.db.update('subjects', (rows) => rows.map((row) => (row.id === id ? subject : row)));
      }
      return subject;
    });
  }

  getAiProvider(): Promise<AiProviderSetting | null> {
    return this.network.request(() => {
      this.db.requireUser('admin');
      return this.db.tables().aiProvider;
    });
  }

  setAiProvider(setting: AiProviderSetting): Promise<void> {
    return this.network.request(() => {
      this.db.requireUser('admin');
      if (!isValidAiProvider(setting)) throw new DataError('invalid');
      this.db.update('aiProvider', () => setting);
    });
  }

  checkAiProvider(setting: AiProviderSetting): Promise<AiModelCheck[]> {
    return this.network.request(() => {
      this.db.requireUser('admin');
      if (!isValidAiProvider(setting)) return [{ model: setting.model, problem: 'invalid' }];
      const seen = new Set<string>();
      return [setting, ...(setting.fallbacks ?? [])].map((entry): AiModelCheck => {
        const { baseUrl = setting.baseUrl, model } =
          typeof entry === 'string' ? { model: entry } : entry;
        // As the Edge Function: a repeated model is not called twice, and says so in its place
        const key = `${baseUrl} ${model}`;
        if (seen.has(key)) return { model, problem: 'invalid' };
        seen.add(key);
        return model.includes(FAILING_MODEL)
          ? { model, problem: 'not_found' }
          : { model, ms: MOCK_CHECK_MS };
      });
    });
  }

  /** What `updateUser()` does, in the request of its caller. */
  private applyChanges(caller: AppUser, userId: string, changes: UserChanges): AppUser {
    const tables = this.db.tables();
    const target = findRow(tables.users, userId);
    const { password, ...profile } = changes;
    if (password !== undefined && !isValidPassword(password)) throw new DataError('invalid');
    const links = {
      groups: tables.groups.filter((group) => group.teacherId === userId).length,
      enrollments: tables.enrollments.filter((enrollment) => enrollment.userId === userId).length,
    };
    const problem = userChangeProblem(caller.id, target, profile, links);
    if (problem) throw new DataError('invalid', `The change is not allowed: ${problem}`);

    const updated: AppUser = {
      ...target,
      ...profile,
      name: profile.name === undefined ? target.name : validName(profile.name),
      updatedAt: now(),
    };
    this.db.update('users', (rows) => rows.map((row) => (row.id === userId ? updated : row)));
    if (password !== undefined) {
      this.db.update('passwords', (passwords) => ({ ...passwords, [userId]: password }));
    }
    return updated;
  }
}

/** A model whose name has it is not found by the check of the provider, to see and test the failure. */
const FAILING_MODEL = 'fail';

/** What a model of the demo takes to answer the check. */
const MOCK_CHECK_MS = 420;

/** The subject trimmed, with the check of its table (`is_valid_text_translations`), or `invalid`. */
function validSubject(draft: Omit<Subject, 'id'>): Omit<Subject, 'id'> {
  const name = draft.name.trim();
  const translations = Object.entries(draft.translations);
  if (
    !name ||
    translations.some(([locale, text]) => locale === draft.sourceLocale || !text.name.trim())
  ) {
    throw new DataError('invalid', 'A subject needs a name in every language it has');
  }
  return { ...draft, name };
}

function isValidPassword(password: string): boolean {
  return password.length >= MIN_PASSWORD_LENGTH && password.length <= MAX_PASSWORD_LENGTH;
}

/** The name trimmed, as the database keeps it, or `invalid`. */
function validName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed || trimmed.length > MAX_USER_NAME_LENGTH) throw new DataError('invalid');
  return trimmed;
}
