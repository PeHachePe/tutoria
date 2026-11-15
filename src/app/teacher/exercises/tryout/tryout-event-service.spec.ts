import { TestBed } from '@angular/core/testing';

import { TryoutEventService } from './tryout-event-service';

describe('TryoutEventService', () => {
  it('sends the events of a try nowhere', async () => {
    TestBed.configureTestingModule({ providers: [TryoutEventService] });

    await expect(TestBed.inject(TryoutEventService).send()).resolves.toBeUndefined();
  });
});
