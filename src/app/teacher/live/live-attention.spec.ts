import type { Attempt, StoredAttemptStatus } from '../../data/attempt';
import type { ProcessEvent } from '../../data/process-event';
import { testEvents as e } from '../../data/process-event-testing';
import type { TutorInteraction } from '../../data/tutor';
import {
  ATTENTION_ORDER,
  attentionReason,
  CHAT_STUCK_MESSAGES,
  failingTest,
  HINT_RUSH_COUNT,
} from './live-attention';
import { ago, BLOCK_EXERCISES, testInteraction } from './live-testing';

const THRESHOLDS = { maxRepeatedFailures: 3 };
const TESTS = BLOCK_EXERCISES[0].tests;

const open = (status: StoredAttemptStatus = 'tests_failed'): Pick<Attempt, 'status'> => ({
  status,
});

const reason = (
  events: readonly ProcessEvent[],
  interactions: readonly TutorInteraction[] = [],
  status: StoredAttemptStatus = 'tests_failed',
) => attentionReason(open(status), events, interactions, THRESHOLDS);

const stuck = (at: number) =>
  testInteraction('a1', at, {
    trigger: 'question',
    studentMessage: 'No sé cómo seguir',
  });

describe('attentionReason', () => {
  it('has no reason without anything to look at', () => {
    expect(reason([])).toBeNull();
  });

  it('says the hints ran out when a run fails after the last hint level', () => {
    const events = [e.hint('a1', ago(9), 3), e.run('a1', ago(8), ['t1']), e.run('a1', ago(6))];

    expect(reason(events)).toEqual({ kind: 'hints_exhausted', since: ago(8) });
  });

  it('needs a failing run after the last hint and the attempt with failed tests', () => {
    const before = [e.run('a1', ago(9), ['t1']), e.hint('a1', ago(8), 3)];
    const passed = [e.hint('a1', ago(8), 3), e.run('a1', ago(6))];

    expect(reason(before)).toBeNull();
    expect(reason(passed, [], 'passed')).toBeNull();
    expect(reason([e.hint('a1', ago(8), 3), e.run('a1', ago(6), ['t1'])], [], 'in_progress')).toBe(
      null,
    );
  });

  it('says the same test fails again and again, since the run that reached the threshold', () => {
    const events = [4, 3, 2, 1].map((minutes) => e.run('a1', ago(minutes), ['t1']));

    expect(reason(events)).toEqual({
      kind: 'stuck_failures',
      failures: 4,
      askedForHints: false,
      since: ago(2),
    });
  });

  it('says whether the student asked for hints while failing', () => {
    const events = [e.hint('a1', ago(5)), ...[3, 2, 1].map((m) => e.run('a1', ago(m), ['t1']))];

    expect(reason(events)).toMatchObject({ kind: 'stuck_failures', askedForHints: true });
  });

  it('says the student told the tutor twice that they cannot go on, since the second time', () => {
    expect(reason([], [stuck(ago(5)), stuck(ago(3))])).toEqual({
      kind: 'chat_stuck',
      messages: CHAT_STUCK_MESSAGES,
      since: ago(3),
    });
  });

  it('counts every message of the streak, still since the one that reached it', () => {
    expect(reason([], [stuck(ago(5)), stuck(ago(3)), stuck(ago(1))])).toEqual({
      kind: 'chat_stuck',
      messages: 3,
      since: ago(3),
    });
  });

  it('does not count a single message', () => {
    expect(reason([], [stuck(ago(1))])).toBeNull();
  });

  it('cuts the streak with a hint or a question that is not being stuck', () => {
    const hint = testInteraction('a1', ago(4));
    const question = testInteraction('a1', ago(4), {
      trigger: 'question',
      studentMessage: '¿Qué es un bucle?',
    });

    expect(reason([], [stuck(ago(5)), hint, stuck(ago(3))])).toBeNull();
    expect(reason([], [stuck(ago(5)), question, stuck(ago(3))])).toBeNull();
  });

  it('does not cut the streak with an intervention of the tutor', () => {
    const proactive = testInteraction('a1', ago(4), { trigger: 'proactive' });

    expect(reason([], [stuck(ago(3)), proactive, stuck(ago(5))])).toMatchObject({
      kind: 'chat_stuck',
      messages: 2,
    });
  });

  it('says the student asks for hints in a row without running the tests', () => {
    const hints = [5, 4, 3].map((minutes) => e.hint('a1', ago(minutes)));

    expect(reason(hints, [], 'in_progress')).toEqual({
      kind: 'hint_rush',
      hints: HINT_RUSH_COUNT,
      since: ago(3),
    });
  });

  it('only counts the hints after the latest run', () => {
    const events = [e.hint('a1', ago(9)), e.run('a1', ago(6)), e.hint('a1', ago(5))];
    const after = [...events, e.hint('a1', ago(4)), e.hint('a1', ago(3))];

    expect(reason(events, [], 'in_progress')).toBeNull();
    expect(reason(after, [], 'in_progress')).toMatchObject({ kind: 'hint_rush', hints: 3 });
  });

  describe('when several reasons hold, in the order of the queue', () => {
    const failing = [4, 3, 2].map((minutes) => e.run('a1', ago(minutes), ['t1']));
    const chat = [stuck(ago(5)), stuck(ago(4))];
    const rush = [e.hint('a1', ago(1.5)), e.hint('a1', ago(1.2)), e.hint('a1', ago(1.1))];

    it('puts the hints that ran out before the failures', () => {
      const events = [e.hint('a1', ago(5), 3), ...failing];

      expect(reason(events)?.kind).toBe('hints_exhausted');
    });

    it('puts the failures before the chat', () => {
      expect(reason(failing, chat)?.kind).toBe('stuck_failures');
    });

    it('puts the chat before the hints in a row', () => {
      expect(reason(rush, chat)?.kind).toBe('chat_stuck');
    });

    it('lists the reasons in that order', () => {
      expect(ATTENTION_ORDER).toEqual([
        'hints_exhausted',
        'stuck_failures',
        'chat_stuck',
        'hint_rush',
      ]);
    });
  });

  it('gives no reason for an attempt passed or submitted', () => {
    const failing = [3, 2, 1].map((minutes) => e.run('a1', ago(minutes), ['t1']));

    expect(reason(failing, [stuck(ago(5)), stuck(ago(4))], 'passed')).toBeNull();
    expect(reason(failing, [], 'submitted')).toBeNull();
  });

  it('gives no reason for leaving the window or stopping', () => {
    const events = [e.run('a1', ago(50), ['t1']), e.focusLost('a1', ago(40))];

    expect(reason(events)).toBeNull();
  });
});

describe('failingTest', () => {
  it('is the test failing longest in the latest run', () => {
    const events = [
      e.run('a1', ago(3), ['e1-t2']),
      e.run('a1', ago(2), ['e1-t1', 'e1-t2']),
      e.run('a1', ago(1), ['e1-t1', 'e1-t2']),
    ];

    expect(failingTest(events, TESTS)?.id).toBe('e1-t2');
  });

  it('is the first in the order of the exercise on a tie', () => {
    const events = [e.run('a1', ago(1), ['e1-t3', 'e1-t2'])];

    expect(failingTest(events, TESTS)?.id).toBe('e1-t2');
  });

  it('is null without runs or with every test passed', () => {
    expect(failingTest([], TESTS)).toBeNull();
    expect(failingTest([e.run('a1', ago(2), ['e1-t1']), e.run('a1', ago(1))], TESTS)).toBeNull();
  });
});
