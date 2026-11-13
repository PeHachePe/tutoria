import type { Attempt, StoredAttemptStatus } from '../data/attempt';
import type { StuckThresholds } from '../data/exercise';
import type { ProcessEvent } from '../data/process-event';
import { failureStreak, isStuck, lastActivityAt, stuckReason } from './is-stuck';

const NOW = Date.parse('2026-11-07T10:00:00.000Z');
const MINUTE = 60_000;
const THRESHOLDS: StuckThresholds = { maxRepeatedFailures: 3, maxIdleMinutes: 4 };

/** ISO timestamp `minutes` before NOW. */
function ago(minutes: number): string {
  return new Date(NOW - minutes * MINUTE).toISOString();
}

function attempt(
  status: StoredAttemptStatus = 'tests_failed',
  updatedAt = ago(1),
): Pick<Attempt, 'status' | 'updatedAt'> {
  return { status, updatedAt };
}

let nextId = 0;

function run(minutesAgo: number, failedTestIds: string[]): ProcessEvent {
  return {
    id: `e${++nextId}`,
    attemptId: 'a1',
    type: 'run',
    timestamp: ago(minutesAgo),
    detail: { passed: 5 - failedTestIds.length, failed: failedTestIds.length, failedTestIds },
  };
}

function event(
  type: 'paste' | 'focus_lost' | 'focus_gained' | 'proactive_intervention' | 'hint_requested',
  minutesAgo: number,
): ProcessEvent {
  const base = { id: `e${++nextId}`, attemptId: 'a1', timestamp: ago(minutesAgo) };
  switch (type) {
    case 'paste':
      return { ...base, type, detail: { length: 40 } };
    case 'proactive_intervention':
      return { ...base, type, detail: { silent: false } };
    case 'hint_requested':
      return { ...base, type, detail: { level: 1 } };
    case 'focus_gained':
      return { ...base, type, detail: { awayMs: 60_000 } };
    default:
      return { ...base, type, detail: null };
  }
}

describe('isStuck', () => {
  it('is not stuck right after opening the exercise', () => {
    expect(isStuck(attempt('in_progress', ago(0)), [], THRESHOLDS, NOW)).toBe(false);
  });

  describe('repeated failures of the same test', () => {
    it('is stuck when a test fails in as many consecutive runs as the threshold', () => {
      const events = [run(3, ['t1']), run(2, ['t1', 't2']), run(1, ['t1'])];

      expect(isStuck(attempt(), events, THRESHOLDS, NOW)).toBe(true);
    });

    it('is not stuck one failure below the threshold', () => {
      const events = [run(2, ['t1']), run(1, ['t1'])];

      expect(isStuck(attempt(), events, THRESHOLDS, NOW)).toBe(false);
    });

    it('does not add up failures of different tests', () => {
      const events = [run(3, ['t1']), run(2, ['t2']), run(1, ['t3'])];

      expect(isStuck(attempt(), events, THRESHOLDS, NOW)).toBe(false);
    });

    it('is not stuck once the test passes in the latest run', () => {
      const events = [run(4, ['t1']), run(3, ['t1']), run(2, ['t1']), run(1, ['t2'])];

      expect(isStuck(attempt(), events, THRESHOLDS, NOW)).toBe(false);
    });

    it('starts counting again after the test passes', () => {
      const events = [run(5, ['t1']), run(4, ['t1']), run(3, []), run(2, ['t1']), run(1, ['t1'])];

      expect(isStuck(attempt(), events, THRESHOLDS, NOW)).toBe(false);
    });

    it('ignores the events between runs', () => {
      const events = [
        run(3, ['t1']),
        event('paste', 2.5),
        run(2, ['t1']),
        event('hint_requested', 1.5),
        run(1, ['t1']),
      ];

      expect(isStuck(attempt(), events, THRESHOLDS, NOW)).toBe(true);
    });

    it('sorts the events by time before counting', () => {
      const events = [run(1, ['t1']), run(4, []), run(2, ['t1']), run(3, ['t1'])];

      expect(isStuck(attempt(), events, THRESHOLDS, NOW)).toBe(true);
    });

    it('is stuck after a single failure with a threshold of 1', () => {
      expect(
        isStuck(attempt(), [run(1, ['t1'])], { ...THRESHOLDS, maxRepeatedFailures: 1 }, NOW),
      ).toBe(true);
    });
  });

  describe('inactivity', () => {
    it('is stuck exactly at the idle threshold since the last change of the attempt', () => {
      expect(isStuck(attempt('in_progress', ago(4)), [], THRESHOLDS, NOW)).toBe(true);
    });

    it('is not stuck one millisecond before the idle threshold', () => {
      const updatedAt = new Date(NOW - 4 * MINUTE + 1).toISOString();

      expect(isStuck(attempt('in_progress', updatedAt), [], THRESHOLDS, NOW)).toBe(false);
    });

    it.each(['paste', 'focus_gained', 'hint_requested'] as const)(
      'counts %s as activity',
      (type) => {
        const events = [event(type, 1)];

        expect(isStuck(attempt('in_progress', ago(10)), events, THRESHOLDS, NOW)).toBe(false);
      },
    );

    it('counts a run as activity', () => {
      expect(isStuck(attempt('tests_failed', ago(10)), [run(1, [])], THRESHOLDS, NOW)).toBe(false);
    });

    it.each(['focus_lost', 'proactive_intervention'] as const)(
      'does not count %s as activity',
      (type) => {
        const events = [event(type, 1)];

        expect(isStuck(attempt('in_progress', ago(10)), events, THRESHOLDS, NOW)).toBe(true);
      },
    );

    it('uses the latest change of the attempt when it is newer than the events', () => {
      const events = [event('paste', 10)];

      expect(isStuck(attempt('in_progress', ago(1)), events, THRESHOLDS, NOW)).toBe(false);
    });
  });

  describe('finished attempts', () => {
    it.each(['passed', 'submitted'] as const)('is never stuck when %s', (status) => {
      const events = [run(13, ['t1']), run(12, ['t1']), run(11, ['t1'])];

      expect(isStuck(attempt(status, ago(10)), events, THRESHOLDS, NOW)).toBe(false);
    });
  });
});

describe('stuckReason', () => {
  it('says the repeated failures come first when both thresholds are reached', () => {
    const events = [run(13, ['t1']), run(12, ['t1']), run(11, ['t1'])];

    expect(stuckReason(attempt('tests_failed', ago(11)), events, THRESHOLDS, NOW)).toBe('failures');
  });

  it('says the student is idle when only the idle threshold is reached', () => {
    expect(stuckReason(attempt('in_progress', ago(5)), [], THRESHOLDS, NOW)).toBe('idle');
  });

  it('is null when the student is not stuck', () => {
    expect(stuckReason(attempt('in_progress', ago(1)), [], THRESHOLDS, NOW)).toBeNull();
  });
});

describe('lastActivityAt', () => {
  it('is the latest change of the attempt or activity event, in milliseconds', () => {
    const events = [event('paste', 2), event('focus_lost', 1)];

    expect(lastActivityAt(attempt('in_progress', ago(5)), events)).toBe(NOW - 2 * MINUTE);
  });
});

describe('failureStreak', () => {
  it('counts the latest runs in a row in which one same test failed', () => {
    expect(failureStreak([run(3, ['t2']), run(2, ['t1', 't2']), run(1, ['t2'])])).toBe(3);
  });

  it('is 0 without runs', () => {
    expect(failureStreak([])).toBe(0);
  });
});
