import { DOCUMENT, EnvironmentProviders, inject, makeEnvironmentProviders } from '@angular/core';
import { createClient } from '@supabase/supabase-js';

import { AttemptService } from '../attempt-service';
import { AuthService } from '../auth-service';
import { CodeRunnerService } from '../code-runner-service';
import { EventService } from '../event-service';
import { ExerciseService } from '../exercise-service';
import { LiveService } from '../live-service';
import { TutorService } from '../tutor-service';
import type { Database } from './database.types';
import { keepaliveFetch } from './keepalive-fetch';
import { SUPABASE_CLIENT, type SupabaseConfig } from './supabase-client';
import { SupabaseAttemptService } from './supabase-attempt-service';
import { SupabaseAuthService } from './supabase-auth-service';
import { SupabaseCodeRunnerService } from './supabase-code-runner-service';
import { SupabaseEventService } from './supabase-event-service';
import { SupabaseExerciseService } from './supabase-exercise-service';
import { SupabaseLiveService } from './supabase-live-service';
import { SupabaseTutorService } from './supabase-tutor-service';

/**
 * The Supabase version of every data service, with the only client of the app (4.4); the rest of
 * the services join in their own steps.
 */
export function provideSupabaseData(config: SupabaseConfig): EnvironmentProviders {
  return makeEnvironmentProviders([
    {
      provide: SUPABASE_CLIENT,
      useFactory: () =>
        createClient<Database>(config.url, config.publishableKey, {
          global: { fetch: keepaliveFetch(inject(DOCUMENT)) },
        }),
    },
    { provide: AuthService, useClass: SupabaseAuthService },
    { provide: ExerciseService, useClass: SupabaseExerciseService },
    { provide: AttemptService, useClass: SupabaseAttemptService },
    { provide: EventService, useClass: SupabaseEventService },
    { provide: CodeRunnerService, useClass: SupabaseCodeRunnerService },
    { provide: TutorService, useClass: SupabaseTutorService },
    { provide: LiveService, useClass: SupabaseLiveService },
  ]);
}
