import { inject, Service } from '@angular/core';

import type { Attempt, AttemptHistory } from '../attempt';
import { AttemptService } from '../attempt-service';
import { SUPABASE_CLIENT } from './supabase-client';
import { unwrap } from './supabase-error';
import { toAttempt, toProcessEvent, toTutorInteraction } from './supabase-rows';

/**
 * The student's attempts in Supabase. The status only changes on the server (2.4): the trigger
 * that sends it back to `in_progress` when the code changes, and the functions `open_attempt` and
 * `submit_attempt` (2.1). The client may only write `current_code`.
 */
@Service({ autoProvided: false })
export class SupabaseAttemptService extends AttemptService {
  private readonly supabase = inject(SUPABASE_CLIENT);

  /** Two tabs opening it at once get the same attempt (unique per student and exercise). */
  async openOrCreate(exerciseId: string): Promise<Attempt> {
    const row = unwrap(
      await this.supabase.rpc('open_attempt', { target_exercise_id: exerciseId }).single(),
    );
    return toAttempt(row);
  }

  /** A submitted attempt rejects the change (`invalid`), and another's is not found (RLS). */
  async saveCode(attemptId: string, code: string): Promise<Attempt> {
    const row = unwrap(
      await this.supabase
        .from('attempt')
        .update({ current_code: code })
        .eq('id', attemptId)
        .select()
        .single(),
    );
    return toAttempt(row);
  }

  async submit(attemptId: string): Promise<Attempt> {
    const row = unwrap(
      await this.supabase.rpc('submit_attempt', { target_attempt_id: attemptId }).single(),
    );
    return toAttempt(row);
  }

  async history(attemptId: string): Promise<AttemptHistory> {
    const [attempt, events, interactions] = await Promise.all([
      this.supabase.from('attempt').select().eq('id', attemptId).single(),
      this.supabase.from('process_event').select().eq('attempt_id', attemptId).order('timestamp'),
      this.supabase
        .from('tutor_interaction')
        .select()
        .eq('attempt_id', attemptId)
        .order('created_at'),
    ]);
    return {
      attempt: toAttempt(unwrap(attempt)),
      events: unwrap(events).map(toProcessEvent),
      interactions: unwrap(interactions).map(toTutorInteraction),
    };
  }
}
