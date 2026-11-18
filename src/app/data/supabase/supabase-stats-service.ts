import { Service } from '@angular/core';

import { DataError } from '../data-error';
import { type GroupHistory, StatsService } from '../stats-service';

/**
 * The history of a group in Supabase. Until the RPC `group_block_stats` and `group_deadline_stats`
 * of step 4.5, it answers `unavailable`, so `start:local` shows the error state with its retry
 * instead of failing without a provider. Not deployed between the two steps.
 */
@Service({ autoProvided: false })
export class SupabaseStatsService extends StatsService {
  groupHistory(): Promise<GroupHistory> {
    return Promise.reject(new DataError('unavailable'));
  }
}
