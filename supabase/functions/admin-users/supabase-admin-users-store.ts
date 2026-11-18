import type { SupabaseClient } from '@supabase/supabase-js';

import type { UserLinks } from '../../../src/app/data/admin/user-rules.ts';
import type { Database } from '../../../src/app/data/supabase/database.types.ts';
import {
  type AdminUsersStore,
  EMAIL_EXISTS,
  PasswordRejectedError,
  type ProfileChanges,
  type UserRow,
} from './admin-users.ts';

/** A ban of a hundred years: Auth has no ban without an end (D-072). */
export const BAN_FOREVER = '876000h';
const NO_BAN = 'none';

/** The accounts in Supabase Auth and their row of `app_user`, with `service_role`. */
export class SupabaseAdminUsersStore implements AdminUsersStore {
  constructor(private readonly admin: SupabaseClient<Database>) {}

  async userOf(token: string): Promise<string | null> {
    const { data, error } = await this.admin.auth.getUser(token);
    return error ? null : data.user.id;
  }

  async profileOf(userId: string): Promise<UserRow | null> {
    const { data, error } = await this.admin
      .from('app_user')
      .select()
      .eq('id', userId)
      .maybeSingle();
    if (error) throw new Error(`Reading the user failed: ${error.message}`);
    return data;
  }

  async linksOf(userId: string): Promise<UserLinks> {
    const [groups, enrollments] = await Promise.all([
      this.admin
        .from('class_group')
        .select('id', { count: 'exact', head: true })
        .eq('teacher_id', userId),
      this.admin
        .from('enrollment')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId),
    ]);
    const error = groups.error ?? enrollments.error;
    if (error) throw new Error(`Counting the links of the user failed: ${error.message}`);
    return { groups: groups.count ?? 0, enrollments: enrollments.count ?? 0 };
  }

  async createAccount(account: { email: string; password: string; name: string }) {
    const { data, error } = await this.admin.auth.admin.createUser({
      email: account.email,
      password: account.password,
      email_confirm: true,
      user_metadata: { name: account.name },
    });
    if (error?.code === EMAIL_EXISTS) return EMAIL_EXISTS;
    // The message of Auth never carries the password
    if (error) {
      throw passwordError(error) ?? new Error(`Creating the account failed: ${error.message}`);
    }
    return data.user.id;
  }

  async deleteAccount(userId: string): Promise<void> {
    const { error } = await this.admin.auth.admin.deleteUser(userId);
    if (error) throw new Error(`Deleting the account failed: ${error.message}`);
  }

  async updateProfile(userId: string, changes: ProfileChanges): Promise<UserRow> {
    const { data, error } = await this.admin
      .from('app_user')
      .update(changes)
      .eq('id', userId)
      .select()
      .single();
    if (error) throw new Error(`Updating the user failed: ${error.message}`);
    return data;
  }

  async setBan(userId: string, banned: boolean): Promise<void> {
    const { error } = await this.admin.auth.admin.updateUserById(userId, {
      ban_duration: banned ? BAN_FOREVER : NO_BAN,
    });
    if (error) throw new Error(`Changing the ban failed: ${error.message}`);
  }

  async setPassword(userId: string, password: string): Promise<void> {
    const { error } = await this.admin.auth.admin.updateUserById(userId, { password });
    if (error) {
      throw passwordError(error) ?? new Error(`Changing the password failed: ${error.message}`);
    }
  }
}

/**
 * The error of a password Auth turned down: too short for `minimum_password_length` (`weak_password`)
 * or past 72 bytes (`validation_failed`, which also covers other fields, so by its message).
 */
function passwordError(error: { code?: string; message: string }): PasswordRejectedError | null {
  const rejected =
    error.code === 'weak_password' ||
    (error.code === 'validation_failed' && /password/i.test(error.message));
  return rejected ? new PasswordRejectedError(error.message) : null;
}
