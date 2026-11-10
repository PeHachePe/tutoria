import { MediaMatcher } from '@angular/cdk/layout';
import { inject, Service } from '@angular/core';

import { DataError } from '../data-error';
import type { TutorEvent, TutorRequest } from '../tutor';
import { TutorService } from '../tutor-service';
import { TUTOR_TYPING_MS, typeOut } from '../tutor/typing';
import { SUPABASE_CLIENT } from './supabase-client';
import { toFunctionDataError } from './supabase-error';

/** The Edge Function of the tutor (`supabase/functions/tutor`). */
export const TUTOR_FUNCTION = 'tutor';

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/** What the Edge Function answers: the whole answer, already checked (D-043). */
interface TutorAnswer {
  readonly events: readonly TutorEvent[];
}

/**
 * The tutor in the Edge Function `tutor` (2.4): it decides the level, asks the model, checks its
 * answer and keeps it, and answers with every event at once (no streaming, D-043). Here the text
 * appears a few words at a time, like the scripted tutor, so reading it feels like a chat; at once
 * with reduced motion.
 */
@Service({ autoProvided: false })
export class SupabaseTutorService extends TutorService {
  private readonly supabase = inject(SUPABASE_CLIENT);
  private readonly typingMs = inject(TUTOR_TYPING_MS);
  private readonly media = inject(MediaMatcher);

  ask(request: TutorRequest): AsyncIterable<TutorEvent> {
    return this.answer(request);
  }

  private async *answer(request: TutorRequest): AsyncGenerator<TutorEvent> {
    const { data, error } = await this.supabase.functions.invoke<TutorAnswer>(TUTOR_FUNCTION, {
      body: request,
    });
    if (error) throw toFunctionDataError(error);
    if (!data?.events) throw new DataError('unknown', 'The tutor came back empty');
    const typing = !this.media.matchMedia(REDUCED_MOTION_QUERY).matches;
    for (const event of data.events) {
      if (event.type === 'delta' && typing) {
        for await (const text of typeOut(event.text, this.typingMs)) {
          yield { type: 'delta', text };
        }
      } else {
        yield event;
      }
    }
  }
}
