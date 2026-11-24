import { TestBed } from '@angular/core/testing';

import { SEED } from './fixtures/seed';
import {
  ADMIN_ID,
  DAM_GROUP_ID,
  DAW_GROUP_ID,
  DAW_STUDENT_IDS,
  TEACHER_ID,
} from './fixtures/users';
import { groupHistoryOf } from './group-history';
import { MockDb } from './mock-db';
import { MockNetwork } from './mock-network';
import { MockStatsService } from './mock-stats-service';

describe('MockStatsService', () => {
  let service: MockStatsService;
  let db: MockDb;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [MockStatsService] });
    TestBed.inject(MockNetwork).setLatency({ min: 0, max: 0 });
    db = TestBed.inject(MockDb);
    service = TestBed.inject(MockStatsService);
  });

  afterEach(() => localStorage.clear());

  it('gives the teacher the history of their group', async () => {
    db.setSession(TEACHER_ID);

    await expect(service.groupHistory(DAW_GROUP_ID)).resolves.toEqual(
      groupHistoryOf(SEED, DAW_GROUP_ID),
    );
  });

  it('gives the administration the history of any group', async () => {
    db.setSession(ADMIN_ID);

    await expect(service.groupHistory(DAM_GROUP_ID)).resolves.toMatchObject({ students: 7 });
  });

  it('hides the groups of other teachers and those that do not exist', async () => {
    db.setSession(TEACHER_ID);

    await expect(service.groupHistory(DAM_GROUP_ID)).rejects.toMatchObject({ kind: 'not_found' });
    await expect(service.groupHistory('missing')).rejects.toMatchObject({ kind: 'not_found' });
  });

  it('is forbidden to a student and needs a session', async () => {
    db.setSession(DAW_STUDENT_IDS[0]);
    await expect(service.groupHistory(DAW_GROUP_ID)).rejects.toMatchObject({ kind: 'forbidden' });

    db.setSession(null);
    await expect(service.groupHistory(DAW_GROUP_ID)).rejects.toMatchObject({
      kind: 'unauthorized',
    });
  });
});
