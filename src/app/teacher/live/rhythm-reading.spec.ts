import type { ActivityMinute } from './activity-by-minute';
import { rhythmReading } from './rhythm-reading';

/**
 * Thirty complete minutes and the current one, still running, last: `before` for minutes 11 to 20,
 * `now` for the last 10 complete ones.
 */
function series(
  now: Partial<Omit<ActivityMinute, 'start'>>,
  before: Partial<Omit<ActivityMinute, 'start'>> = {},
  older: Partial<Omit<ActivityMinute, 'start'>> = {},
  current: Partial<Omit<ActivityMinute, 'start'>> = {},
): ActivityMinute[] {
  const minute = (start: number, counts: Partial<Omit<ActivityMinute, 'start'>>) => ({
    start,
    runs: counts.runs ?? 0,
    hints: counts.hints ?? 0,
  });
  return Array.from({ length: 31 }, (_, index) =>
    minute(index, index < 10 ? older : index < 20 ? before : index < 30 ? now : current),
  );
}

describe('rhythmReading', () => {
  it('has no reading without any run or hint', () => {
    expect(rhythmReading(series({}))).toBeNull();
    expect(rhythmReading([])).toBeNull();
  });

  it('says the class has just started with activity only in the last minutes', () => {
    expect(rhythmReading(series({ runs: 2, hints: 1 }))).toBe('starting');
  });

  it('says so too with activity only in the current minute', () => {
    expect(rhythmReading(series({}, {}, {}, { runs: 1 }))).toBe('starting');
  });

  it('leaves the current minute out of the comparison: it is not over yet', () => {
    const steady = series({ runs: 3 }, { runs: 3 }, {}, { runs: 0 });
    const busy = series({ runs: 3 }, { runs: 3 }, {}, { runs: 50, hints: 50 });

    expect(rhythmReading(steady)).toBe('steady');
    expect(rhythmReading(busy)).toBe('steady');
  });

  it('no longer says so with activity before the last minutes, even long before', () => {
    expect(rhythmReading(series({ runs: 2 }, {}, { runs: 2 }))).not.toBe('starting');
  });

  it('says the class is getting stuck when hints rise and runs fall', () => {
    expect(rhythmReading(series({ runs: 2, hints: 2 }, { runs: 3, hints: 1 }))).toBe('stuck');
  });

  it('says the activity has dropped under half of the minutes before', () => {
    expect(rhythmReading(series({ runs: 1 }, { runs: 3 }))).toBe('slowing');
  });

  it('says the class works at a good pace otherwise, also at exactly half', () => {
    expect(rhythmReading(series({ runs: 3, hints: 1 }, { runs: 3, hints: 1 }))).toBe('steady');
    expect(rhythmReading(series({ runs: 2 }, { runs: 4 }))).toBe('steady');
  });
});
