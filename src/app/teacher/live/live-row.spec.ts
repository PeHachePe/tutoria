import type { Attempt } from '../../data/attempt';
import type { ProcessEvent } from '../../data/process-event';
import { testEvents as e } from '../../data/process-event-testing';
import { liveRow } from './live-row';
import type { StudentActivity } from './live-state';
import { ago, BLOCK_EXERCISES, NOW, STUDENTS, testAttempt } from './live-testing';

function activity(overrides: Partial<StudentActivity> = {}): StudentActivity {
  return { student: STUDENTS[0], attempts: [], events: [], ...overrides };
}

const row = (overrides: Partial<StudentActivity> = {}, classActive = true) =>
  liveRow(activity(overrides), BLOCK_EXERCISES, NOW, classActive);

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
      lastActivity: null,
      active: false,
      signal: null,
      submitted: 0,
      repeated: 0,
      breakthrough: null,
      patterns: [{ kind: 'not_started' }],
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
      lastActivity: ago(2),
      active: true,
      signal: null,
      submitted: 1,
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
      active: false,
      minutes: 20,
      signal: null,
      patterns: [{ kind: 'inactive' }],
    });
  });

  it('marks practice after a submission as repeating', () => {
    const attempts = [
      testAttempt('a1', 'ana', { status: 'submitted', updatedAt: ago(40) }),
      testAttempt('a2', 'ana', { number: 2, updatedAt: ago(1) }),
    ];

    expect(row({ attempts })).toMatchObject({ repeating: true, repeated: 1, submitted: 1 });
  });

  it('ignores an attempt of an assignment that left the block', () => {
    const attempt = testAttempt('a1', 'ana', { assignmentId: 'gone', updatedAt: ago(1) });

    expect(row({ attempts: [attempt] })).toMatchObject({
      exercise: null,
      position: null,
      signal: null,
    });
  });

  describe('signals', () => {
    const signalOf = (attempt: Attempt, events: ProcessEvent[] = []) =>
      row({ attempts: [attempt], events }).signal;

    it('says a student is stuck on repeated failures, since the run that reached the threshold', () => {
      const attempt = testAttempt('a1', 'ana', { status: 'tests_failed' });
      const events = [4, 3, 2, 1].map((m) => e.run('a1', ago(m), ['t1']));

      expect(signalOf(attempt, events)).toEqual({
        kind: 'stuck_failures',
        failures: 4,
        askedForHints: false,
        since: ago(2),
      });
    });

    it('tells whether the student stuck on failures asked for hints', () => {
      const attempt = testAttempt('a1', 'ana', { status: 'tests_failed' });
      const events = [e.hint('a1', ago(5)), ...[3, 2, 1].map((m) => e.run('a1', ago(m), ['t1']))];

      expect(signalOf(attempt, events)).toMatchObject({ askedForHints: true, since: ago(1) });
    });

    it('says the hints ran out when the student fails after the last level', () => {
      const attempt = testAttempt('a1', 'ana', { status: 'tests_failed' });
      const events = [e.hint('a1', ago(3), 3), e.run('a1', ago(2), ['t1'])];

      expect(signalOf(attempt, events)).toEqual({ kind: 'hints_exhausted', since: ago(2) });
    });

    it('does not say so while the tests after the last hint pass or are still open', () => {
      const failing = testAttempt('a1', 'ana', { status: 'tests_failed', updatedAt: ago(1) });
      const working = testAttempt('a1', 'ana', { updatedAt: ago(1) });

      expect(signalOf(failing, [e.hint('a1', ago(3), 3), e.run('a1', ago(2))])).toBeNull();
      expect(signalOf(working, [e.hint('a1', ago(3), 3), e.run('a1', ago(2), ['t1'])])).toBeNull();
    });

    it('says a student asks for hints one after another without trying them', () => {
      const attempt = testAttempt('a1', 'ana');
      const events = [
        e.run('a1', ago(4), ['t1']),
        e.hint('a1', ago(3)),
        e.hint('a1', ago(2), 2),
        e.hint('a1', ago(1), 2),
      ];

      expect(signalOf(attempt, events)).toEqual({ kind: 'hint_rush', hints: 3, since: ago(1) });
    });

    it('counts the hints in a row from the start when the student never ran the tests', () => {
      const attempt = testAttempt('a1', 'ana');
      const events = [3, 2, 1].map((m) => e.hint('a1', ago(m)));

      expect(signalOf(attempt, events)).toMatchObject({ kind: 'hint_rush', hints: 3 });
    });

    it('says a student is stuck when idle, since the idle threshold passed', () => {
      const attempt = testAttempt('a1', 'ana', { updatedAt: ago(6) });

      expect(signalOf(attempt)).toEqual({ kind: 'stuck_idle', minutes: 6, since: ago(2) });
    });

    it('says a student who left the window is away rather than stuck', () => {
      const attempt = testAttempt('a1', 'ana', { updatedAt: ago(9) });

      expect(signalOf(attempt, [e.focusLost('a1', ago(3))])).toEqual({
        kind: 'away',
        minutes: 3,
        since: ago(3),
      });
    });

    it('gives no signal to a student who is fine or has finished', () => {
      expect(signalOf(testAttempt('a1', 'ana', { updatedAt: ago(1) }))).toBeNull();
      expect(
        signalOf(testAttempt('a1', 'ana', { status: 'passed', updatedAt: ago(9) }), [
          e.run('a1', ago(9)),
        ]),
      ).toBeNull();
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
