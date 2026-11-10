import { inject, Service } from '@angular/core';

import { EventService } from '../event-service';
import type { NewProcessEvent } from '../process-event';
import type { Json } from './database.types';
import { SUPABASE_CLIENT } from './supabase-client';
import { check } from './supabase-error';

/**
 * Inserts the browser's events in `process_event` (2.8). The RLS only takes them for the student's
 * own attempts not yet submitted, and only these four columns (2.1). A batch sent while the tab is
 * hidden goes with `keepalive` (keepalive-fetch.ts), so it arrives even if the tab closes.
 */
@Service({ autoProvided: false })
export class SupabaseEventService extends EventService {
  private readonly supabase = inject(SUPABASE_CLIENT);

  async send(events: readonly NewProcessEvent[]): Promise<void> {
    if (events.length === 0) return;
    const rows = events.map((event) => ({
      attempt_id: event.attemptId,
      type: event.type,
      timestamp: event.timestamp,
      detail: event.detail as Json,
    }));
    check(await this.supabase.from('process_event').insert(rows));
  }
}
