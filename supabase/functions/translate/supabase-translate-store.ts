import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '../../../src/app/data/supabase/database.types.ts';
import type { ProviderSetting } from '../_shared/provider-setting.ts';
import { readProviderSetting } from '../_shared/supabase-provider-setting.ts';
import type { TranslateStore } from './translate.ts';

/** The session and the setting of the provider, with `service_role`. */
export class SupabaseTranslateStore implements TranslateStore {
  constructor(private readonly admin: SupabaseClient<Database>) {}

  async userOf(token: string): Promise<string | null> {
    const { data, error } = await this.admin.auth.getUser(token);
    return error ? null : data.user.id;
  }

  providerSetting(): Promise<ProviderSetting | null> {
    return readProviderSetting(this.admin);
  }
}
