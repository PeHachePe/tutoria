import type { SupabaseClient } from '@supabase/supabase-js';

import { runEventDetail, type RunResult } from '../../../src/app/data/code-runner/run-result.ts';
import type { Database } from '../../../src/app/data/supabase/database.types.ts';
import type { RecordOutcome, RunAttempt, RunStore } from './run-store.ts';

/** The tables and the function `record_run`, with `service_role`, which skips the RLS. */
export class SupabaseRunStore implements RunStore {
  constructor(private readonly admin: SupabaseClient<Database>) {}

  async userOf(token: string): Promise<string | null> {
    const { data, error } = await this.admin.auth.getUser(token);
    return error ? null : data.user.id;
  }

  async findAttempt(attemptId: string): Promise<RunAttempt | null> {
    const { data, error } = await this.admin
      .from('attempt')
      .select(
        'user_id, status, app_user(status), exercise(function_name, test(id, input, expected_output, is_hidden, position))',
      )
      .eq('id', attemptId)
      .maybeSingle();
    if (error) throw new Error(`Reading the attempt failed: ${error.message}`);
    if (!data?.exercise || !data.app_user) return null;
    return {
      userId: data.user_id,
      ownerActive: data.app_user.status === 'active',
      status: data.status,
      functionName: data.exercise.function_name,
      tests: data.exercise.test
        .toSorted((a, b) => a.position - b.position)
        .map((test) => ({
          id: test.id,
          input: test.input as unknown[],
          expectedOutput: test.expected_output,
          isHidden: test.is_hidden,
        })),
    };
  }

  async latestRuns(userId: string, since: Date, limit: number): Promise<readonly Date[]> {
    const { data, error } = await this.admin
      .from('process_event')
      .select('received_at, attempt!inner(user_id)')
      .eq('type', 'run')
      .eq('attempt.user_id', userId)
      .gte('received_at', since.toISOString())
      .order('received_at', { ascending: false })
      .limit(limit);
    if (error) throw new Error(`Reading the latest runs failed: ${error.message}`);
    return data.map((row) => new Date(row.received_at));
  }

  async recordRun(attemptId: string, code: string, result: RunResult): Promise<RecordOutcome> {
    const detail = runEventDetail(result);
    const { error } = await this.admin.rpc('record_run', {
      target_attempt_id: attemptId,
      ran_code: code,
      new_status: result.status,
      // A mutable copy, as the generated type of JSON asks
      run_detail: { ...detail, failedTestIds: [...detail.failedTestIds] },
    });
    // Raised by record_run (20261110100500_record_run.sql)
    if (error?.code === 'P0001') return 'submitted';
    if (error?.code === 'P0002') return 'not_found';
    if (error) throw new Error(`Recording the run failed: ${error.message}`);
    return 'recorded';
  }
}
