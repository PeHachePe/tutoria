import { InjectionToken } from '@angular/core';
import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from './database.types';

/** Where a Supabase project is: its API URL and its publishable key, which is public by design. */
export interface SupabaseConfig {
  readonly url: string;
  readonly publishableKey: string;
}

/** The client typed with the generated schema (`npm run db:types`). */
export type TutoriaSupabaseClient = SupabaseClient<Database>;

/**
 * The only Supabase client of the app, created by provideSupabaseData(): it keeps the session and
 * renews its token, so two clients would fight over it. Every Supabase service injects it, and the
 * tests give them one whose `fetch` answers like the server (supabase-testing.ts).
 */
export const SUPABASE_CLIENT = new InjectionToken<TutoriaSupabaseClient>('SUPABASE_CLIENT');
