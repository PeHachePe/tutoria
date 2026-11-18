import { inject, Service } from '@angular/core';

import {
  MAX_EMAIL_LENGTH,
  MAX_PASSWORD_LENGTH,
  MAX_USER_NAME_LENGTH,
  MIN_PASSWORD_LENGTH,
  normalizeEmail,
  userChangeProblem,
} from '../admin/user-rules';
import { AdminService, type NewUser, type UserChanges } from '../admin-service';
import type { AiProviderSetting } from '../ai-provider-setting';
import { DataError } from '../data-error';
import type { Subject } from '../subject';
import type { AppUser, ClassGroup, Enrollment } from '../user';
import { findRow, now } from './mock-access';
import { MockDb } from './mock-db';
import { MockNetwork } from './mock-network';

/**
 * The accounts in MockDb, with the rules of the Edge Function `admin-users` (5.1a, D-072): only the
 * administration, an email has one account, and the same limits and changes as the function. The
 * groups, the subjects and the provider arrive in 5.2a and 5.3.
 */
@Service({ autoProvided: false })
export class MockAdminService extends AdminService {
  private readonly db = inject(MockDb);
  private readonly network = inject(MockNetwork);

  listUsers(): Promise<AppUser[]> {
    return this.network.request(() => {
      this.db.requireUser('admin');
      return [...this.db.tables().users].sort((a, b) => a.name.localeCompare(b.name, 'es'));
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
    return this.network.request(() => {
      const caller = this.db.requireUser('admin');
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
    });
  }

  listSubjects(): Promise<Subject[]> {
    return unavailable();
  }

  saveSubject(): Promise<Subject> {
    return unavailable();
  }

  listGroups(): Promise<ClassGroup[]> {
    return unavailable();
  }

  saveGroup(): Promise<ClassGroup> {
    return unavailable();
  }

  listEnrollments(): Promise<Enrollment[]> {
    return unavailable();
  }

  enroll(): Promise<Enrollment> {
    return unavailable();
  }

  unenroll(): Promise<void> {
    return unavailable();
  }

  getAiProvider(): Promise<AiProviderSetting> {
    return unavailable();
  }

  setAiProvider(): Promise<void> {
    return unavailable();
  }
}

/** What arrives in 5.2a and 5.3. */
function unavailable(): Promise<never> {
  return Promise.reject(new DataError('unavailable'));
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
