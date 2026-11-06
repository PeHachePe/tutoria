import type { NewProcessEvent } from './process-event';

/**
 * Records the events that only the browser knows (2.8). Abstract class without a decorator:
 * it is the injection token (4.2, D-005).
 */
export abstract class EventService {
  abstract send(events: readonly NewProcessEvent[]): Promise<void>;
}
