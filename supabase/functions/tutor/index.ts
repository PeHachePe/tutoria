import { createClient } from '@supabase/supabase-js';

import type { Database } from '../../../src/app/data/supabase/database.types.ts';
import { QuickJsSandbox } from '../_shared/quickjs-sandbox.ts';
import { OpenAICompatibleProvider } from './llm-provider.ts';
import { SupabaseAnswerStore } from './supabase-answer-store.ts';
import { createTutorHandler } from './tutor.ts';

// Supabase gives every function its URL and the `service_role` key, which never leaves the server
const admin = createClient<Database>(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  { auth: { persistSession: false, autoRefreshToken: false } },
);

// The key of the provider is a secret (in local, supabase/functions/.env); a local Ollama needs none
const apiKey = Deno.env.get('AI_API_KEY') || undefined;

Deno.serve(
  createTutorHandler({
    store: new SupabaseAnswerStore(admin),
    providerFor: (setting) => new OpenAICompatibleProvider({ ...setting, apiKey }),
    // The same sandbox as `execute`: the student's code never runs outside it (D-042)
    sandbox: new QuickJsSandbox(),
  }),
);
