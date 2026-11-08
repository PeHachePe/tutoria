import { TestBed } from '@angular/core/testing';

import type { NewProcessEvent } from '../process-event';
import { DAW_STUDENT_IDS } from './fixtures/users';
import { MockDb } from './mock-db';
import { MockEventService } from './mock-event-service';
import { MockNetwork } from './mock-network';

describe('MockEventService', () => {
  let service: MockEventService;
  let db: MockDb;
  let ownAttemptId: string;
  let otherAttemptId: string;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [MockEventService] });
    TestBed.inject(MockNetwork).setLatency({ min: 0, max: 0 });
    db = TestBed.inject(MockDb);
    db.setSession(DAW_STUDENT_IDS[0]);
    const attempts = db.tables().attempts;
    ownAttemptId = attempts.find((a) => a.userId === DAW_STUDENT_IDS[0])!.id;
    otherAttemptId = attempts.find((a) => a.userId === DAW_STUDENT_IDS[1])!.id;
    service = TestBed.inject(MockEventService);
  });

  afterEach(() => localStorage.clear());

  it('stores the events of the student, each with its own id', async () => {
    const before = db.tables().events.length;
    const events: NewProcessEvent[] = [
      {
        attemptId: ownAttemptId,
        type: 'focus_lost',
        timestamp: '2026-11-10T09:30:00.000Z',
        detail: null,
      },
      {
        attemptId: ownAttemptId,
        type: 'paste',
        timestamp: '2026-11-10T09:31:00.000Z',
        detail: { length: 42 },
      },
    ];

    await service.send(events);

    const stored = db.tables().events.slice(before);
    expect(stored).toEqual(events.map((event) => ({ ...event, id: expect.any(String) })));
    expect(stored[0].id).not.toBe(stored[1].id);
  });

  it("rejects the whole batch if an event belongs to another student's attempt", async () => {
    const before = db.tables().events;

    await expect(
      service.send([
        {
          attemptId: ownAttemptId,
          type: 'focus_lost',
          timestamp: '2026-11-10T09:30:00.000Z',
          detail: null,
        },
        {
          attemptId: otherAttemptId,
          type: 'focus_lost',
          timestamp: '2026-11-10T09:30:00.000Z',
          detail: null,
        },
      ]),
    ).rejects.toMatchObject({ kind: 'forbidden' });
    expect(db.tables().events).toBe(before);
  });

  it('rejects events of an unknown attempt or without a session', async () => {
    const event: NewProcessEvent = {
      attemptId: 'missing',
      type: 'focus_gained',
      timestamp: '2026-11-10T09:30:00.000Z',
      detail: { awayMs: 30_000 },
    };

    await expect(service.send([event])).rejects.toMatchObject({ kind: 'not_found' });
    db.setSession(null);
    await expect(service.send([event])).rejects.toMatchObject({ kind: 'unauthorized' });
  });
});
