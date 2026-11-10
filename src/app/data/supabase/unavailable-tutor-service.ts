import { Service } from '@angular/core';

import { DataError } from '../data-error';
import type { TutorEvent } from '../tutor';
import { TutorService } from '../tutor-service';

/**
 * Stands in for the tutor against Supabase until the Edge Function `tutor` exists (step 2.4): the
 * scripted tutor records its interactions in the mock data. The chat shows its error as «not
 * available».
 */
@Service({ autoProvided: false })
export class UnavailableTutorService extends TutorService {
  ask(): AsyncIterable<TutorEvent> {
    return {
      [Symbol.asyncIterator]: () => ({
        next: () => Promise.reject(new DataError('unavailable', 'The tutor arrives in step 2.4')),
      }),
    };
  }
}
