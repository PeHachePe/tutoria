import { createClient } from '@supabase/supabase-js';

import type { Database } from '../../../src/app/data/supabase/database.types.ts';
import { QuickJsSandbox } from '../_shared/quickjs-sandbox.ts';
import type { ModelEndpoint } from './answer-store.ts';
import { FallbackProvider, OpenAICompatibleProvider } from './llm-provider.ts';
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
    // The main model and its fallbacks in order, each with the key of its own secret (D-044): in
    // local, supabase/functions/.env; a local Ollama needs none
    providerFor: ({ models: [first, ...rest] }) => {
      const providerOf = ({ keySecret, ...endpoint }: ModelEndpoint) =>
        new OpenAICompatibleProvider({
          ...endpoint,
          apiKey: (keySecret && Deno.env.get(keySecret)) || undefined,
        });
      return rest.length > 0
        ? new FallbackProvider([providerOf(first), ...rest.map(providerOf)])
        : providerOf(first);
    },
    // The same sandbox as `execute`: the student's code never runs outside it (D-042)
    sandbox: new QuickJsSandbox(),
  }),
);
