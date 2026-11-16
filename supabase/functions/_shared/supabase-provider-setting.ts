import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '../../../src/app/data/supabase/database.types.ts';
import {
  ALLOWED_HOSTS_SECRET,
  allowedHosts,
  type ProviderSetting,
  providerSettingOf,
} from './provider-setting.ts';

/** The row of `app_setting` with the active provider (2.3). */
const AI_PROVIDER_KEY = 'ai_provider';

/**
 * The models the administrator chose, with `service_role`, or `null` if none is valid (D-044). Only
 * those of the hosts the functions may call: the provider of the project and the ones of the secret
 * `AI_ALLOWED_HOSTS` (D-063).
 */
export async function readProviderSetting(
  admin: SupabaseClient<Database>,
): Promise<ProviderSetting | null> {
  const { data, error } = await admin
    .from('app_setting')
    .select('value')
    .eq('key', AI_PROVIDER_KEY)
    .maybeSingle();
  if (error) throw new Error(`Reading the AI provider failed: ${error.message}`);
  return providerSettingOf(data?.value, allowedHosts(Deno.env.get(ALLOWED_HOSTS_SECRET)));
}
