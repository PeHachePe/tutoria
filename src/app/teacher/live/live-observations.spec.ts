import { liveObservations } from './live-observations';
import { ago, testRow } from './live-testing';

const working = { work: 'working', lastActivity: ago(1) } as const;

describe('liveObservations', () => {
  it('has nothing to say of a student working without anything worth knowing', () => {
    expect(liveObservations(testRow(working))).toEqual([]);
  });

  it('says nothing of a student who has not come in, whatever else they did', () => {
    const row = testRow({ repeated: 2, lastActivity: ago(200) });

    expect(liveObservations(row)).toEqual([]);
  });

  it('puts the reason of the queue first', () => {
    const reason = { kind: 'hints_exhausted', since: ago(2) } as const;
    const row = testRow({ ...working, reason, repeated: 1 });

    expect(liveObservations(row)).toEqual([reason, { kind: 'repeated', count: 1 }]);
  });

  it('has no chip for a stopped student: «Última actividad» says it', () => {
    const row = testRow({ work: 'stopped', lastActivity: ago(12) });

    expect(liveObservations(row)).toEqual([]);
  });

  it('says a student is out of the window', () => {
    const row = testRow({ work: 'stopped', lastActivity: ago(12), away: ago(10) });

    expect(liveObservations(row)).toEqual([{ kind: 'away' }]);
  });

  it('passes every pattern on', () => {
    const patterns = [
      { kind: 'paste_submit', chars: 400, runs: 0 },
      { kind: 'paste_on_return', chars: 200 },
      { kind: 'submit_burst', count: 3, minutes: 10 },
    ] as const;

    expect(liveObservations(testRow({ ...working, patterns }))).toEqual(patterns);
  });

  it('ends with the perseverance: a breakthrough, then the exercises repeated', () => {
    const row = testRow({
      ...working,
      breakthrough: { at: ago(3), failures: 5, testId: 't1' },
      repeated: 2,
    });

    expect(liveObservations(row)).toEqual([
      { kind: 'breakthrough', failures: 5 },
      { kind: 'repeated', count: 2 },
    ]);
  });
});
