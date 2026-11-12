import { TestBed } from '@angular/core/testing';

import { SupabaseAttemptService } from './supabase-attempt-service';
import { SUPABASE_CLIENT } from './supabase-client';
import {
  appUserRow,
  attemptRow,
  eventRow,
  FakeSupabaseServer,
  interactionRow,
  provideFakeSupabase,
} from './supabase-testing';

describe('SupabaseAttemptService', () => {
  let server: FakeSupabaseServer;
  let service: SupabaseAttemptService;

  beforeEach(() => {
    server = new FakeSupabaseServer();
    TestBed.configureTestingModule({
      providers: [SupabaseAttemptService, provideFakeSupabase(server)],
    });
    service = TestBed.inject(SupabaseAttemptService);
  });

  it('opens the latest attempt at the assignment with open_attempt', async () => {
    server.on('POST', '/rest/v1/rpc/open_attempt', { body: attemptRow() });

    const attempt = await service.openOrCreate('assignment-1');

    expect(server.requests[0].body).toEqual({ target_assignment_id: 'assignment-1' });
    expect(attempt).toEqual({
      id: 'attempt-1',
      exerciseId: 'exercise-1',
      userId: 'user-1',
      assignmentId: 'assignment-1',
      number: 1,
      currentCode: '',
      finalCode: null,
      status: 'in_progress',
      startedAt: '2026-09-01T08:00:00.000Z',
      finishedAt: null,
      updatedAt: '2026-09-01T08:00:00.000Z',
    });
  });

  it('opens an earlier attempt by its number', async () => {
    server.on('POST', '/rest/v1/rpc/open_attempt', { body: attemptRow() });

    await service.openOrCreate('assignment-1', 1);

    expect(server.requests[0].body).toEqual({
      target_assignment_id: 'assignment-1',
      attempt_number: 1,
    });
  });

  it('is not found when the student cannot open the assignment', async () => {
    server.on('POST', '/rest/v1/rpc/open_attempt', {
      status: 400,
      body: { code: 'P0002', message: 'Assignment not found' },
    });

    await expect(service.openOrCreate('assignment-1')).rejects.toMatchObject({
      kind: 'not_found',
    });
  });

  describe('list', () => {
    it("lists the signed-in user's attempts at the assignment by number", async () => {
      server
        .acceptSignIn(appUserRow({ id: 'lucia', email: 'lucia@tutoria.test' }))
        .on('GET', '/rest/v1/attempt', {
          body: [attemptRow(), attemptRow({ id: 'attempt-2', number: 2 })],
        });
      await TestBed.inject(SUPABASE_CLIENT).auth.signInWithPassword({
        email: 'lucia@tutoria.test',
        password: 'test',
      });

      const attempts = await service.list('assignment-1');

      expect(attempts.map((attempt) => attempt.number)).toEqual([1, 2]);
      const [request] = server.sentTo('GET', '/rest/v1/attempt');
      expect(request.params.get('assignment_id')).toBe('eq.assignment-1');
      expect(request.params.get('user_id')).toBe('eq.lucia');
      expect(request.params.get('order')).toBe('number.asc');
    });

    it('asks for nobody without a session', async () => {
      server.on('GET', '/rest/v1/attempt', { body: [] });

      await expect(service.list('assignment-1')).resolves.toEqual([]);
      expect(server.requests[0].params.get('user_id')).toBe('eq.');
    });
  });

  it('practises again with retry_attempt', async () => {
    server.on('POST', '/rest/v1/rpc/retry_attempt', { body: attemptRow({ number: 2 }) });

    const attempt = await service.retry('assignment-1');

    expect(server.requests[0].body).toEqual({ target_assignment_id: 'assignment-1' });
    expect(attempt.number).toBe(2);
  });

  it('rejects practising again without a submitted attempt as invalid', async () => {
    server.on('POST', '/rest/v1/rpc/retry_attempt', {
      status: 400,
      body: { code: 'P0001', message: 'Only a submitted attempt can be practised again' },
    });

    await expect(service.retry('assignment-1')).rejects.toMatchObject({ kind: 'invalid' });
  });

  it('saves only the code and returns the attempt as the server left it', async () => {
    server.on('PATCH', '/rest/v1/attempt', {
      body: attemptRow({ current_code: 'return 1;', status: 'in_progress' }),
    });

    const attempt = await service.saveCode('attempt-1', 'return 1;');

    expect(server.requests[0].params.get('id')).toBe('eq.attempt-1');
    expect(server.requests[0].body).toEqual({ current_code: 'return 1;' });
    expect(attempt.currentCode).toBe('return 1;');
  });

  it('rejects saving a submitted attempt as invalid', async () => {
    server.on('PATCH', '/rest/v1/attempt', {
      status: 400,
      body: { code: 'P0001', message: 'A submitted attempt cannot change' },
    });

    await expect(service.saveCode('attempt-1', 'x')).rejects.toMatchObject({ kind: 'invalid' });
  });

  it('submits with submit_attempt', async () => {
    server.on('POST', '/rest/v1/rpc/submit_attempt', {
      body: attemptRow({
        status: 'submitted',
        final_code: 'return 1;',
        finished_at: '2026-09-01 08:20:00+00',
      }),
    });

    const attempt = await service.submit('attempt-1');

    expect(server.requests[0].body).toEqual({ target_attempt_id: 'attempt-1' });
    expect(attempt).toMatchObject({
      status: 'submitted',
      finalCode: 'return 1;',
      finishedAt: '2026-09-01T08:20:00.000Z',
    });
  });

  it('returns the history of an attempt with its events and interactions in order', async () => {
    server
      .on('GET', '/rest/v1/attempt', { body: attemptRow() })
      .on('GET', '/rest/v1/process_event', { body: [eventRow()] })
      .on('GET', '/rest/v1/tutor_interaction', { body: [interactionRow()] });

    const { attempt, events, interactions } = await service.history('attempt-1');

    expect(attempt.id).toBe('attempt-1');
    expect(events).toEqual([
      {
        id: 'event-1',
        attemptId: 'attempt-1',
        type: 'paste',
        timestamp: '2026-09-01T08:03:00.000Z',
        detail: { length: 40 },
      },
    ]);
    expect(interactions).toEqual([
      {
        id: 'interaction-1',
        attemptId: 'attempt-1',
        trigger: 'hint',
        hintLevel: 1,
        studentMessage: null,
        transcript: '¿Qué valor tiene el acumulador al empezar?',
        emotion: 'encouragement',
        intensity: 1,
        elusion: false,
        actions: [],
        promptVersion: 'v1',
        createdAt: '2026-09-01T08:05:00.000Z',
      },
    ]);
    expect(server.sentTo('GET', '/rest/v1/process_event')[0].params.get('order')).toBe(
      'timestamp.asc',
    );
    expect(server.sentTo('GET', '/rest/v1/tutor_interaction')[0].params.get('order')).toBe(
      'created_at.asc',
    );
  });
});
