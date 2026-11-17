import type { LiveSnapshot } from '../../data/live-service';
import { testEvents as e } from '../../data/process-event-testing';
import { exerciseOverview } from './live-overview';
import { liveState } from './live-state';
import {
  ago,
  BLOCK_EXERCISES,
  GROUP_EXERCISES,
  NOW,
  STUDENTS,
  testAttempt,
  testRows,
  testSnapshot,
} from './live-testing';

const [ANA, BEA, CAI] = STUDENTS;
const [T1, T2, T3] = BLOCK_EXERCISES[0].tests.map((test) => test.id);

function overview(overrides: Partial<LiveSnapshot>, blockId: string | null = 'b1') {
  const snapshot = testSnapshot({ exercises: GROUP_EXERCISES, ...overrides });
  return exerciseOverview(liveState(snapshot), testRows(snapshot), blockId, NOW);
}

describe('exerciseOverview', () => {
  describe('with a block', () => {
    it('gives every student of the group once per exercise, by their latest attempt', () => {
      const { exercises } = overview({
        attempts: [
          testAttempt('a1', 'ana', { status: 'submitted' }),
          testAttempt('a2', 'ana', { number: 2, status: 'in_progress' }),
          testAttempt('b1', 'bea', { status: 'passed' }),
          testAttempt('b2', 'bea', { assignmentId: 'as2', status: 'tests_failed' }),
        ],
      });

      expect(exercises.map((item) => item.exercise)).toEqual(BLOCK_EXERCISES);
      expect(exercises[0]).toMatchObject({
        position: 1,
        total: 3,
        students: {
          not_started: [CAI],
          in_progress: [ANA],
          tests_failed: [],
          passed: [BEA],
          submitted: [],
        },
      });
      expect(exercises[1]).toMatchObject({
        position: 2,
        students: { tests_failed: [BEA], not_started: [ANA, CAI] },
      });
    });

    it('counts the students of the session working in other blocks, by block', () => {
      const { elsewhere } = overview({
        attempts: [
          testAttempt('a3', 'ana', { assignmentId: 'as3', updatedAt: ago(2) }),
          testAttempt('b3', 'bea', { assignmentId: 'as3', updatedAt: ago(20) }),
          testAttempt('c3', 'cai', { assignmentId: 'as3', updatedAt: ago(200) }),
        ],
      });

      expect(elsewhere).toEqual([{ blockId: 'b2', students: 2 }]);
    });

    it('has nobody elsewhere when everybody works in the block', () => {
      expect(
        overview({ attempts: [testAttempt('a1', 'ana', { updatedAt: ago(1) })] }).elsewhere,
      ).toEqual([]);
    });
  });

  describe('with the whole class', () => {
    const attempts = [
      testAttempt('a3', 'ana', { assignmentId: 'as3', updatedAt: ago(2) }),
      testAttempt('b3', 'bea', { assignmentId: 'as3', status: 'passed', updatedAt: ago(10) }),
      testAttempt('c1', 'cai', { updatedAt: ago(5) }),
      testAttempt('c2', 'cai', { assignmentId: 'as2', updatedAt: ago(300) }),
    ];

    it('gives the exercises with activity in the session, the one with most students first', () => {
      const { exercises, elsewhere } = overview({ attempts }, null);

      expect(exercises.map((item) => item.exercise.assignmentId)).toEqual(['as3', 'as1']);
      expect(exercises[0]).toMatchObject({
        position: 1,
        total: 2,
        students: { not_started: [], in_progress: [ANA], passed: [BEA] },
      });
      expect(exercises[1].total).toBe(1);
      expect(elsewhere).toEqual([]);
    });

    it('keeps the order of the snapshot on a tie', () => {
      const tie = [attempts[0], attempts[2]];

      expect(
        overview({ attempts: tie }, null).exercises.map((i) => i.exercise.assignmentId),
      ).toEqual(['as1', 'as3']);
    });
  });

  describe('the test that fails most', () => {
    const failing = (id: string, userId: string, updatedAt = ago(1)) =>
      testAttempt(id, userId, { status: 'tests_failed', updatedAt });

    it('in class, is the one most students fail now, with who they are', () => {
      const { exercises } = overview({
        attempts: [failing('a1', 'ana'), failing('b1', 'bea'), failing('c1', 'cai')],
        events: [
          e.run('a1', ago(9), [T1]),
          e.run('a1', ago(5), [T2, T3]),
          e.run('b1', ago(4), [T3, T2]),
          e.run('c1', ago(3), [T1]),
        ],
      });

      expect(exercises[0].topFailure).toEqual({
        test: BLOCK_EXERCISES[0].tests[1],
        students: [ANA, BEA],
      });
    });

    it('in class, only counts the current attempts of the session', () => {
      const { exercises } = overview({
        attempts: [failing('a1', 'ana'), failing('b1', 'bea', ago(3000))],
        events: [e.run('a1', ago(2), [T3]), e.run('b1', ago(3000), [T2])],
      });

      expect(exercises[0].topFailure).toEqual({
        test: BLOCK_EXERCISES[0].tests[2],
        students: [ANA],
      });
    });

    it('out of class, is the one most failed in the latest attempts with failures', () => {
      const { exercises } = overview({
        attempts: [
          // Out of order: the latest attempt is the one with the highest number
          testAttempt('a2', 'ana', { number: 2, status: 'tests_failed', updatedAt: ago(3000) }),
          testAttempt('a1', 'ana', { status: 'submitted', updatedAt: ago(4000) }),
          failing('b1', 'bea', ago(3000)),
          testAttempt('c1', 'cai', { status: 'passed', updatedAt: ago(3000) }),
        ],
        events: [
          e.run('a1', ago(4000), [T1]),
          e.run('a2', ago(3000), [T2]),
          e.run('b1', ago(3000), [T2, T3]),
          e.run('b1', ago(3010), [T1]),
          e.run('c1', ago(3000)),
        ],
      });

      expect(exercises[0].topFailure).toEqual({
        test: BLOCK_EXERCISES[0].tests[1],
        students: [ANA, BEA],
      });
    });

    it('is the first in order on a tie, and none without failures or runs', () => {
      const tie = overview({
        attempts: [failing('a1', 'ana'), failing('b1', 'bea')],
        events: [e.run('a1', ago(2), [T3]), e.run('b1', ago(2), [T2])],
      });
      const none = overview({ attempts: [failing('a1', 'ana', ago(3000))] });

      expect(tie.exercises[0].topFailure?.test.id).toBe(T2);
      expect(none.exercises[0].topFailure).toBeNull();
    });
  });
});
