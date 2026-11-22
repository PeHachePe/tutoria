import { testEvents as e } from '../../data/process-event-testing';
import { ago, BLOCK_EXERCISES, MINUTE, testAttempt, testInteraction } from '../live/live-testing';
import {
  attemptTimeline,
  entryIdOf,
  latestAttempt,
  mergeById,
  timelineCategory,
  type TimelineEntry,
} from './attempt-timeline';

const exercise = BLOCK_EXERCISES[0];
const attempt = testAttempt('a1', 'ana', { startedAt: ago(30), updatedAt: ago(30) });

const kinds = (entries: readonly TimelineEntry[]) => entries.map((entry) => entry.kind);
/** The entries in the order they happened, without the opening. */
const inOrder = (entries: readonly TimelineEntry[]) => entries.slice(0, -1).reverse();

describe('attemptTimeline', () => {
  it('starts when the attempt was opened', () => {
    const entries = attemptTimeline(attempt, [], [], exercise);

    expect(entries).toEqual([
      { id: 'start', kind: 'start', at: ago(30), gapMinutes: null, eventIds: [] },
    ]);
  });

  it('describes each run with the tests that fail, visible or hidden, in the order of the exercise', () => {
    const run = e.run('a1', ago(20), ['e1-t5', 'e1-t1', 'gone'], 5);

    const [entry] = attemptTimeline(attempt, [run], [], exercise);

    expect(entry).toMatchObject({
      id: run.id,
      kind: 'run',
      passed: 2,
      total: 5,
      count: 1,
      from: ago(20),
      eventIds: [run.id],
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

    expect(inOrder(entries)).toEqual([
      expect.objectContaining({ kind: 'tutor', interaction: answer, eventIds: [hint.id] }),
      expect.objectContaining({ kind: 'tutor', interaction: question, eventIds: [] }),
      expect.objectContaining({
        kind: 'tutor',
        interaction: intervention,
        eventIds: [proactive.id],
      }),
    ]);
  });

  it('keeps the hints and interventions without a recorded answer, and the silent ones', () => {
    const lonelyHint = e.hint('a1', ago(20), 3);
    const farAnswer = testInteraction('a1', ago(10), { hintLevel: 1 });
    const silent = e.proactive('a1', ago(15), 'failures', true);
    const lonelyProactive = e.proactive('a1', ago(12));

    const entries = attemptTimeline(
      attempt,
      [lonelyHint, silent, lonelyProactive],
      [farAnswer],
      exercise,
    );

    expect(inOrder(entries)).toEqual([
      expect.objectContaining({ kind: 'hint', level: 3, eventIds: [lonelyHint.id] }),
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

    expect(inOrder(entries)).toEqual([
      expect.objectContaining({
        id: lost.id,
        kind: 'away',
        at: ago(20),
        ms: 2 * MINUTE,
        eventIds: [lost.id, gained.id],
      }),
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

    expect(inOrder(entries)).toEqual([
      expect.objectContaining({ kind: 'paste', length: 120 }),
      expect.objectContaining({ kind: 'submit', at: ago(10) }),
    ]);
  });

  it('marks the long silences between two entries', () => {
    const entries = attemptTimeline(
      attempt,
      [e.run('a1', ago(28)), e.run('a1', ago(16), ['e1-t1']), e.run('a1', ago(12))],
      [],
      exercise,
    );

    expect(entries.map((entry) => entry.gapMinutes)).toEqual([null, 12, null, null]);
  });

  it('puts the latest first and the opening last', () => {
    const entries = attemptTimeline(
      attempt,
      [e.submit('a1', ago(5)), e.run('a1', ago(25))],
      [testInteraction('a1', ago(15), { trigger: 'question' })],
      exercise,
    );

    expect(kinds(entries)).toEqual(['submit', 'tutor', 'run', 'start']);
  });

  describe('runs in a row with the same result', () => {
    it.each([2, 3, 4])('tells %i of them as one entry', (count) => {
      const runs = Array.from({ length: count }, (_, index) =>
        e.run('a1', ago(20 - index), ['e1-t1', 'e1-t2']),
      );

      const [group, start] = attemptTimeline(attempt, runs, [], exercise);

      expect(group).toMatchObject({
        id: runs[0].id,
        kind: 'run',
        passed: 3,
        count,
        from: ago(20),
        at: ago(20 - count + 1),
        eventIds: runs.map((run) => run.id),
      });
      expect(start.kind).toBe('start');
    });

    it('groups the runs that pass everything too', () => {
      const entries = attemptTimeline(
        attempt,
        [e.run('a1', ago(20)), e.run('a1', ago(19))],
        [],
        exercise,
      );

      expect(entries[0]).toMatchObject({ kind: 'run', failing: [], count: 2 });
    });

    it('does not group runs that fail different tests', () => {
      const entries = attemptTimeline(
        attempt,
        [e.run('a1', ago(20), ['e1-t1']), e.run('a1', ago(19), ['e1-t2'])],
        [],
        exercise,
      );

      expect(kinds(entries)).toEqual(['run', 'run', 'start']);
    });

    it.each([
      ['a hint', () => [e.hint('a1', ago(19.5), 1)], []],
      ['a paste', () => [e.paste('a1', ago(19.5))], []],
      ['a question', () => [], [testInteraction('a1', ago(19.5), { trigger: 'question' })]],
    ])('does not group runs with %s between them', (_, extra, interactions) => {
      const entries = attemptTimeline(
        attempt,
        [e.run('a1', ago(20), ['e1-t1']), ...extra(), e.run('a1', ago(19), ['e1-t1'])],
        interactions,
        exercise,
      );

      expect(entries.filter((entry) => entry.kind === 'run')).toHaveLength(2);
    });

    it('does not group runs a long silence separates, and keeps marking it', () => {
      const entries = attemptTimeline(
        attempt,
        [e.run('a1', ago(20), ['e1-t1']), e.run('a1', ago(15), ['e1-t1'])],
        [],
        exercise,
      );

      expect(entries.map((entry) => [entry.kind, entry.gapMinutes])).toEqual([
        ['run', 5],
        ['run', 10],
        ['start', null],
      ]);
    });

    it('keeps the silence before the first run of a group', () => {
      const entries = attemptTimeline(
        attempt,
        [e.run('a1', ago(20), ['e1-t1']), e.run('a1', ago(19), ['e1-t1'])],
        [],
        exercise,
      );

      expect(entries[0]).toMatchObject({ count: 2, gapMinutes: 10 });
    });
  });
});

describe('entryIdOf', () => {
  const runs = [e.run('a1', ago(20), ['e1-t1']), e.run('a1', ago(19), ['e1-t1'])];
  const hint = e.hint('a1', ago(10), 2);
  const answer = testInteraction('a1', ago(10), { hintLevel: 2 });
  const timeline = attemptTimeline(attempt, [...runs, hint], [answer], exercise);

  it('finds the entry of a run inside a group', () => {
    expect(entryIdOf(timeline, runs[1].id)).toBe(runs[0].id);
  });

  it('finds the answer of a hint, by the hint or by the interaction', () => {
    expect(entryIdOf(timeline, hint.id)).toBe(answer.id);
    expect(entryIdOf(timeline, answer.id)).toBe(answer.id);
  });

  it('gives null for an unknown id', () => {
    expect(entryIdOf(timeline, 'unknown')).toBeNull();
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
