import type { RunResult, TestResult } from '../../data/attempt';
import { runReaction } from './run-reaction';

/** A run in which the first `passed` of `total` tests pass. */
function run(passed: number, total = 5): RunResult {
  const results: TestResult[] = Array.from({ length: total }, (_, index) => ({
    testId: `t${index}`,
    passed: index < passed,
    timeout: false,
  }));
  return { status: passed === total ? 'passed' : 'tests_failed', results };
}

describe('runReaction', () => {
  it('celebrates when every test passes', () => {
    expect(runReaction(undefined, run(5))).toEqual({ kind: 'party', intensity: 3 });
    expect(runReaction(run(2), run(5))).toEqual({ kind: 'party', intensity: 3 });
  });

  it('applauds, lighter than the party, a run that keeps passing', () => {
    expect(runReaction(run(5), run(5))).toEqual({ kind: 'applause', intensity: 1 });
  });

  it('cheers when more tests pass than in the last run', () => {
    expect(runReaction(run(1), run(3))).toEqual({ kind: 'cheer', intensity: 1 });
  });

  it.each([
    ['the first run, with failures', undefined, run(3)],
    ['the same tests passing', run(3), run(3)],
    ['fewer tests passing', run(4), run(2)],
  ])('stays still for %s: failing never gets a reaction', (_case, previous, current) => {
    expect(runReaction(previous, current)).toBeNull();
  });

  it('stays still when the code did not load', () => {
    const notLoaded: RunResult = { ...run(0), loadError: { kind: 'invalid_code' } };

    expect(runReaction(run(2), notLoaded)).toBeNull();
  });
});
