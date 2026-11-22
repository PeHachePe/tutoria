import { testEvents } from '../data/process-event-testing';
import {
  type AttemptEvent,
  currentFailure,
  failedTestsByRun,
  failingStreaks,
  failureStreak,
  lastActivityAt,
  lastBreakthrough,
  PROACTIVE_LIMITS,
  PROACTIVE_REASONS,
  type ProactiveInput,
  proactiveReason,
  proactiveReasons,
} from './proactive-reason';

const T = Date.parse('2026-11-22T10:00:00.000Z');
const SECOND = 1000;
const MINUTE = 60_000;
const at = (minute: number) => T + minute * MINUTE;
const run = (minute: number, failing: string[] = []) => testEvents.run('a', at(minute), failing);
const proactive = (minute: number, reason?: 'failures' | 'idle' | 'achievement', silent = false) =>
  testEvents.proactive('a', at(minute), reason, silent);

/** An event of an intervention recorded before interventions had a reason. */
function oldIntervention(minute: number): AttemptEvent {
  return {
    type: 'proactive_intervention',
    timestamp: new Date(at(minute)).toISOString(),
    detail: { silent: false },
  };
}

/** An attempt with failed tests, saved at minute 0, and the thresholds by default (3 runs, 4 minutes). */
function input(change: Partial<ProactiveInput> = {}): ProactiveInput {
  return {
    status: 'tests_failed',
    updatedAt: new Date(at(0)).toISOString(),
    events: [],
    lastTurnAt: null,
    thresholds: { maxRepeatedFailures: 3, maxIdleMinutes: 4 },
    now: at(1),
    ...change,
  };
}

describe('PROACTIVE_REASONS', () => {
  it('are the failures, the idle time and the achievement (2.7)', () => {
    expect(PROACTIVE_REASONS).toEqual(['failures', 'idle', 'achievement']);
  });
});

describe('failedTestsByRun', () => {
  it('gives the failed tests of each run, sorted by time, and ignores other events', () => {
    const events = [run(3), testEvents.paste('a', at(2)), run(1, ['t1']), run(2, ['t2'])];

    expect(failedTestsByRun(events)).toEqual([['t1'], ['t2'], []]);
  });
});

describe('failingStreaks', () => {
  it('is empty without runs', () => {
    expect(failingStreaks([])).toEqual(new Map());
  });

  it('is empty when every test passes in the latest run', () => {
    expect(failingStreaks([run(1, ['t1']), run(2)])).toEqual(new Map());
  });

  it('gives each test failing in the latest run the runs in a row it has failed', () => {
    const events = [run(1, ['t1']), run(2, ['t1', 't2']), run(3, ['t1']), run(4, ['t1', 't3'])];

    expect(failingStreaks(events)).toEqual(
      new Map([
        ['t1', 4],
        ['t3', 1],
      ]),
    );
  });
});

describe('currentFailure', () => {
  it('is null without runs', () => {
    expect(currentFailure([])).toBeNull();
  });

  it('is null when every test passes in the latest run', () => {
    expect(currentFailure([run(1, ['t1']), run(2)])).toBeNull();
  });

  it('is the test failing now in the most runs in a row', () => {
    const events = [run(1, ['t2']), run(2, ['t1', 't2']), run(3, ['t1', 't2'])];

    expect(currentFailure(events)).toEqual({ testId: 't2', runs: 3 });
  });

  it('keeps the first test of the run when two have failed as many runs', () => {
    expect(currentFailure([run(1, ['t1', 't2'])])).toEqual({ testId: 't1', runs: 1 });
  });
});

describe('failureStreak', () => {
  it('counts the latest runs in a row in which one same test failed', () => {
    expect(failureStreak([run(1, ['t2']), run(2, ['t1', 't2']), run(3, ['t2'])])).toBe(3);
  });

  it('is 0 without runs', () => {
    expect(failureStreak([])).toBe(0);
  });
});

describe('lastActivityAt', () => {
  it('is the latest change of the attempt or activity event, in milliseconds', () => {
    const events = [testEvents.paste('a', at(3)), testEvents.focusLost('a', at(4))];

    expect(lastActivityAt({ updatedAt: new Date(at(0)).toISOString() }, events)).toBe(at(3));
  });

  it('does not count the interventions of the tutor', () => {
    const events = [proactive(5)];

    expect(lastActivityAt({ updatedAt: new Date(at(0)).toISOString() }, events)).toBe(at(0));
  });
});

