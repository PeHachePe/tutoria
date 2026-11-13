import { testEvents as e } from '../../data/process-event-testing';
import { FEED_SIZE, liveFeed, RECOVERY_FAILURES } from './live-feed';
import { liveState } from './live-state';
import { ago, BLOCK_EXERCISES, NOW, STUDENTS, testAttempt, testSnapshot } from './live-testing';

const [T1, T2, T3] = BLOCK_EXERCISES[0].tests.map((test) => test.id);

describe('liveFeed', () => {
  it('tells who moved on, passed every test and submitted, the latest first', () => {
    const state = liveState(
      testSnapshot({
        attempts: [
          testAttempt('a1', 'ana', { startedAt: ago(20), status: 'submitted' }),
          testAttempt('a2', 'bea', { startedAt: ago(5), assignmentId: 'as2', number: 2 }),
        ],
        events: [e.run('a1', ago(12), [T1]), e.run('a1', ago(8)), e.submit('a1', ago(6))],
      }),
    );

    expect(liveFeed(state, NOW)).toEqual([
      expect.objectContaining({
        kind: 'started',
        id: 'start-a2',
        student: STUDENTS[1],
        attemptId: 'a2',
        position: 2,
        practice: true,
        at: ago(5),
      }),
      expect.objectContaining({ kind: 'submitted', attemptId: 'a1', position: 1, at: ago(6) }),
      expect.objectContaining({ kind: 'all_passed', practice: false, at: ago(8) }),
    ]);
  });

  it('tells who starts a later exercise or repeats the first, not who opens the first', () => {
    const state = liveState(
      testSnapshot({
        attempts: [
          testAttempt('a1', 'ana', { startedAt: ago(9) }),
          testAttempt('a2', 'bea', { startedAt: ago(8), assignmentId: 'as2' }),
          testAttempt('a3', 'cai', { startedAt: ago(7), number: 2 }),
        ],
      }),
    );

    expect(liveFeed(state, NOW).map((entry) => entry.id)).toEqual(['start-a3', 'start-a2']);
  });

  it('passing every test counts once, until a run fails again', () => {
    const state = liveState(
      testSnapshot({
        attempts: [testAttempt('a1', 'ana')],
        events: [
          e.run('a1', ago(9)),
          e.run('a1', ago(8)),
          e.run('a1', ago(7), [T1]),
          e.run('a1', ago(6)),
        ],
      }),
    );

    expect(
      liveFeed(state, NOW)
        .filter((entry) => entry.kind === 'all_passed')
        .map((entry) => entry.at),
    ).toEqual([ago(6), ago(9)]);
  });

  it('tells when a test that failed several runs in a row passes, with how many', () => {
    const failures = Array.from({ length: RECOVERY_FAILURES + 1 }, (_, index) =>
      e.run('a1', ago(20 - index), [T1, T2]),
    );
    const state = liveState(
      testSnapshot({
        attempts: [testAttempt('a1', 'ana', { startedAt: ago(40) })],
        events: [...failures, e.run('a1', ago(10), [T2, T3])],
      }),
    );

    expect(liveFeed(state, NOW)).toEqual([
      expect.objectContaining({ kind: 'recovered', failures: RECOVERY_FAILURES + 1, at: ago(10) }),
    ]);
  });

  it('a test that failed fewer runs in a row is not news', () => {
    const failures = Array.from({ length: RECOVERY_FAILURES - 1 }, (_, index) =>
      e.run('a1', ago(20 - index), [T1, T2]),
    );
    const state = liveState(
      testSnapshot({
        attempts: [testAttempt('a1', 'ana', { startedAt: ago(40) })],
        events: [...failures, e.run('a1', ago(10), [T2])],
      }),
    );

    expect(liveFeed(state, NOW)).toEqual([]);
  });

  it('leaves out what happened before the window, but counts its failures', () => {
    const state = liveState(
      testSnapshot({
        attempts: [testAttempt('a1', 'ana', { startedAt: ago(50) })],
        events: [
          e.run('a1', ago(45)),
          e.run('a1', ago(44), [T1]),
          e.run('a1', ago(43), [T1]),
          e.run('a1', ago(42), [T1]),
          e.submit('a1', ago(41)),
          e.run('a1', ago(3), [T2]),
        ],
      }),
    );

    expect(liveFeed(state, NOW)).toEqual([
      expect.objectContaining({ kind: 'recovered', failures: 3, at: ago(3) }),
    ]);
  });

  it('ignores the events nobody reads in the feed and attempts of other blocks or unassigned', () => {
    const state = liveState(
      testSnapshot({
        attempts: [
          testAttempt('a1', 'ana', { startedAt: ago(40) }),
          testAttempt('a2', 'bea', { assignmentId: 'elsewhere', startedAt: ago(2) }),
          testAttempt('a3', 'cai', { assignmentId: null, number: 2, startedAt: ago(2) }),
        ],
        events: [e.hint('a1', ago(5)), e.paste('a1', ago(4)), e.focusLost('a1', ago(3))],
      }),
    );

    expect(liveFeed(state, NOW)).toEqual([]);
  });

  it(`keeps the latest ${FEED_SIZE}`, () => {
    const state = liveState(
      testSnapshot({
        attempts: [testAttempt('a1', 'ana', { startedAt: ago(40) })],
        events: Array.from({ length: FEED_SIZE + 2 }, (_, index) =>
          e.submit('a1', ago(20 - index)),
        ),
      }),
    );

    const feed = liveFeed(state, NOW);

    expect(feed).toHaveLength(FEED_SIZE);
    expect(feed[0].at).toBe(ago(11));
  });
});
