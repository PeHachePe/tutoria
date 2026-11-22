import { InjectionToken, type Signal, signal } from '@angular/core';

import { PROACTIVE_LIMITS, type ProactiveLimits } from '../shared/proactive-reason';

/** The times of the proactive tutor in the browser (2.7). */
export interface ProactiveTiming {
  /** How often it looks whether the student stopped, or whether a help that waited can come. */
  readonly checkMs: number;
  /** Code changed less than this ago: the student is writing, and the tutor waits. */
  readonly writingPauseMs: number;
  /** Minutes of a pause instead of those of the exercise; null takes the exercise's. */
  readonly idleMinutes: number | null;
  /** Cooldown and limit of `proactiveReasons()`. */
  readonly limits: ProactiveLimits;
}

/** The times of 2.7: every 15 seconds, 15 seconds still, the pause of each exercise. */
export const DEFAULT_PROACTIVE_TIMING: ProactiveTiming = {
  checkMs: 15_000,
  writingPauseMs: 15_000,
  idleMinutes: null,
  limits: PROACTIVE_LIMITS,
};

/**
 * The times the proactive tutor follows. Always those of 2.7, except in development, where the
 * dev toolbar can make them shorter to try it in a minute (D-088).
 */
export const PROACTIVE_TIMING = new InjectionToken<Signal<ProactiveTiming>>('PROACTIVE_TIMING', {
  providedIn: 'root',
  factory: () => signal(DEFAULT_PROACTIVE_TIMING).asReadonly(),
});
