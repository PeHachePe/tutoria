import { testEvents as e } from '../../data/process-event-testing';
import { exerciseOverview } from './live-overview';
import { liveState } from './live-state';
import { ago, BLOCK_EXERCISES, testAttempt, testSnapshot } from './live-testing';

const [T1, T2, T3] = BLOCK_EXERCISES[0].tests.map((test) => test.id);

describe('exerciseOverview', () => {
  it('counts every student once per exercise, by their latest attempt', () => {
    const state = liveState(
      testSnapshot({
        attempts: [
          testAttempt('a1', 'ana', { status: 'submitted' }),
          testAttempt('a2', 'ana', { number: 2, status: 'in_progress' }),
          testAttempt('a3', 'bea', { status: 'passed' }),
          testAttempt('a4', 'bea', { assignmentId: 'as2', status: 'tests_failed' }),
        ],
      }),
    );

    const [first, second] = exerciseOverview(state);

    expect(first.counts).toEqual({
      not_started: 1,
      in_progress: 1,
      tests_failed: 0,
      passed: 1,
      submitted: 0,
    });
    expect(first.students).toBe(3);
    expect(second.counts.tests_failed).toBe(1);
    expect(second.counts.not_started).toBe(2);
  });

  it('finds the test most students fail in their latest run, the first on a tie', () => {
    const failing = (id: string) =>
      testAttempt(id, id === 'a3' ? 'cai' : id === 'a2' ? 'bea' : 'ana', {
        status: 'tests_failed',
      });
    const state = liveState(
      testSnapshot({
        attempts: [failing('a1'), failing('a2'), failing('a3')],
        events: [
          e.run('a1', ago(9), [T1]),
          e.run('a1', ago(5), [T2, T3]),
          e.run('a2', ago(4), [T3, T2]),
          e.run('a3', ago(3), [T1]),
        ],
      }),
    );

    expect(exerciseOverview(state)[0].topFailure).toEqual({
      test: BLOCK_EXERCISES[0].tests[1],
      students: 2,
    });
  });

  it('has no failure when nobody fails or a run is missing', () => {
    const state = liveState(
      testSnapshot({
        attempts: [
          testAttempt('a1', 'ana', { status: 'tests_failed' }),
          testAttempt('a2', 'bea', { status: 'passed' }),
        ],
        events: [e.run('a2', ago(2), [])],
      }),
    );

    expect(exerciseOverview(state)[0].topFailure).toBeNull();
  });

  it('reads the run of the latest attempt, not of an earlier one', () => {
    const state = liveState(
      testSnapshot({
        attempts: [
          testAttempt('a1', 'ana', { status: 'submitted' }),
          testAttempt('a2', 'ana', { number: 2, status: 'tests_failed' }),
        ],
        events: [e.run('a1', ago(9), [T1]), e.run('a2', ago(2), [T2])],
      }),
    );

    expect(exerciseOverview(state)[0].topFailure?.test.id).toBe(T2);
  });
});
