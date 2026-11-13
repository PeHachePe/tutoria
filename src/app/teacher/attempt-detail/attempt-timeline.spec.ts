import { testEvents as e } from '../../data/process-event-testing';
import {
  ago,
  BLOCK_EXERCISES,
  MINUTE,
  NOW,
  testAttempt,
  testInteraction,
} from '../live/live-testing';
import {
  attemptFigures,
  attemptTimeline,
  latestAttempt,
  mergeById,
  timelineCategory,
  type TimelineEntry,
} from './attempt-timeline';

const exercise = BLOCK_EXERCISES[0];
const attempt = testAttempt('a1', 'ana', { startedAt: ago(30), updatedAt: ago(30) });

const kinds = (entries: readonly TimelineEntry[]) => entries.map((entry) => entry.kind);

describe('attemptTimeline', () => {
  it('starts when the attempt was opened', () => {
    const entries = attemptTimeline(attempt, [], [], exercise);

    expect(entries).toEqual([{ id: 'start', kind: 'start', at: ago(30), gapMinutes: null }]);
  });

  it('describes each run with the tests that fail, visible or hidden, in the order of the exercise', () => {
    const run = e.run('a1', ago(20), ['e1-t5', 'e1-t1', 'gone'], 5);

    const [, entry] = attemptTimeline(attempt, [run], [], exercise);

    expect(entry).toMatchObject({
      id: run.id,
      kind: 'run',
      passed: 2,
      total: 5,
      failing: [
        { id: 'e1-t1', call: `${exercise.exercise.functionName}([])`, hidden: false },
        { id: 'e1-t5', call: `${exercise.exercise.functionName}([4])`, hidden: true },
      ],
    });
  });

  it('shows each tutor interaction once, with the hint or intervention event it recorded', () => {
    const hint = e.hint('a1', ago(20), 2);
    const answer = testInteraction('a1', ago(20) + 500, { hintLevel: 2 });
    const question = testInteraction('a1', ago(18), { trigger: 'question', studentMessage: '¿?' });
    const proactive = e.proactive('a1', ago(16));
    const intervention = testInteraction('a1', ago(16), { trigger: 'proactive' });

    const entries = attemptTimeline(
      attempt,
      [hint, proactive],
      [answer, question, intervention],
      exercise,
    );

    expect(entries.slice(1)).toEqual([
      expect.objectContaining({ kind: 'tutor', interaction: answer }),
      expect.objectContaining({ kind: 'tutor', interaction: question }),
      expect.objectContaining({ kind: 'tutor', interaction: intervention }),
    ]);
  });

  it('keeps the hints and interventions without a recorded answer, and the silent ones', () => {
    const lonelyHint = e.hint('a1', ago(20), 3);
    const farAnswer = testInteraction('a1', ago(10), { hintLevel: 1 });
    const silent = { ...e.proactive('a1', ago(15)), detail: { silent: true } };
    const lonelyProactive = e.proactive('a1', ago(12));

    const entries = attemptTimeline(
      attempt,
      [lonelyHint, silent, lonelyProactive],
      [farAnswer],
      exercise,
    );

    expect(entries.slice(1)).toEqual([
      expect.objectContaining({ kind: 'hint', level: 3 }),
      expect.objectContaining({ kind: 'proactive', silent: true }),
      expect.objectContaining({ kind: 'proactive', silent: false }),
      expect.objectContaining({ kind: 'tutor', interaction: farAnswer }),
    ]);
  });

  it('joins a time away with its return, and keeps one that has not ended', () => {
    const lost = e.focusLost('a1', ago(20));
    const gained = e.focusGained('a1', ago(18), 2 * MINUTE);
    const lonelyReturn = e.focusGained('a1', ago(10), MINUTE);
    const unreturned = e.focusLost('a1', ago(7));
    const stillAway = e.focusLost('a1', ago(5));

    const entries = attemptTimeline(
      attempt,
      [gained, lost, lonelyReturn, unreturned, stillAway],
      [],
      exercise,
    );

    expect(entries.slice(1)).toEqual([
      expect.objectContaining({ id: lost.id, kind: 'away', at: ago(20), ms: 2 * MINUTE }),
      expect.objectContaining({ id: lonelyReturn.id, kind: 'away', at: ago(11), ms: MINUTE }),
      expect.objectContaining({ id: unreturned.id, kind: 'away', at: ago(7), ms: null }),
      expect.objectContaining({ id: stillAway.id, kind: 'away', at: ago(5), ms: null }),
    ]);
  });

  it('tells pastes and the submission', () => {
    const entries = attemptTimeline(
      attempt,
      [e.paste('a1', ago(20), 120), e.submit('a1', ago(10))],
      [],
      exercise,
    );

    expect(entries.slice(1)).toEqual([
      expect.objectContaining({ kind: 'paste', length: 120 }),
      expect.objectContaining({ kind: 'submit', at: ago(10) }),
    ]);
  });

  it('marks the long silences between two entries', () => {
    const entries = attemptTimeline(
      attempt,
      [e.run('a1', ago(28)), e.run('a1', ago(16)), e.run('a1', ago(12))],
      [],
      exercise,
    );

    expect(entries.map((entry) => entry.gapMinutes)).toEqual([null, null, 12, null]);
  });

  it('orders everything by time', () => {
    const entries = attemptTimeline(
      attempt,
      [e.submit('a1', ago(5)), e.run('a1', ago(25))],
      [testInteraction('a1', ago(15), { trigger: 'question' })],
      exercise,
    );

    expect(kinds(entries)).toEqual(['start', 'run', 'tutor', 'submit']);
  });
});

