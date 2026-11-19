import { inject, Service } from '@angular/core';

import { toUserEntry } from '../admin/user-entry';
import {
  AdminService,
  type NewUser,
  type SubjectDraft,
  type UserChanges,
  type UserEntry,
} from '../admin-service';
import type { AiModelCheck, AiProviderSetting } from '../ai-provider-setting';
import { DataError } from '../data-error';
import type { Subject } from '../subject';
import type { AppUser } from '../user';
import { SUPABASE_CLIENT } from './supabase-client';
import { check, toFunctionDataError, unwrap } from './supabase-error';
import type { Json } from './database.types';
import { type Row, toAppUser, toSubject } from './supabase-rows';

/** The Edge Function of the accounts (`supabase/functions/admin-users`). */
export const ADMIN_USERS_FUNCTION = 'admin-users';

/** The Edge Function that checks a setting of the AI provider (`supabase/functions/ai-check`). */
export const AI_CHECK_FUNCTION = 'ai-check';

/** The row of `app_setting` with the active provider (2.3). */
export const AI_PROVIDER_KEY = 'ai_provider';

/**
 * The administration in Supabase (5.1a, D-072). The list of accounts is read from `app_user`, which
 * the RLS gives whole to the administration; the accounts are created and changed by the Edge
 * Function `admin-users`, the only one with the API of administration of Auth. Its 409 (an email
 * with an account, a change the rules forbid) arrives as `invalid`. The subjects and the setting of
 * the provider are tables the RLS opens to the administration, whose checks give `invalid` (23514);
 * the Edge Function `ai-check` tries a setting (5.3a). The groups are in `SupabaseGroupService`.
 */
@Service({ autoProvided: false })
export class SupabaseAdminService extends AdminService {
  private readonly supabase = inject(SUPABASE_CLIENT);

  /**
   * One query, with the groups embedded. Those taught go by their own key: through `enrollment`,
   * `app_user` also reaches `class_group`, and PostgREST would not know which way to go.
   */
  async listUsers(): Promise<UserEntry[]> {
    const rows = unwrap(
      await this.supabase
        .from('app_user')
        .select(
          '*, taught:class_group!class_group_teacher_id_fkey(name), enrollment(class_group(name))',
        ),
    );
    return rows
      .map(({ taught, enrollment, ...user }) =>
        toUserEntry(
          toAppUser(user),
          taught.map((group) => group.name),
          enrollment.map((row) => row.class_group.name),
        ),
      )
      .sort((a, b) => a.user.name.localeCompare(b.user.name, 'es'));
  }

  createUser(user: NewUser): Promise<AppUser> {
    return this.callFunction({ action: 'create', ...user });
  }

  updateUser(userId: string, changes: UserChanges): Promise<AppUser> {
    return this.callFunction({ action: 'update', userId, changes });
  }

  /** Sorted here as the mock data does: the collation of the database may not be Spanish. */
  async listSubjects(): Promise<Subject[]> {
    return unwrap(await this.supabase.from('subject').select())
      .map(toSubject)
      .sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }

  async saveSubject({ id, name, sourceLocale, translations }: SubjectDraft): Promise<Subject> {
    const row = {
      name: name.trim(),
      source_locale: sourceLocale,
      translations: translations as Record<string, Json>,
    };
    const query =
      id === undefined
        ? this.supabase.from('subject').insert(row)
        : this.supabase.from('subject').update(row).eq('id', id);
    return toSubject(unwrap(await query.select().single()));
  }

  async getAiProvider(): Promise<AiProviderSetting> {
    const row = unwrap(
      await this.supabase.from('app_setting').select('value').eq('key', AI_PROVIDER_KEY).single(),
    );
    // The check of the table gives it this shape (is_valid_ai_provider)
    return row.value as unknown as AiProviderSetting;
  }

  async setAiProvider(setting: AiProviderSetting): Promise<void> {
    check(
      await this.supabase
        .from('app_setting')
        .upsert({ key: AI_PROVIDER_KEY, value: setting as unknown as NonNullable<Json> }),
    );
  }

  async checkAiProvider(setting: AiProviderSetting): Promise<AiModelCheck[]> {
    const { data, error } = await this.supabase.functions.invoke<AiModelCheck[]>(
      AI_CHECK_FUNCTION,
      { body: setting },
    );
    if (error) throw toFunctionDataError(error);
    if (!data) throw new DataError('unknown', 'The check came back empty');
    return data;
  }

  private async callFunction(body: object): Promise<AppUser> {
    const { data, error } = await this.supabase.functions.invoke<Row<'app_user'>>(
      ADMIN_USERS_FUNCTION,
      { body },
    );
    if (error) throw toFunctionDataError(error);
    if (!data) throw new DataError('unknown', 'The user came back empty');
    return toAppUser(data);
  }
}
