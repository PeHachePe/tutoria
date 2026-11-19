import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '../../../src/app/data/supabase/database.types.ts';
import type { AiCheckStore } from './ai-check.ts';

/** The session and the role of the caller, with `service_role`. */
export class SupabaseAiCheckStore implements AiCheckStore {
  constructor(private readonly admin: SupabaseClient<Database>) {}

  async userOf(token: string): Promise<string | null> {
    const { data, error } = await this.admin.auth.getUser(token);
    return error ? null : data.user.id;
  }

  async isActiveAdmin(userId: string): Promise<boolean> {
    const { data, error } = await this.admin
      .from('app_user')
      .select('role, status')
      .eq('id', userId)
      .maybeSingle();
    if (error) throw new Error(`Reading the user failed: ${error.message}`);
    return data?.role === 'admin' && data.status === 'active';
  }
}
