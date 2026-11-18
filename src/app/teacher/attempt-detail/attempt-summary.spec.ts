import { testEvents as e } from '../../data/process-event-testing';
import { LIVE_WINDOW_MINUTES } from '../../data/live-service';
import { ago, MINUTE, NOW, testAttempt, testInteraction } from '../live/live-testing';
import { attemptSummary } from './attempt-summary';

const DAY = 24 * 60 * MINUTE;

describe('attemptSummary', () => {
  it('is the time from the opening to the latest save in a single sitting', () => {
    const attempt = testAttempt('a1', 'ana', { startedAt: ago(50), updatedAt: ago(20) });

    expect(attemptSummary(attempt, [e.run('a1', ago(30))], [], 'left', NOW).workMs).toBe(
      30 * MINUTE,
    );
  });

  it('leaves out the time between two sittings', () => {
    const attempt = testAttempt('a1', 'ana', {
      startedAt: ago(DAY / MINUTE + 30),
      updatedAt: ago(5),
    });
    const events = [e.run('a1', ago(DAY / MINUTE + 10)), e.run('a1', ago(15))];

    // 20 min the first day, 10 min the next one
    expect(attemptSummary(attempt, events, [], 'left', NOW).workMs).toBe(30 * MINUTE);
  });

  it('counts a pause shorter than the session window, and not one as long', () => {
    const attempt = testAttempt('a1', 'ana', { startedAt: ago(200), updatedAt: ago(200) });
    const shorter = [e.run('a1', ago(200 - LIVE_WINDOW_MINUTES + 1))];
    const asLong = [e.run('a1', ago(200 - LIVE_WINDOW_MINUTES))];

    expect(attemptSummary(attempt, shorter, [], 'left', NOW).workMs).toBe(
      (LIVE_WINDOW_MINUTES - 1) * MINUTE,
    );
    expect(attemptSummary(attempt, asLong, [], 'left', NOW).workMs).toBe(0);
  });

  it('counts until now only while the student is on it', () => {
    const attempt = testAttempt('a1', 'ana', { startedAt: ago(20), updatedAt: ago(10) });

    expect(attemptSummary(attempt, [], [], 'now', NOW).workMs).toBe(20 * MINUTE);
    expect(attemptSummary(attempt, [], [], 'left', NOW).workMs).toBe(10 * MINUTE);
  });

  it('counts until the submission of a submitted attempt', () => {
    const attempt = testAttempt('a1', 'ana', {
      startedAt: ago(40),
      updatedAt: ago(15),
      finishedAt: ago(10),
      status: 'submitted',
    });

    expect(attemptSummary(attempt, [], [], 'solved', NOW).workMs).toBe(30 * MINUTE);
  });

  it('counts the tutor turns as moments of work', () => {
    const attempt = testAttempt('a1', 'ana', { startedAt: ago(100), updatedAt: ago(100) });
    const interactions = [testInteraction('a1', ago(70), { trigger: 'question' })];

    expect(attemptSummary(attempt, [], interactions, 'left', NOW).workMs).toBe(30 * MINUTE);
  });

  it('counts runs, hints with their highest level, questions, pasted characters and time away', () => {
    const attempt = testAttempt('a1', 'ana', { startedAt: ago(30) });
    const events = [
      e.run('a1', ago(25), ['e1-t1']),
      e.hint('a1', ago(22), 2),
      e.hint('a1', ago(20), 1),
      e.paste('a1', ago(18), 30),
      e.paste('a1', ago(17), 90),
      e.focusLost('a1', ago(16)),
      e.focusGained('a1', ago(14), 2 * MINUTE),
      e.focusLost('a1', ago(12)),
      e.run('a1', ago(10)),
    ];
    const interactions = [
      testInteraction('a1', ago(12), { trigger: 'question' }),
      testInteraction('a1', ago(11), { trigger: 'question' }),
      testInteraction('a1', ago(20), { trigger: 'hint' }),
    ];

    expect(attemptSummary(attempt, events, interactions, 'now', NOW)).toEqual({
      workMs: 30 * MINUTE,
      runs: 2,
      hints: 2,
      hintLevel: 2,
      questions: 2,
      pastedChars: 120,
      awayMs: 2 * MINUTE,
    });
  });

  it('is all zero for an attempt just opened', () => {
    const attempt = testAttempt('a1', 'ana', { startedAt: NOW });

    expect(attemptSummary(attempt, [], [], 'now', NOW)).toEqual({
      workMs: 0,
      runs: 0,
      hints: 0,
      hintLevel: null,
      questions: 0,
      pastedChars: 0,
      awayMs: 0,
    });
  });
});
