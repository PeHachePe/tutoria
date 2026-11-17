import { testEvents as e } from '../../data/process-event-testing';
import { liveRow } from './live-row';
import type { StudentActivity } from './live-state';
import {
  ago,
  BLOCK_EXERCISES,
  GROUP_EXERCISES,
  NOW,
  OTHER_BLOCK_EXERCISES,
  STUDENTS,
  testAttempt,
  testInteraction,
} from './live-testing';

function activity(overrides: Partial<StudentActivity> = {}): StudentActivity {
  return { student: STUDENTS[0], attempts: [], events: [], interactions: [], ...overrides };
}

const row = (overrides: Partial<StudentActivity> = {}) =>
  liveRow(activity(overrides), GROUP_EXERCISES, NOW);

describe('liveRow', () => {
  it('describes a student who has not opened anything', () => {
    expect(row()).toMatchObject({
      attempt: null,
      exercise: null,
      position: null,
      repeating: false,
      status: 'not_started',
      minutes: null,
      hints: 0,
      hintLevel: null,
      tests: null,
      failedTestIds: [],
      failingTest: null,
      lastActivity: null,
      work: 'absent',
      away: null,
      reason: null,
      repeated: 0,
      breakthrough: null,
      patterns: [],
    });
  });

  it('reads the indicators of the attempt that changed last', () => {
    const old = testAttempt('a1', 'ana', { status: 'submitted', finishedAt: ago(30) });
    const current = testAttempt('a2', 'ana', { assignmentId: 'as2', startedAt: ago(12) });
    const events = [
      e.run('a1', ago(31)),
      e.hint('a2', ago(10), 1),
      e.hint('a2', ago(8), 2),
      e.paste('a2', ago(7)),
      e.focusLost('a2', ago(6)),
      e.focusGained('a2', ago(5)),
      e.run('a2', ago(2), ['t1', 't2'], 6),
    ];

    expect(row({ attempts: [old, current], events })).toMatchObject({
      attempt: current,
      exercise: BLOCK_EXERCISES[1],
      position: 2,
      status: 'in_progress',
      minutes: 12,
      hints: 2,
      hintLevel: 2,
      pastes: 1,
      focusLosses: 1,
      tests: { passed: 4, total: 6 },
      failedTestIds: ['t1', 't2'],
      lastActivity: ago(2),
      work: 'working',
      away: null,
      reason: null,
      patterns: [],
    });
  });

  it('counts the time of a submitted attempt until its submission', () => {
    const attempt = testAttempt('a1', 'ana', {
      status: 'submitted',
      startedAt: ago(25),
      updatedAt: ago(5),
      finishedAt: ago(5),
    });

    expect(row({ attempts: [attempt] }).minutes).toBe(20);
  });

  it('leaves an old attempt out of the session, with its time until its last activity', () => {
    const attempt = testAttempt('a1', 'ana', { startedAt: ago(200), updatedAt: ago(180) });

    expect(row({ attempts: [attempt] })).toMatchObject({
      work: 'absent',
      minutes: 20,
      reason: null,
      patterns: [],
    });
  });

  it('marks practice after a submission as repeating', () => {
    const attempts = [
      testAttempt('a1', 'ana', { status: 'submitted', updatedAt: ago(40) }),
      testAttempt('a2', 'ana', { number: 2, updatedAt: ago(1) }),
    ];

    expect(row({ attempts })).toMatchObject({ repeating: true, repeated: 1 });
  });

  it('ignores an attempt of an assignment that left the group', () => {
    const attempt = testAttempt('a1', 'ana', { assignmentId: 'gone', updatedAt: ago(1) });

    expect(row({ attempts: [attempt] })).toMatchObject({
      exercise: null,
      position: null,
      reason: null,
      failingTest: null,
    });
  });

  it('takes an attempt of another block, with its position in that block', () => {
    const attempts = [
      testAttempt('a1', 'ana', { updatedAt: ago(20) }),
      testAttempt('a3', 'ana', { assignmentId: 'as3', updatedAt: ago(1) }),
    ];

    expect(row({ attempts })).toMatchObject({
      attempt: attempts[1],
      exercise: OTHER_BLOCK_EXERCISES[0],
      position: 1,
    });
  });

  describe('last activity', () => {
    const attempt = testAttempt('a1', 'ana', { updatedAt: ago(30) });

    it('counts asking the tutor as activity', () => {
      const question = testInteraction('a1', ago(2), { trigger: 'question' });

      expect(row({ attempts: [attempt], interactions: [question] })).toMatchObject({
        lastActivity: ago(2),
        work: 'working',
      });
    });

    it('does not count an intervention of the tutor or leaving the window', () => {
      const proactive = testInteraction('a1', ago(2), { trigger: 'proactive' });
      const events = [e.proactive('a1', ago(2)), e.focusLost('a1', ago(1))];

      expect(row({ attempts: [attempt], events, interactions: [proactive] })).toMatchObject({
        lastActivity: ago(30),
        work: 'stopped',
      });
    });

    it('picks the attempt of the latest question to the tutor', () => {
      const other = testAttempt('a2', 'ana', { assignmentId: 'as2', updatedAt: ago(10) });
      const question = testInteraction('a1', ago(3), { trigger: 'question' });

      expect(row({ attempts: [attempt, other], interactions: [question] }).attempt).toBe(attempt);
    });
  });

  describe('work', () => {
    it('is stopped out of the window, since when it left', () => {
      const attempt = testAttempt('a1', 'ana', { updatedAt: ago(2) });

      expect(row({ attempts: [attempt], events: [e.focusLost('a1', ago(1))] })).toMatchObject({
        work: 'stopped',
        away: ago(1),
      });
    });

    it('does not say a student out of the session is away', () => {
      const attempt = testAttempt('a1', 'ana', { updatedAt: ago(90) });

      expect(row({ attempts: [attempt], events: [e.focusLost('a1', ago(89))] })).toMatchObject({
        work: 'absent',
        away: null,
      });
    });
  });

  it('says which test to look at', () => {
    const attempt = testAttempt('a1', 'ana', { status: 'tests_failed', updatedAt: ago(1) });
    const events = [e.run('a1', ago(2), ['e1-t3']), e.run('a1', ago(1), ['e1-t2', 'e1-t3'])];

    expect(row({ attempts: [attempt], events })).toMatchObject({
      failedTestIds: ['e1-t2', 'e1-t3'],
      failingTest: BLOCK_EXERCISES[0].tests[2],
    });
  });

  describe('reason', () => {
    const failing = [4, 3, 2].map((m) => e.run('a1', ago(m), ['e1-t1']));

    it('says why a student of the session needs the teacher', () => {
      const attempt = testAttempt('a1', 'ana', { status: 'tests_failed', updatedAt: ago(2) });

      expect(row({ attempts: [attempt], events: failing }).reason).toMatchObject({
        kind: 'stuck_failures',
        failures: 3,
      });
    });

    it('reads the tutor interactions of the attempt', () => {
      const attempt = testAttempt('a1', 'ana', { updatedAt: ago(9) });
      const stuck = [5, 3].map((m) =>
        testInteraction('a1', ago(m), { trigger: 'question', studentMessage: 'no sé seguir' }),
      );

      expect(row({ attempts: [attempt], interactions: stuck }).reason).toMatchObject({
        kind: 'chat_stuck',
      });
    });

    it('keeps the reason of a student who left the window', () => {
      const attempt = testAttempt('a1', 'ana', { status: 'tests_failed', updatedAt: ago(2) });
      const events = [...failing, e.focusLost('a1', ago(1))];

      expect(row({ attempts: [attempt], events })).toMatchObject({
        work: 'stopped',
        reason: { kind: 'stuck_failures' },
      });
    });

    it('gives no reason out of the session', () => {
      const attempt = testAttempt('a1', 'ana', { status: 'tests_failed', updatedAt: ago(90) });
      const old = [93, 92, 91].map((m) => e.run('a1', ago(m), ['e1-t1']));

      expect(row({ attempts: [attempt], events: old }).reason).toBeNull();
    });
  });

  describe('breakthrough', () => {
    const failing = [5, 4, 3].map((m) => e.run('a1', ago(m), ['t1']));

    it('keeps a breakthrough of the session', () => {
      const attempt = testAttempt('a1', 'ana', { status: 'passed', updatedAt: ago(2) });

      expect(
        row({ attempts: [attempt], events: [...failing, e.run('a1', ago(2))] }).breakthrough,
      ).toEqual({ at: ago(2), failures: 3 });
    });

    it('forgets one older than the session', () => {
      const attempt = testAttempt('a1', 'ana', { status: 'passed', updatedAt: ago(1) });
      const old = [93, 92, 91].map((m) => e.run('a1', ago(m), ['t1']));

      expect(
        row({ attempts: [attempt], events: [...old, e.run('a1', ago(90))] }).breakthrough,
      ).toBeNull();
    });
  });

  it('passes the patterns of the session events', () => {
    const attempt = testAttempt('a1', 'ana', { status: 'submitted', updatedAt: ago(1) });
    const events = [e.paste('a1', ago(3), 500), e.submit('a1', ago(1))];

    expect(row({ attempts: [attempt], events }).patterns).toEqual([
      { kind: 'paste_submit', chars: 500, runs: 0 },
    ]);
  });
});
