import { testEvents as e } from '../../data/process-event-testing';
import { livePatterns, type PatternInput } from './live-patterns';
import { ago } from './live-testing';

function input(overrides: Partial<PatternInput> = {}): PatternInput {
  return {
    hasAttempts: true,
    active: true,
    classActive: true,
    events: [],
    submittedAttemptIds: new Set(),
    ...overrides,
  };
}

describe('livePatterns', () => {
  it('finds nothing in an active student who works step by step', () => {
    const events = [e.run('a', ago(9), ['t1']), e.paste('a', ago(8), 30), e.run('a', ago(7))];

    expect(livePatterns(input({ events }))).toEqual([]);
  });

  describe('without activity in the session', () => {
    it('says the student has not started while the class works', () => {
      expect(livePatterns(input({ active: false, hasAttempts: false }))).toEqual([
        { kind: 'not_started' },
      ]);
    });

    it('says the student is inactive if they had opened something', () => {
      expect(livePatterns(input({ active: false }))).toEqual([{ kind: 'inactive' }]);
    });

    it('says nothing when the whole class is quiet', () => {
      expect(livePatterns(input({ active: false, classActive: false }))).toEqual([]);
    });
  });

  describe('submission with a paste', () => {
    it('is a submitted attempt with a large paste and few runs', () => {
      const events = [e.paste('a', ago(5), 60), e.paste('a', ago(4), 60), e.run('a', ago(3))];

      expect(livePatterns(input({ events, submittedAttemptIds: new Set(['a']) }))).toEqual([
        { kind: 'paste_submit', chars: 120, runs: 1 },
      ]);
    });

    it('is not one with a short paste, with many runs or before submitting', () => {
      const small = [e.paste('a', ago(5), 99)];
      const manyRuns = [e.paste('a', ago(9), 300), ...[8, 7, 6].map((m) => e.run('a', ago(m)))];
      const submitted = new Set(['a']);

      expect(livePatterns(input({ events: small, submittedAttemptIds: submitted }))).toEqual([]);
      expect(livePatterns(input({ events: manyRuns, submittedAttemptIds: submitted }))).toEqual([]);
      expect(livePatterns(input({ events: [e.paste('a', ago(5), 300)] }))).toEqual([]);
    });
  });

  describe('paste on return', () => {
    it('is the largest paste soon after coming back to the window', () => {
      const events = [
        e.focusLost('a', ago(6)),
        e.focusGained('a', ago(5)),
        e.paste('a', ago(5) + 20_000, 150),
        e.paste('a', ago(5) + 50_000, 400),
      ];

      expect(livePatterns(input({ events }))).toEqual([{ kind: 'paste_on_return', chars: 400 }]);
    });

    it('is not a paste long after coming back, a short one or one without leaving', () => {
      const late = [e.focusGained('a', ago(5)), e.paste('a', ago(3), 400)];
      const short = [e.focusGained('a', ago(5)), e.paste('a', ago(5) + 1000, 50)];

      expect(livePatterns(input({ events: late }))).toEqual([]);
      expect(livePatterns(input({ events: short }))).toEqual([]);
      expect(livePatterns(input({ events: [e.paste('a', ago(5), 400)] }))).toEqual([]);
    });
  });

  describe('burst of submissions', () => {
    it('is three submissions within ten minutes', () => {
      const events = [
        e.submit('a', ago(30)),
        e.submit('b', ago(9)),
        e.submit('c', ago(4)),
        e.submit('d', ago(1)),
      ];

      expect(livePatterns(input({ events }))).toEqual([
        { kind: 'submit_burst', count: 3, minutes: 10 },
      ]);
    });

    it('is not submissions spread over the session', () => {
      const events = [e.submit('a', ago(40)), e.submit('b', ago(25)), e.submit('c', ago(10))];

      expect(livePatterns(input({ events }))).toEqual([]);
    });
  });
});