describe('lastBreakthrough', () => {
  it('is null without runs', () => {
    expect(lastBreakthrough([], 3)).toBeNull();
  });

  it('is the run that passed a test after it failed as many runs in a row as the threshold', () => {
    const events = [run(1, ['t1']), run(2, ['t1', 't2']), run(3, ['t1']), run(4, ['t2'])];

    expect(lastBreakthrough(events, 3)).toEqual({ at: at(4), failures: 3, testId: 't1' });
  });

  it('is null when the test passes below the threshold', () => {
    expect(lastBreakthrough([run(1, ['t1']), run(2, ['t1']), run(3)], 3)).toBeNull();
  });

  it('is null while the test keeps failing', () => {
    expect(lastBreakthrough([run(1, ['t1']), run(2, ['t1']), run(3, ['t1'])], 3)).toBeNull();
  });

  it('keeps the latest of several breakthroughs, with its own failures', () => {
    const events = [
      run(1, ['t1']),
      run(2, ['t1']),
      run(3, ['t1']),
      run(4, ['t2']),
      run(5, ['t2']),
      run(6, ['t2']),
      run(7, ['t2']),
      run(8),
    ];

    expect(lastBreakthrough(events, 3)).toEqual({ at: at(8), failures: 4, testId: 't2' });
  });

  it('sorts the runs by time and ignores other events', () => {
    const events = [run(3), testEvents.paste('a', at(0)), run(2, ['t1']), run(1, ['t1'])];

    expect(lastBreakthrough(events, 2)).toEqual({ at: at(3), failures: 2, testId: 't1' });
  });
});

