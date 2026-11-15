import { Service } from '@angular/core';

import { EventService } from '../../../data/event-service';

/**
 * The events of a try (4.3e, D-061): pastes and absences of the teacher say nothing of a student,
 * so they go nowhere.
 */
@Service({ autoProvided: false })
export class TryoutEventService extends EventService {
  send(): Promise<void> {
    return Promise.resolve();
  }
}
