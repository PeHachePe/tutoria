import { TestBed } from '@angular/core/testing';

import { SupabaseCodeRunnerService } from './supabase-code-runner-service';
import { FakeSupabaseServer, provideFakeSupabase } from './supabase-testing';

const EXECUTE = '/functions/v1/execute';

describe('SupabaseCodeRunnerService', () => {
  let server: FakeSupabaseServer;
  let service: SupabaseCodeRunnerService;

  beforeEach(() => {
    server = new FakeSupabaseServer();
    TestBed.configureTestingModule({
      providers: [SupabaseCodeRunnerService, provideFakeSupabase(server)],
    });
    service = TestBed.inject(SupabaseCodeRunnerService);
  });

  it('sends the attempt and the code to the Edge Function execute', async () => {
    server.on('POST', EXECUTE, { body: { status: 'passed', results: [] } });

    const result = await service.run('attempt-1', 'function suma() {}');

    expect(server.sentTo('POST', EXECUTE)[0].body).toEqual({
      attemptId: 'attempt-1',
      code: 'function suma() {}',
    });
    expect(result).toEqual({ status: 'passed', results: [] });
  });

  it('returns the values JSON lacks as they are', async () => {
    server.on('POST', EXECUTE, {
      body: {
        status: 'tests_failed',
        results: [
          {
            testId: 't1',
            passed: false,
            timeout: false,
            input: [[]],
            expected: 0,
            actual: { t: 'undefined' },
          },
          {
            testId: 't2',
            passed: false,
            timeout: false,
            input: [[1]],
            expected: 1,
            actual: { t: 'number', v: 'NaN' },
          },
          { testId: 't3', passed: false, timeout: true },
        ],
      },
    });

    const { results } = await service.run('attempt-1', 'let total;');

    expect('actual' in results[0]).toBe(true);
    expect(results[0].actual).toBeUndefined();
    expect(results[1].actual).toBeNaN();
    expect('actual' in results[2]).toBe(false);
  });

  it.each([
    [401, 'unauthorized'],
    [403, 'forbidden'],
    [404, 'not_found'],
    [409, 'invalid'],
    [429, 'rate_limited'],
    [500, 'unknown'],
    [546, 'unavailable'],
  ])('turns the status %i of the function into %s', async (status, kind) => {
    server.on('POST', EXECUTE, { status, body: { message: 'No' } });

    await expect(service.run('attempt-1', '')).rejects.toMatchObject({ kind });
  });

  it('is unavailable when the function cannot be reached', async () => {
    server.on('POST', EXECUTE, {
      status: 503,
      body: { message: 'Function not found' },
      headers: { 'x-relay-error': 'true' },
    });

    await expect(service.run('attempt-1', '')).rejects.toMatchObject({ kind: 'unavailable' });
  });

  it('is an unknown error when the function answers without a result', async () => {
    server.on('POST', EXECUTE, { body: null });

    await expect(service.run('attempt-1', '')).rejects.toMatchObject({ kind: 'unknown' });
  });

  it('is a network error without an answer', async () => {
    server.offline();

    await expect(service.run('attempt-1', '')).rejects.toMatchObject({ kind: 'network' });
  });
});
