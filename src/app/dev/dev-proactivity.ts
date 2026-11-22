import { computed, Service, signal } from '@angular/core';

import { DEFAULT_PROACTIVE_TIMING, type ProactiveTiming } from '../core/proactive-timing';

/**
 * Short times to try the proactive tutor in a minute instead of waiting 4 minutes of pause and 3
 * between interventions: a pause of 30 s, 20 s between interventions, a check every 5 s and 5 s
 * still to stop writing. The failures stay at the threshold of the exercise.
 */
export const FAST_PROACTIVE_TIMING: ProactiveTiming = {
  checkMs: 5000,
  writingPauseMs: 5000,
  idleMinutes: 0.5,
  limits: { ...DEFAULT_PROACTIVE_TIMING.limits, cooldownMs: 20_000 },
};

/**
 * «Tutor proactivo rápido» of the dev toolbar: the times the proactive tutor follows in development
 * (`PROACTIVE_TIMING`, provided by `provideDevToolbar()`). Off on every load of the page.
 */
@Service()
export class DevProactivity {
  private readonly fastState = signal(false);
  readonly fast = this.fastState.asReadonly();
  readonly timing = computed(() =>
    this.fastState() ? FAST_PROACTIVE_TIMING : DEFAULT_PROACTIVE_TIMING,
  );

  setFast(on: boolean): void {
    this.fastState.set(on);
  }
}
