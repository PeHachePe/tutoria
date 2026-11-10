import type { RunResult } from '../../data/attempt';
import type { Intensity, ReactionKind } from '../../data/tutor';

/** A reaction to a run, before it gets the id that plays it. */
export interface RunReaction {
  readonly kind: ReactionKind;
  readonly intensity: Intensity;
}

/**
 * How the screen celebrates a run, from it and the previous one of this visit: a party when every
 * test passes, and a lighter applause when it keeps passing, so the same party does not tire; a
 * small cheer when more tests pass than before. Failing never gets a reaction, which would only
 * discourage (1.8).
 */
export function runReaction(
  previous: RunResult | undefined,
  current: RunResult,
): RunReaction | null {
  if (current.status === 'passed') {
    return previous?.status === 'passed'
      ? { kind: 'applause', intensity: 1 }
      : { kind: 'party', intensity: 3 };
  }
  if (previous && passedCount(current) > passedCount(previous)) {
    return { kind: 'cheer', intensity: 1 };
  }
  return null;
}

function passedCount(run: RunResult): number {
  return run.results.filter((result) => result.passed).length;
}
