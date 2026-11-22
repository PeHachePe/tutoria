import { testEvents as e } from '../../data/process-event-testing';
import { ago, BLOCK_EXERCISES, testAttempt, testInteraction } from '../live/live-testing';
import { attemptNow } from './attempt-now';
import { attemptTimeline } from './attempt-timeline';
import type { ProcessEvent } from '../../data/process-event';
import type { TutorInteraction } from '../../data/tutor';
import type { WorkState } from '../live/live-work';

const exercise = BLOCK_EXERCISES[0];
const name = exercise.exercise.functionName;
const open = testAttempt('a1', 'ana', { startedAt: ago(30) });
const submitted = testAttempt('a1', 'ana', { startedAt: ago(30), status: 'submitted' });

function now(
  events: readonly ProcessEvent[],
  {
    attempt = open,
    interactions = [],
    work = 'working',
  }: {
    readonly attempt?: typeof open;
    readonly interactions?: readonly TutorInteraction[];
    readonly work?: WorkState;
  } = {},
) {
  const timeline = attemptTimeline(attempt, events, interactions, exercise);
  return attemptNow(attempt, events, timeline, exercise, work);
}

describe('attemptNow', () => {
  describe('mode', () => {
    it.each<[string, typeof open, WorkState, string]>([
      ['a student working on it', open, 'working', 'now'],
      ['a student stopped on it', open, 'stopped', 'now'],
      ['a student not in the session', open, 'absent', 'left'],
      ['a submitted attempt', submitted, 'working', 'solved'],
    ])('is %s', (_, attempt, work, mode) => {
      expect(now([], { attempt, work }).mode).toBe(mode);
    });
  });

  it('has no run nor tests before the first run', () => {
    expect(now([])).toEqual({
      mode: 'now',
      lastRun: null,
      tests: [],
      failingRunId: null,
      help: null,
    });
    expect(now([], { work: 'absent' })).toMatchObject({ mode: 'left', lastRun: null, tests: [] });
  });

  it('lists the tests failing in the latest run, the longest failing first', () => {
    const events = [
      e.run('a1', ago(20), ['e1-t3', 'e1-t1']),
      e.run('a1', ago(15), ['e1-t3', 'e1-t2', 'e1-t1']),
      e.run('a1', ago(10), ['e1-t4', 'e1-t2', 'e1-t3']),
    ];

    const { lastRun, tests, failingRunId } = now(events);

    expect(lastRun).toEqual({ passed: 2, total: 5 });
    expect(failingRunId).toBe(events[2].id);
    expect(tests).toEqual([
      { id: 'e1-t3', call: `${name}([2])`, expected: '2', hidden: false, runs: 3 },
      { id: 'e1-t2', call: `${name}([1])`, expected: '1', hidden: false, runs: 2 },
      { id: 'e1-t4', call: `${name}([3])`, expected: '3', hidden: true, runs: 1 },
    ]);
  });

  it('breaks a tie by the order of the exercise', () => {
    const { tests } = now([e.run('a1', ago(10), ['e1-t5', 'e1-t1'])]);

    expect(tests.map((test) => test.id)).toEqual(['e1-t1', 'e1-t5']);
  });

  it('leaves out a test no longer in the exercise', () => {
    const { tests } = now([e.run('a1', ago(10), ['gone', 'e1-t2'])]);

    expect(tests.map((test) => test.id)).toEqual(['e1-t2']);
  });

  it('has no failing test once every test passes', () => {
    const { lastRun, tests } = now([e.run('a1', ago(20), ['e1-t1']), e.run('a1', ago(10))]);

    expect(lastRun).toEqual({ passed: 5, total: 5 });
    expect(tests).toEqual([]);
  });

  it('tells of a submitted attempt the tests that failed in some run, and in how many', () => {
    const events = [
      e.run('a1', ago(20), ['e1-t2', 'e1-t1']),
      e.run('a1', ago(15), ['e1-t2']),
      e.run('a1', ago(12), ['e1-t1', 'e1-t2', 'gone']),
      e.run('a1', ago(10)),
    ];

    const { tests, failingRunId } = now(events, { attempt: submitted });

    expect(failingRunId).toBe(events[2].id);
    expect(tests.map(({ id, runs }) => [id, runs])).toEqual([
      ['e1-t2', 3],
      ['e1-t1', 2],
    ]);
  });

  it('has no failed test in a submitted attempt that passed at the first run', () => {
    expect(now([e.run('a1', ago(10))], { attempt: submitted }).tests).toEqual([]);
  });

  describe('the latest help', () => {
    it('is the latest hint, with its answer', () => {
      const hint = e.hint('a1', ago(10), 2);
      const answer = testInteraction('a1', ago(10), { hintLevel: 2, transcript: 'Mira el bucle.' });

      expect(now([e.hint('a1', ago(20), 1), hint], { interactions: [answer] }).help).toEqual({
        entryId: answer.id,
        trigger: 'hint',
        level: 2,
        at: ago(10),
        question: null,
        text: 'Mira el bucle.',
      });
    });

    it('is the answer to a question, with what the student asked', () => {
      const question = testInteraction('a1', ago(5), {
        trigger: 'question',
        studentMessage: '¿Por qué falla?',
        transcript: 'Revisa la condición.',
      });

      expect(now([], { interactions: [question] }).help).toMatchObject({
        trigger: 'question',
        question: '¿Por qué falla?',
        text: 'Revisa la condición.',
      });
    });

    it('is an intervention of the tutor on its own', () => {
      const intervention = testInteraction('a1', ago(5), {
        trigger: 'proactive',
        studentMessage: 'ignored',
      });

      expect(now([e.proactive('a1', ago(5))], { interactions: [intervention] }).help).toMatchObject(
        { trigger: 'proactive', question: null, entryId: intervention.id },
      );
    });

    it('is a hint whose answer was not recorded, without text', () => {
      const hint = e.hint('a1', ago(5), 3);

      expect(now([hint]).help).toEqual({
        entryId: hint.id,
        trigger: 'hint',
        level: 3,
        at: ago(5),
        question: null,
        text: null,
      });
    });

    it('does not count an intervention in which the tutor said nothing', () => {
      const silent = e.proactive('a1', ago(5), 'failures', true);
      const hint = e.hint('a1', ago(10), 1);

      expect(now([hint, silent]).help?.entryId).toBe(hint.id);
      expect(now([silent]).help).toBeNull();
    });
  });
});
