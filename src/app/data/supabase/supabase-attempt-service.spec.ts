import { TestBed } from '@angular/core/testing';

import { SupabaseAttemptService } from './supabase-attempt-service';
import {
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

  it('opens the attempt with open_attempt', async () => {
    server.on('POST', '/rest/v1/rpc/open_attempt', { body: attemptRow() });

    const attempt = await service.openOrCreate('exercise-1');

    expect(server.requests[0].body).toEqual({ target_exercise_id: 'exercise-1' });
    expect(attempt).toEqual({
      id: 'attempt-1',
      exerciseId: 'exercise-1',
      userId: 'user-1',
      assignmentId: 'assignment-1',
      currentCode: '',
      finalCode: null,
      status: 'in_progress',
      startedAt: '2026-09-01T08:00:00.000Z',
      finishedAt: null,
      updatedAt: '2026-09-01T08:00:00.000Z',
    });
  });

  it('is not found when the exercise is not assigned to the student', async () => {
    server.on('POST', '/rest/v1/rpc/open_attempt', {
      status: 400,
      body: { code: 'P0002', message: 'Exercise not found' },
    });

    await expect(service.openOrCreate('exercise-1')).rejects.toMatchObject({ kind: 'not_found' });
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
