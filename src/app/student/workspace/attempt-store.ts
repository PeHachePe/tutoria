import { computed, inject, Service, signal } from '@angular/core';

import type { Attempt } from '../../data/attempt';
import { AttemptService } from '../../data/attempt-service';

/**
 * The attempt the student is working on, shared by the editor, the results, «Entregar» and the
 * tutor (4.5). Provided by the workspace route, so it lives while the student is on an exercise.
 * Saving the code (1.4), running the tests and submitting (1.5) come in their steps.
 */
@Service({ autoProvided: false })
export class AttemptStore {
  private readonly attempts = inject(AttemptService);

  private readonly attemptState = signal<Attempt | undefined>(undefined);
  /** Exercise of the latest `open()`, so an answer that arrives late does not overwrite the new one. */
  private openingId: string | undefined;

  readonly attempt = this.attemptState.asReadonly();
  readonly status = computed(() => this.attemptState()?.status ?? 'not_started');

  /** Opens the student's attempt at the exercise, or creates it in `in_progress` (2.4). */
  async open(exerciseId: string): Promise<Attempt> {
    this.openingId = exerciseId;
    this.attemptState.set(undefined);
    const attempt = await this.attempts.openOrCreate(exerciseId);
    if (this.openingId === exerciseId) {
      this.attemptState.set(attempt);
    }
    return attempt;
  }
}
