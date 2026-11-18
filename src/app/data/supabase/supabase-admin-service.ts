import { inject, Service } from '@angular/core';

import { AdminService, type NewUser, type UserChanges } from '../admin-service';
import type { AiProviderSetting } from '../ai-provider-setting';
import { DataError } from '../data-error';
import type { Subject } from '../subject';
import type { AppUser, ClassGroup, Enrollment } from '../user';
import { SUPABASE_CLIENT } from './supabase-client';
import { toFunctionDataError, unwrap } from './supabase-error';
import { type Row, toAppUser } from './supabase-rows';

/** The Edge Function of the accounts (`supabase/functions/admin-users`). */
export const ADMIN_USERS_FUNCTION = 'admin-users';

/**
 * The administration in Supabase (5.1a, D-072). The list of accounts is read from `app_user`, which
 * the RLS gives whole to the administration; the accounts are created and changed by the Edge
 * Function `admin-users`, the only one with the API of administration of Auth. Its 409 (an email
 * with an account, a change the rules forbid) arrives as `invalid`. The groups, the subjects and the
 * provider arrive in 5.2a and 5.3.
 */
@Service({ autoProvided: false })
export class SupabaseAdminService extends AdminService {
  private readonly supabase = inject(SUPABASE_CLIENT);

  async listUsers(): Promise<AppUser[]> {
    const rows = unwrap(await this.supabase.from('app_user').select());
    return rows.map(toAppUser).sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }

  createUser(user: NewUser): Promise<AppUser> {
    return this.callFunction({ action: 'create', ...user });
  }

  updateUser(userId: string, changes: UserChanges): Promise<AppUser> {
    return this.callFunction({ action: 'update', userId, changes });
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

/** What arrives in 5.2a and 5.3. */
function unavailable(): Promise<never> {
  return Promise.reject(new DataError('unavailable'));
}
