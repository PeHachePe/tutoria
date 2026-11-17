import { pageOf } from './page-of';

describe('pageOf', () => {
  const rows = Array.from({ length: 45 }, (_, i) => i);

  it('cuts the rows into pages of the size given', () => {
    expect(pageOf(rows, 0, 20)).toEqual({ rows: rows.slice(0, 20), pageIndex: 0 });
    expect(pageOf(rows, 2, 20)).toEqual({ rows: [40, 41, 42, 43, 44], pageIndex: 2 });
    expect(pageOf(rows, 1, 8).rows).toEqual(rows.slice(8, 16));
  });

  it('shows the last page for a page past the end, and the first for nonsense', () => {
    expect(pageOf(rows, 9, 20).pageIndex).toBe(2);
    expect(pageOf(rows, -1, 20).pageIndex).toBe(0);
    expect(pageOf(rows, Number.NaN, 20).pageIndex).toBe(0);
    expect(pageOf([], 3, 20)).toEqual({ rows: [], pageIndex: 0 });
  });
});
