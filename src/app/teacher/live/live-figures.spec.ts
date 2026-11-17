import { testEvents as e } from '../../data/process-event-testing';
import { liveFigures } from './live-figures';
import { liveState } from './live-state';
import { ago, GROUP_EXERCISES, NOW, testAttempt, testRows, testSnapshot } from './live-testing';

const submitted = (id: string, userId: string, assignmentId: string, at: number) =>
  testAttempt(id, userId, { assignmentId, status: 'submitted', updatedAt: at, finishedAt: at });

function figures(snapshot = testSnapshot(), blockId: string | null = 'b1', needHelp = 0) {
  return liveFigures(liveState(snapshot), testRows(snapshot), blockId, needHelp, NOW);
}

describe('liveFigures', () => {
  describe('live, with a block', () => {
    // Ana has the block submitted and works; Bea is stopped on it; Cai has not come
    const snapshot = testSnapshot({
      exercises: GROUP_EXERCISES,
      attempts: [
        submitted('a1', 'ana', 'as1', ago(20)),
        submitted('a2', 'ana', 'as2', ago(1)),
        testAttempt('b1', 'bea', { updatedAt: ago(12) }),
      ],
      events: [e.submit('a2', ago(1))],
    });

    it('counts who works, who stopped and who has not come, and the queue', () => {
      expect(figures(snapshot, 'b1', 2)).toMatchObject({
        inClass: true,
        students: 3,
        working: 1,
        stopped: 1,
        absent: 1,
        needHelp: 2,
        lastActivity: ago(1),
      });
    });

    it('counts who has the block whole submitted and the progress of the block', () => {
      expect(figures(snapshot)).toMatchObject({
        finishedIds: new Set(['ana']),
        finished: 1,
        // 2 submitted out of 3 students × 2 exercises
        progress: 33,
        startedIds: new Set(['ana', 'bea']),
      });
    });
  });

  describe('live, with the whole class', () => {
    const snapshot = testSnapshot({
      exercises: GROUP_EXERCISES,
      attempts: [
        submitted('a1', 'ana', 'as1', ago(30)),
        submitted('a3', 'ana', 'as3', ago(2)),
        submitted('b3', 'bea', 'as3', ago(90)),
      ],
      events: [e.submit('a1', ago(30)), e.submit('a3', ago(2)), e.submit('b3', ago(90))],
    });

    it('counts the submissions of the session and who made them', () => {
      expect(figures(snapshot, null)).toMatchObject({
        finished: 2,
        finishedIds: new Set(['ana']),
        progress: null,
        startedIds: new Set(),
      });
    });
  });

  describe('out of class', () => {
    const snapshot = testSnapshot({
      exercises: GROUP_EXERCISES,
      attempts: [
        submitted('a1', 'ana', 'as1', ago(3000)),
        submitted('a2', 'ana', 'as2', ago(2900)),
        testAttempt('b1', 'bea', { updatedAt: ago(2000) }),
      ],
    });

    it('says nobody is in class, with the accumulated figures of the block', () => {
      expect(figures(snapshot)).toMatchObject({
        inClass: false,
        working: 0,
        stopped: 0,
        absent: 3,
        startedIds: new Set(['ana', 'bea']),
        finished: 1,
        progress: 33,
        lastActivity: ago(2000),
      });
    });

    it('has no latest activity without any attempt', () => {
      expect(figures().lastActivity).toBeNull();
    });
  });

  it('has no progress with a block without exercises or a group without students', () => {
    const empty = testSnapshot({ exercises: GROUP_EXERCISES, students: [] });

    expect(figures(testSnapshot({ exercises: GROUP_EXERCISES }), 'b9')).toMatchObject({
      progress: null,
      finished: 0,
    });
    expect(figures(empty).progress).toBeNull();
  });
});
