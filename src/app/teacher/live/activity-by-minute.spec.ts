import { testEvents as e } from '../../data/process-event-testing';
import { activityByMinute, LIVE_ACTIVITY_MINUTES } from './activity-by-minute';
import { liveState } from './live-state';
import { MINUTE, NOW, testAttempt, testSnapshot } from './live-testing';

/** NOW falls on a whole minute: the current minute starts there. */
const IN_MINUTE = NOW + 20_000;

describe('activityByMinute', () => {
  it(`has a minute for each of the last ${LIVE_ACTIVITY_MINUTES}, the current one last`, () => {
    const minutes = activityByMinute(liveState(testSnapshot()), IN_MINUTE);

    expect(minutes).toHaveLength(LIVE_ACTIVITY_MINUTES);
    expect(minutes.at(-1)).toEqual({ start: NOW, runs: 0, hints: 0 });
    expect(minutes[0].start).toBe(NOW - (LIVE_ACTIVITY_MINUTES - 1) * MINUTE);
  });

  it('counts the runs and the hints of every student in their minute', () => {
    const state = liveState(
      testSnapshot({
        attempts: [testAttempt('a1', 'ana'), testAttempt('a2', 'bea')],
        events: [
          e.run('a1', NOW + 1_000),
          e.run('a2', NOW + 59_000),
          e.hint('a2', NOW + 5_000),
          e.run('a1', NOW - 1_000),
          e.hint('a1', NOW - 2 * MINUTE),
          e.paste('a1', NOW),
          e.submit('a1', NOW),
        ],
      }),
    );

    const minutes = activityByMinute(state, IN_MINUTE, 3);

    expect(minutes).toEqual([
      { start: NOW - 2 * MINUTE, runs: 0, hints: 1 },
      { start: NOW - MINUTE, runs: 1, hints: 0 },
      { start: NOW, runs: 2, hints: 1 },
    ]);
  });

  it('leaves out what is older than the chart or comes from a clock ahead', () => {
    const state = liveState(
      testSnapshot({
        attempts: [testAttempt('a1', 'ana')],
        events: [e.run('a1', NOW - 3 * MINUTE), e.run('a1', NOW + 2 * MINUTE)],
      }),
    );

    expect(activityByMinute(state, IN_MINUTE, 3).every(({ runs }) => runs === 0)).toBe(true);
  });
});
