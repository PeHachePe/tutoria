import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '../../../src/app/data/supabase/database.types.ts';
import { type ProviderSetting, providerSettingOf } from './provider-setting.ts';

/** The row of `app_setting` with the active provider (2.3). */
const AI_PROVIDER_KEY = 'ai_provider';

/** The models the administrator chose, with `service_role`, or `null` if none is valid (D-044). */
export async function readProviderSetting(
  admin: SupabaseClient<Database>,
): Promise<ProviderSetting | null> {
  const { data, error } = await admin
    .from('app_setting')
    .select('value')
    .eq('key', AI_PROVIDER_KEY)
    .maybeSingle();
  if (error) throw new Error(`Reading the AI provider failed: ${error.message}`);
  return providerSettingOf(data?.value);
}
