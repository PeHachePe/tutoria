import { inject, Service } from '@angular/core';

import type { RunResult } from '../attempt';
import { decodeRunResult, type EncodedRunResult } from '../code-runner/run-result';
import { CodeRunnerService } from '../code-runner-service';
import { DataError } from '../data-error';
import { SUPABASE_CLIENT } from './supabase-client';
import { toFunctionDataError } from './supabase-error';

/** The Edge Function that runs the tests (`supabase/functions/execute`). */
export const EXECUTE_FUNCTION = 'execute';

/**
 * Runs the tests in the Edge Function `execute` (2.3): it saves the code, runs it isolated, sets
 * `passed` or `tests_failed` and records the `run` event. Its answer carries the values JSON lacks
 * encoded (`EncodedRunResult`), so the student sees `NaN` or `undefined` as they are.
 */
@Service({ autoProvided: false })
export class SupabaseCodeRunnerService extends CodeRunnerService {
  private readonly supabase = inject(SUPABASE_CLIENT);

  async run(attemptId: string, code: string): Promise<RunResult> {
    const { data, error } = await this.supabase.functions.invoke<EncodedRunResult>(
      EXECUTE_FUNCTION,
      { body: { attemptId, code } },
    );
    if (error) throw toFunctionDataError(error);
    if (!data) throw new DataError('unknown', 'The run came back empty');
    return decodeRunResult(data);
  }
}
