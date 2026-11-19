import { createClient } from '@supabase/supabase-js';

import type { Database } from '../../../src/app/data/supabase/database.types.ts';
import { OpenAICompatibleProvider } from '../_shared/llm-provider.ts';
import { ALLOWED_HOSTS_SECRET, allowedHosts } from '../_shared/provider-setting.ts';
import { SupabaseStaffRequests } from '../_shared/supabase-staff-requests.ts';
import { createAiCheckHandler } from './ai-check.ts';
import { SupabaseAiCheckStore } from './supabase-ai-check-store.ts';

// Supabase gives every function its URL and the `service_role` key, which never leaves the server
const admin = createClient<Database>(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  { auth: { persistSession: false, autoRefreshToken: false } },
);

Deno.serve(
  createAiCheckHandler({
    store: new SupabaseAiCheckStore(admin),
    staff: new SupabaseStaffRequests(admin),
    mayCall: allowedHosts(Deno.env.get(ALLOWED_HOSTS_SECRET)),
    secretOf: (name) => Deno.env.get(name),
    // One model alone: no chain of fallbacks, so each one answers for itself
    providerOf: ({ keySecret: _, ...endpoint }, apiKey) =>
      new OpenAICompatibleProvider({ ...endpoint, apiKey }),
  }),
);
