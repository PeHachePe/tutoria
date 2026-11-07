import { inject, Service } from '@angular/core';

import { DataError } from '../data-error';
import { EventService } from '../event-service';
import type { NewProcessEvent, ProcessEvent } from '../process-event';
import { findRow } from './mock-access';
import { MockDb } from './mock-db';
import { MockNetwork } from './mock-network';

/** Client events in MockDb. A student can only add events to their own attempts, as in 2.3. */
@Service({ autoProvided: false })
export class MockEventService extends EventService {
  private readonly db = inject(MockDb);
  private readonly network = inject(MockNetwork);

  send(events: readonly NewProcessEvent[]): Promise<void> {
    return this.network.request(() => {
      const user = this.db.requireUser();
      const attempts = this.db.tables().attempts;
      for (const event of events) {
        if (findRow(attempts, event.attemptId).userId !== user.id) {
          throw new DataError('forbidden');
        }
      }
      const stored: ProcessEvent[] = events.map((event) => ({ ...event, id: crypto.randomUUID() }));
      this.db.update('events', (rows) => [...rows, ...stored]);
    });
  }
}
