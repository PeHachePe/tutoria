import { createClient } from '@supabase/supabase-js';

import type { Database } from '../../../src/app/data/supabase/database.types.ts';
import { createAdminUsersHandler } from './admin-users.ts';
import { SupabaseAdminUsersStore } from './supabase-admin-users-store.ts';

// Supabase gives every function its URL and the `service_role` key, which never leaves the server
const admin = createClient<Database>(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  { auth: { persistSession: false, autoRefreshToken: false } },
);

Deno.serve(createAdminUsersHandler({ store: new SupabaseAdminUsersStore(admin) }));
