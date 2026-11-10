import { TestBed } from '@angular/core/testing';
import { SupabaseClient } from '@supabase/supabase-js';

import { AttemptService } from '../attempt-service';
import { AuthService } from '../auth-service';
import { CodeRunnerService } from '../code-runner-service';
import { EventService } from '../event-service';
import { ExerciseService } from '../exercise-service';
import { TutorService } from '../tutor-service';
import { provideSupabaseData } from './provide-supabase-data';
import { SUPABASE_CLIENT } from './supabase-client';
import { SupabaseAttemptService } from './supabase-attempt-service';
import { SupabaseAuthService } from './supabase-auth-service';
import { SupabaseCodeRunnerService } from './supabase-code-runner-service';
import { SupabaseEventService } from './supabase-event-service';
import { SupabaseExerciseService } from './supabase-exercise-service';
import { UnavailableTutorService } from './unavailable-tutor-service';

describe('provideSupabaseData', () => {
  const fetchSpy = vi.fn<typeof fetch>(() => Promise.resolve(Response.json([])));

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchSpy);
    TestBed.configureTestingModule({
      providers: [
        provideSupabaseData({
          url: 'https://data.supabase.test',
          publishableKey: 'sb_publishable_test',
        }),
      ],
    });
  });

  afterEach(() => vi.unstubAllGlobals());

  it('provides the Supabase version of each data service', () => {
    expect(TestBed.inject(AuthService)).toBeInstanceOf(SupabaseAuthService);
    expect(TestBed.inject(ExerciseService)).toBeInstanceOf(SupabaseExerciseService);
    expect(TestBed.inject(AttemptService)).toBeInstanceOf(SupabaseAttemptService);
    expect(TestBed.inject(EventService)).toBeInstanceOf(SupabaseEventService);
    expect(TestBed.inject(CodeRunnerService)).toBeInstanceOf(SupabaseCodeRunnerService);
  });

  it('leaves the tutor unavailable until its Edge Function exists', () => {
    expect(TestBed.inject(TutorService)).toBeInstanceOf(UnavailableTutorService);
  });

  it('creates one client for the project, with the publishable key', async () => {
    const client = TestBed.inject(SUPABASE_CLIENT);

    expect(client).toBeInstanceOf(SupabaseClient);
    expect(TestBed.inject(SUPABASE_CLIENT)).toBe(client);
    await client.from('exercise').select();
    const [url, init] = fetchSpy.mock.calls[0];
    expect(String(url)).toBe('https://data.supabase.test/rest/v1/exercise?select=*');
    expect(new Headers(init?.headers).get('apikey')).toBe('sb_publishable_test');
  });
});
