import { hintTrend } from './hint-trend';
import { blockStats } from './history-testing';

describe('hintTrend', () => {
  const start = blockStats('b1', { hints: 44, attempts: 40 });

  it('falls when the last block asks for fewer hints than the first', () => {
    const middle = blockStats('b2', { hints: 30, attempts: 40 });
    const end = blockStats('b3', { hints: 0, attempts: 40 });

    expect(hintTrend([start, middle, end], 24)).toEqual({
      kind: 'falling',
      first: start,
      last: end,
    });
  });

  it('rises when it asks for more', () => {
    const end = blockStats('b2', { hints: 60, attempts: 40 });

    expect(hintTrend([start, end], 24)).toMatchObject({ kind: 'rising' });
  });

  it('is steady within the tolerance', () => {
    const end = blockStats('b2', { hints: 47, attempts: 40 });

    expect(hintTrend([start, end], 24)).toMatchObject({ kind: 'steady' });
  });

  it('leaves out the blocks few students worked on and those nobody started', () => {
    const end = blockStats('b2', { hints: 0, attempts: 40 });
    const resit = blockStats('b3', { hints: 1, attempts: 1, activeStudents: 1 });
    const empty = blockStats('b4', { hints: 0, attempts: 0, activeStudents: 0 });

    expect(hintTrend([start, end, resit, empty], 24)).toMatchObject({ kind: 'falling', last: end });
  });

  it('is null with fewer than two representative blocks', () => {
    expect(hintTrend([start], 24)).toBeNull();
    expect(hintTrend([start, blockStats('b2', { activeStudents: 2 })], 24)).toBeNull();
    expect(hintTrend([], 0)).toBeNull();
  });
});