describe('proactiveReasons', () => {
  /** Three runs in a row failing `t1`, a minute apart, from minute 1. */
  const threeFailures = [run(1, ['t1']), run(2, ['t1']), run(3, ['t1'])];

  it('gives nothing right after opening the exercise', () => {
    expect(proactiveReasons(input({ status: 'in_progress', now: at(0) }))).toEqual([]);
  });

  describe('failures', () => {
    it('steps in when a test fails in as many runs in a row as the threshold', () => {
      expect(proactiveReasons(input({ events: threeFailures, now: at(3) }))).toEqual(['failures']);
    });

    it('does not step in one failure before', () => {
      expect(proactiveReasons(input({ events: threeFailures.slice(0, 2), now: at(2) }))).toEqual(
        [],
      );
    });

    it('steps in again at 6 and 9 failures in a row, and not in between', () => {
      const runs = (count: number) =>
        Array.from({ length: count }, (_, index) => run(index * 4 + 1, ['t1']));
      // The runs are 4 minutes apart, so the cooldown has always passed
      const after = (count: number, interventions: AttemptEvent[]) =>
        proactiveReasons(
          input({ events: [...runs(count), ...interventions], now: at((count - 1) * 4 + 1) }),
        );
      const first = proactive(9.5, 'failures');
      const second = proactive(21.5, 'failures');

      expect(after(3, [])).toEqual(['failures']);
      expect(after(4, [first])).toEqual([]);
      expect(after(5, [first])).toEqual([]);
      expect(after(6, [first])).toEqual(['failures']);
      expect(after(8, [first, second])).toEqual([]);
      expect(after(9, [first, second])).toEqual(['failures']);
    });

    it('starts counting again once the test passes', () => {
      const events = [...threeFailures, run(4), run(5, ['t1'])];

      expect(proactiveReasons(input({ events, now: at(5) }))).toEqual([]);
    });
  });

  describe('idle', () => {
    it('steps in at the idle threshold since the last activity', () => {
      expect(proactiveReasons(input({ status: 'in_progress', now: at(4) }))).toEqual(['idle']);
    });

    it('does not step in one millisecond before', () => {
      expect(proactiveReasons(input({ status: 'in_progress', now: at(4) - 1 }))).toEqual([]);
    });

    it('counts a turn the student asked for as activity, as the live panel does (D-068)', () => {
      // A question at minute 3: the cooldown is over at 6, but they spoke with the tutor at 3
      const asked = input({ status: 'in_progress', lastTurnAt: at(3), now: at(6) });

      expect(proactiveReasons(asked)).toEqual([]);
      expect(proactiveReasons({ ...asked, now: at(7) })).toEqual(['idle']);
    });

    it('steps in once for each pause, until there is activity again', () => {
      const events = [proactive(4, 'idle')];

      expect(proactiveReasons(input({ status: 'in_progress', events, now: at(20) }))).toEqual([]);
      expect(
        proactiveReasons(
          input({
            status: 'in_progress',
            events: [...events, testEvents.paste('a', at(10))],
            now: at(14),
          }),
        ),
      ).toEqual(['idle']);
    });

    it('steps in on a pause after an episode of failures already taken care of', () => {
      const events = [...threeFailures, proactive(3, 'failures')];

      expect(proactiveReasons(input({ events, now: at(7) }))).toEqual(['idle']);
    });

    it('takes the slack off the threshold, as the server does', () => {
      const limits = { ...PROACTIVE_LIMITS, idleSlackMs: 30 * SECOND };

      expect(proactiveReasons(input({ status: 'in_progress', now: at(3.5) }), limits)).toEqual([
        'idle',
      ]);
    });
  });

  describe('achievement', () => {
    const passedIt = [...threeFailures, run(4)];

    it('celebrates the run that passes a test that had failed as many runs as the threshold', () => {
      expect(proactiveReasons(input({ events: passedIt, now: at(4) }))).toEqual(['achievement']);
    });

    it('does not celebrate a test that failed fewer runs', () => {
      const events = [run(1, ['t1']), run(2, ['t1']), run(3)];

      expect(proactiveReasons(input({ events, now: at(3) }))).toEqual([]);
    });

    it('celebrates only the latest run: a later one is no achievement', () => {
      const events = [...passedIt, run(5, ['t2'])];

      expect(proactiveReasons(input({ events, now: at(5) }))).toEqual([]);
    });

    it('celebrates once for each run that gets there', () => {
      const events = [...passedIt, proactive(4, 'achievement', true)];

      expect(proactiveReasons(input({ events, now: at(4) }))).toEqual([]);
    });

    it('does not wait for the cooldown, and celebrates a passed attempt too', () => {
      const celebrated = input({
        status: 'passed',
        events: [...passedIt, proactive(3, 'failures')],
        lastTurnAt: at(3.5),
        now: at(4),
      });

      expect(proactiveReasons(celebrated)).toEqual(['achievement']);
    });

    it('comes first when another test reaches its failures in the same run', () => {
      const events = [
        run(1, ['t1', 't2']),
        run(2, ['t1', 't2']),
        run(3, ['t1', 't2']),
        run(4, ['t2']),
      ];

      expect(proactiveReasons(input({ events, now: at(4) }))).toEqual(['achievement', 'failures']);
    });
  });

  describe('cooldown', () => {
    it('waits 3 minutes after a question or a hint', () => {
      const asked = input({ events: threeFailures, lastTurnAt: at(1), now: at(3) });

      expect(proactiveReasons(asked)).toEqual([]);
      expect(proactiveReasons({ ...asked, now: at(4) })).toEqual(['failures']);
    });

    it('waits 3 minutes after an intervention, also a silent one', () => {
      const events = [...threeFailures, proactive(1, 'idle', true)];

      expect(proactiveReasons(input({ events, now: at(3) }))).toEqual([]);
      expect(proactiveReasons(input({ events, now: at(4) }))).toEqual(['failures']);
    });

    it('takes the cooldown it is given', () => {
      const limits = { ...PROACTIVE_LIMITS, cooldownMs: 2 * MINUTE };
      const asked = input({ events: threeFailures, lastTurnAt: at(1), now: at(3) });

      expect(proactiveReasons(asked, limits)).toEqual(['failures']);
    });
  });

  describe('limit', () => {
    /** Help interventions long before the failures, so neither the cooldown nor an episode counts. */
    const helped = (count: number, old = 0) => [
      ...Array.from({ length: count - old }, (_, index) => proactive(-60 + index, 'idle')),
      ...Array.from({ length: old }, (_, index) => oldIntervention(-40 + index)),
    ];

    it('helps up to 5 times in an attempt', () => {
      expect(
        proactiveReasons(input({ events: [...helped(4), ...threeFailures], now: at(3) })),
      ).toEqual(['failures']);
      expect(
        proactiveReasons(input({ events: [...helped(5), ...threeFailures], now: at(3) })),
      ).toEqual([]);
    });

    it('counts the interventions recorded before they had a reason', () => {
      expect(
        proactiveReasons(input({ events: [...helped(5, 2), ...threeFailures], now: at(3) })),
      ).toEqual([]);
    });

    it('does not count the achievements, and still celebrates after the fifth help', () => {
      const celebrations = [proactive(-20, 'achievement'), proactive(-19, 'achievement')];

      expect(
        proactiveReasons(
          input({ events: [...helped(4), ...celebrations, ...threeFailures], now: at(3) }),
        ),
      ).toEqual(['failures']);
      expect(
        proactiveReasons(input({ events: [...helped(5), ...threeFailures, run(4)], now: at(4) })),
      ).toEqual(['achievement']);
    });
  });

  describe('attempts that need no help', () => {
    it('gives nothing once submitted', () => {
      const events = [...threeFailures, run(4)];

      expect(proactiveReasons(input({ status: 'submitted', events, now: at(30) }))).toEqual([]);
    });

    it('does not help a passed attempt', () => {
      expect(proactiveReasons(input({ status: 'passed', now: at(30) }))).toEqual([]);
    });
  });
});

describe('proactiveReason', () => {
  it('is the first reason', () => {
    const events = [
      run(1, ['t1', 't2']),
      run(2, ['t1', 't2']),
      run(3, ['t1', 't2']),
      run(4, ['t2']),
    ];

    expect(proactiveReason(input({ events, now: at(4) }))).toBe('achievement');
  });

  it('is null without any', () => {
    expect(proactiveReason(input())).toBeNull();
  });
});
