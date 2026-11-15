import { createClient } from '@supabase/supabase-js';

import type { Database } from '../../../src/app/data/supabase/database.types.ts';
import { providerForSetting } from '../_shared/llm-provider.ts';
import { SupabaseStaffRequests } from '../_shared/supabase-staff-requests.ts';
import { SupabaseTranslateStore } from './supabase-translate-store.ts';
import { createTranslateHandler } from './translate.ts';

// Supabase gives every function its URL and the `service_role` key, which never leaves the server
const admin = createClient<Database>(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  { auth: { persistSession: false, autoRefreshToken: false } },
);

Deno.serve(
  createTranslateHandler({
    store: new SupabaseTranslateStore(admin),
    staff: new SupabaseStaffRequests(admin),
    // The same models as the tutor, each with the key of its own secret (D-044)
    providerFor: (setting) => providerForSetting(setting, (name) => Deno.env.get(name)),
  }),
);