describe('timelineCategory', () => {
  it.each<[TimelineEntry['kind'], string]>([
    ['start', 'other'],
    ['run', 'tests'],
    ['submit', 'tests'],
    ['tutor', 'tutor'],
    ['hint', 'tutor'],
    ['proactive', 'tutor'],
    ['paste', 'browser'],
    ['away', 'browser'],
  ])('puts %s in %s', (kind, category) => {
    expect(timelineCategory({ kind } as TimelineEntry)).toBe(category);
  });
});

describe('attemptFigures', () => {
  it('counts what the student did', () => {
    const events = [
      e.run('a1', ago(25), ['e1-t1']),
      e.hint('a1', ago(22), 1),
      e.hint('a1', ago(20), 2),
      e.paste('a1', ago(18), 30),
      e.paste('a1', ago(17), 90),
      e.focusLost('a1', ago(16)),
      e.focusGained('a1', ago(14), 2 * MINUTE),
      e.run('a1', ago(10), [], 5),
    ];
    const interactions = [
      testInteraction('a1', ago(12), { trigger: 'question' }),
      testInteraction('a1', ago(11), { trigger: 'question' }),
    ];

    expect(attemptFigures(attempt, events, interactions, NOW)).toEqual({
      minutes: 30,
      runs: 2,
      lastRun: { passed: 5, total: 5 },
      hints: 2,
      hintLevel: 2,
      questions: 2,
      pastes: 2,
      pastedChars: 120,
      focusLosses: 1,
      awayMs: 2 * MINUTE,
      lastActivity: ago(10),
      live: true,
    });
  });

  it('counts the time until the submission, or until the last activity once the student left', () => {
    const submitted = {
      ...attempt,
      status: 'submitted' as const,
      finishedAt: new Date(ago(10)).toISOString(),
    };
    expect(attemptFigures(submitted, [], [], NOW)).toMatchObject({ minutes: 20, live: false });

    const old = testAttempt('a1', 'ana', { startedAt: ago(300), updatedAt: ago(200) });
    expect(attemptFigures(old, [], [], NOW)).toMatchObject({
      minutes: 100,
      live: false,
      runs: 0,
      lastRun: null,
      hintLevel: null,
    });
  });
});

describe('mergeById', () => {
  it('keeps every row once, the first list first', () => {
    const a = { id: 'a' };
    const b = { id: 'b' };
    const c = { id: 'c' };

    expect(mergeById([a, b], [{ id: 'b' }, c])).toEqual([a, b, c]);
    expect(mergeById([a, b], [{ id: 'b' }, c])[1]).toBe(b);
  });
});

describe('latestAttempt', () => {
  it('takes the version that changed last', () => {
    const before = testAttempt('a1', 'ana', { updatedAt: ago(10) });
    const after = testAttempt('a1', 'ana', { updatedAt: ago(5), status: 'passed' });

    expect(latestAttempt(before, after)).toBe(after);
    expect(latestAttempt(after, before)).toBe(after);
    expect(latestAttempt(before, undefined)).toBe(before);
  });
});
