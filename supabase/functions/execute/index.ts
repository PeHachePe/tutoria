import { createClient } from '@supabase/supabase-js';

import type { Database } from '../../../src/app/data/supabase/database.types.ts';
import { createExecuteHandler } from './execute.ts';
import { QuickJsSandbox } from '../_shared/quickjs-sandbox.ts';
import { SupabaseRunStore } from './supabase-run-store.ts';

// Supabase gives every function its URL and the `service_role` key, which never leaves the server
const admin = createClient<Database>(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  { auth: { persistSession: false, autoRefreshToken: false } },
);

// Another engine (Judge0, for another language) is another CodeSandbox here (D-042)
Deno.serve(
  createExecuteHandler({ store: new SupabaseRunStore(admin), sandbox: new QuickJsSandbox() }),
);
