import { TestBed } from '@angular/core/testing';

import type { NewProcessEvent } from '../process-event';
import { SupabaseEventService } from './supabase-event-service';
import { FakeSupabaseServer, provideFakeSupabase } from './supabase-testing';

const EVENTS: NewProcessEvent[] = [
  {
    attemptId: 'attempt-1',
    type: 'paste',
    timestamp: '2026-09-01T08:03:00.000Z',
    detail: { length: 40 },
  },
  {
    attemptId: 'attempt-1',
    type: 'focus_lost',
    timestamp: '2026-09-01T08:04:00.000Z',
    detail: null,
  },
];

describe('SupabaseEventService', () => {
  let server: FakeSupabaseServer;
  let service: SupabaseEventService;

  beforeEach(() => {
    server = new FakeSupabaseServer().on('POST', '/rest/v1/process_event', { status: 201 });
    TestBed.configureTestingModule({
      providers: [SupabaseEventService, provideFakeSupabase(server)],
    });
    service = TestBed.inject(SupabaseEventService);
  });

  it('inserts the batch in one request, with only the columns the client may write', async () => {
    await service.send(EVENTS);

    expect(server.requests).toHaveLength(1);
    expect(server.requests[0].body).toEqual([
      {
        attempt_id: 'attempt-1',
        type: 'paste',
        timestamp: '2026-09-01T08:03:00.000Z',
        detail: { length: 40 },
      },
      {
        attempt_id: 'attempt-1',
        type: 'focus_lost',
        timestamp: '2026-09-01T08:04:00.000Z',
        detail: null,
      },
    ]);
  });

  it('sends nothing for an empty batch', async () => {
    await service.send([]);

    expect(server.requests).toHaveLength(0);
  });

  it('is forbidden when the RLS rejects the events', async () => {
    server.on('POST', '/rest/v1/process_event', {
      status: 403,
      body: { code: '42501', message: 'new row violates row-level security policy' },
    });

    await expect(service.send(EVENTS)).rejects.toMatchObject({ kind: 'forbidden' });
  });

  it('fails as a network error without a connection, so the logger keeps the batch', async () => {
    server.offline();

    await expect(service.send(EVENTS)).rejects.toMatchObject({ kind: 'network' });
  });
});
