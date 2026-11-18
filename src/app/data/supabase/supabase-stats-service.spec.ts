import { TestBed } from '@angular/core/testing';

import { SupabaseStatsService } from './supabase-stats-service';

describe('SupabaseStatsService', () => {
  it('is unavailable until step 4.5', async () => {
    TestBed.configureTestingModule({ providers: [SupabaseStatsService] });

    await expect(TestBed.inject(SupabaseStatsService).groupHistory()).rejects.toMatchObject({
      kind: 'unavailable',
    });
  });
});
