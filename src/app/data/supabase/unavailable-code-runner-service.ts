import { Service } from '@angular/core';

import type { RunResult } from '../attempt';
import { CodeRunnerService } from '../code-runner-service';
import { DataError } from '../data-error';

/**
 * Stands in for the runner against Supabase until the Edge Function `execute` exists (step 2.3).
 * The mock runner cannot take its place: it reads the attempts of the mock data, and only the
 * server may set an attempt as passed. The workspace shows its error as «not available».
 */
@Service({ autoProvided: false })
export class UnavailableCodeRunnerService extends CodeRunnerService {
  run(): Promise<RunResult> {
    return Promise.reject(new DataError('unavailable', 'The runner arrives in step 2.3'));
  }
}
