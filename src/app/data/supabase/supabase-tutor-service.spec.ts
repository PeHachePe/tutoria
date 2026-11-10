import { MediaMatcher } from '@angular/cdk/layout';
import { TestBed } from '@angular/core/testing';

import { DataError } from '../data-error';
import type { TutorEvent, TutorRequest } from '../tutor';
import { TUTOR_TYPING_MS } from '../tutor/typing';
import { FakeSupabaseServer, provideFakeSupabase } from './supabase-testing';
import { SupabaseTutorService } from './supabase-tutor-service';

const TUTOR = '/functions/v1/tutor';

const REQUEST: TutorRequest = {
  requestId: 'request-1',
  attemptId: 'attempt-1',
  kind: 'hint',
  code: 'function suma(v) {}',
  language: 'es',
};

const ANSWER: TutorEvent[] = [
  { type: 'meta', emotion: 'encouragement', intensity: 2, hintLevel: 1, reaction: 'thinking' },
  { type: 'delta', text: 'Uno dos tres cuatro' },
  { type: 'done', interactionId: 'i1', silent: false },
];

async function collect(events: AsyncIterable<TutorEvent>): Promise<TutorEvent[]> {
  const collected: TutorEvent[] = [];
  for await (const event of events) collected.push(event);
  return collected;
}

describe('SupabaseTutorService', () => {
  let server: FakeSupabaseServer;
  let reducedMotion: boolean;

  function service(): SupabaseTutorService {
    return TestBed.inject(SupabaseTutorService);
  }

  beforeEach(() => {
    server = new FakeSupabaseServer();
    reducedMotion = false;
    TestBed.configureTestingModule({
      providers: [
        SupabaseTutorService,
        provideFakeSupabase(server),
        { provide: TUTOR_TYPING_MS, useValue: 0 },
        {
          provide: MediaMatcher,
          useValue: { matchMedia: () => ({ matches: reducedMotion }) },
        },
      ],
    });
  });

  it('sends the request to the Edge Function tutor and types the answer out a little at a time', async () => {
    server.on('POST', TUTOR, { body: { events: ANSWER } });

    const events = await collect(service().ask(REQUEST));

    expect(server.sentTo('POST', TUTOR)[0].body).toEqual(REQUEST);
    expect(events).toEqual([
      ANSWER[0],
      { type: 'delta', text: 'Uno dos tres ' },
      { type: 'delta', text: 'cuatro' },
      ANSWER[2],
    ]);
  });

  it('shows the answer at once with reduced motion', async () => {
    reducedMotion = true;
    server.on('POST', TUTOR, { body: { events: ANSWER } });

    expect(await collect(service().ask(REQUEST))).toEqual(ANSWER);
  });

  it('passes on an intervention the tutor chose not to make', async () => {
    const silent: TutorEvent[] = [{ type: 'done', interactionId: null, silent: true }];
    server.on('POST', TUTOR, { body: { events: silent } });

    expect(await collect(service().ask({ ...REQUEST, kind: 'proactive' }))).toEqual(silent);
  });

  it('says how long to wait when the student asked too many times', async () => {
    vi.useFakeTimers({ now: Date.parse('2026-11-10T10:00:00Z') });
    server.on('POST', TUTOR, {
      status: 429,
      body: { message: 'Too many questions' },
      headers: { 'Retry-After': '40' },
    });

    const failure = await collect(service().ask(REQUEST)).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(DataError);
    expect(failure).toMatchObject({
      kind: 'rate_limited',
      retryAt: Date.parse('2026-11-10T10:00:40Z'),
    });
    vi.useRealTimers();
  });

  it.each([
    [401, 'unauthorized'],
    [404, 'not_found'],
    [409, 'invalid'],
    [503, 'unavailable'],
  ])('turns the status %i of the function into %s', async (status, kind) => {
    server.on('POST', TUTOR, { status, body: { message: 'No' } });

    const failure = await collect(service().ask(REQUEST)).catch((error: unknown) => error);

    expect(failure).toMatchObject({ kind, retryAt: undefined });
  });

  it('fails when the answer comes back empty', async () => {
    server.on('POST', TUTOR, { body: {} });

    await expect(collect(service().ask(REQUEST))).rejects.toMatchObject({ kind: 'unknown' });
  });
});
