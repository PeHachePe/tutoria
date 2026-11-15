import { createClient } from '@supabase/supabase-js';

import type { Database } from '../../../src/app/data/supabase/database.types.ts';
import { QuickJsSandbox } from '../_shared/quickjs-sandbox.ts';
import { SupabaseStaffRequests } from '../_shared/supabase-staff-requests.ts';
import { providerForSetting } from '../_shared/llm-provider.ts';
import { SupabaseAnswerStore } from './supabase-answer-store.ts';
import { createTutorHandler } from './tutor.ts';

// Supabase gives every function its URL and the `service_role` key, which never leaves the server
const admin = createClient<Database>(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  { auth: { persistSession: false, autoRefreshToken: false } },
);

Deno.serve(
  createTutorHandler({
    store: new SupabaseAnswerStore(admin),
    // The teachers who try an exercise as a student count apart (4.3e, D-061)
    staff: new SupabaseStaffRequests(admin),
    // The main model and its fallbacks in order, each with the key of its own secret (D-044)
    providerFor: (setting) => providerForSetting(setting, (name) => Deno.env.get(name)),
    // The same sandbox as `execute`: the student's code never runs outside it (D-042)
    sandbox: new QuickJsSandbox(),
  }),
);
