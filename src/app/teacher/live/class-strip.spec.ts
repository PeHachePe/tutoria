import type { LiveExercise } from '../../data/live-service';
import { classStrip } from './class-strip';
import { BLOCK_EXERCISES, testRow } from './live-testing';

/** Ten exercises of one block, `e1`…`e10`. */
const EXERCISES: LiveExercise[] = Array.from({ length: 10 }, (_, index) => ({
  ...BLOCK_EXERCISES[0],
  assignmentId: `e${index + 1}`,
}));

/** A student working at exercise `position` (from 1) with a status. */
function at(
  name: string,
  position: number,
  status: 'in_progress' | 'tests_failed' | 'passed' | 'submitted' = 'in_progress',
  work: 'working' | 'stopped' | 'absent' = 'working',
) {
  return testRow({
    student: { id: name.toLowerCase(), name: `${name} Pérez` },
    exercise: EXERCISES[position - 1],
    position,
    status,
    work,
  });
}

describe('classStrip', () => {
  it('has a column per exercise, in order, with who is there by status', () => {
    const strip = classStrip(
      [at('Ana', 2), at('Bea', 2, 'tests_failed'), at('Cai', 5, 'submitted')],
      EXERCISES,
      true,
    );

    expect(strip.columns).toHaveLength(10);
    expect(strip.columns[1]).toMatchObject({
      position: 2,
      total: 2,
      counts: { in_progress: 1, tests_failed: 1, passed: 0, submitted: 0 },
    });
    expect(strip.columns[4].counts.submitted).toBe(1);
    expect(strip.columns[0].total).toBe(0);
  });

  it('counts only the session in class, and everybody with an attempt out of class', () => {
    const rows = [at('Ana', 2), at('Bea', 3, 'in_progress', 'absent'), testRow()];

    expect(
      classStrip(rows, EXERCISES, true)
        .columns.map((c) => c.total)
        .slice(0, 3),
    ).toEqual([0, 1, 0]);
    expect(
      classStrip(rows, EXERCISES, false)
        .columns.map((c) => c.total)
        .slice(0, 3),
    ).toEqual([0, 1, 1]);
  });

  it('counts an attempt not started yet as in progress: the student is there', () => {
    const opened = testRow({ exercise: EXERCISES[0], position: 1, work: 'working' });

    expect(classStrip([opened], EXERCISES, true).columns[0].counts.in_progress).toBe(1);
  });

  it('leaves out who works in another block', () => {
    const elsewhere = testRow({
      exercise: { ...EXERCISES[0], assignmentId: 'other' },
      work: 'working',
    });

    expect(classStrip([elsewhere], EXERCISES, true).columns.every((c) => c.total === 0)).toBe(true);
  });

  it('says where most of the class is: the middle half', () => {
    const rows = [1, 4, 4, 5, 5, 5, 6, 9].map((p, i) => at(`S${i}`, p));

    expect(classStrip(rows, EXERCISES, true).bulk).toEqual({ from: 4, to: 6 });
  });

  it('has no bulk nor outliers without anybody', () => {
    expect(classStrip([], EXERCISES, true)).toMatchObject({ bulk: null, outliers: [] });
  });

  it('names who is alone far behind or far ahead of the bulk, by first name', () => {
    const rows = [
      at('Hugo', 1),
      ...[5, 5, 5, 6, 6, 6].map((p, i) => at(`S${i}`, p)),
      at('Lía', 10, 'tests_failed'),
    ];

    expect(classStrip(rows, EXERCISES, true).outliers).toEqual([
      { position: 1, side: 'behind', names: ['Hugo'] },
      { position: 10, side: 'ahead', names: ['Lía'] },
    ]);
  });

  it('does not name a group, nor anybody close to the bulk, nor in a small class', () => {
    const group = [1, 1, 1, ...[5, 5, 5, 6, 6, 6]].map((p, i) => at(`S${i}`, p));
    const close = [3, ...[5, 5, 5, 6, 6, 6]].map((p, i) => at(`S${i}`, p));
    const small = [1, 6, 6].map((p, i) => at(`S${i}`, p));

    expect(classStrip(group, EXERCISES, true).outliers).toEqual([]);
    expect(classStrip(close, EXERCISES, true).outliers).toEqual([]);
    expect(classStrip(small, EXERCISES, true).outliers).toEqual([]);
  });

  it('names two students together in the same exercise', () => {
    const rows = [
      at('Hugo', 1),
      at('Ana', 1),
      ...[6, 6, 6, 7, 7, 7, 7].map((p, i) => at(`S${i}`, p)),
    ];

    expect(classStrip(rows, EXERCISES, true).outliers).toEqual([
      { position: 1, side: 'behind', names: ['Ana', 'Hugo'] },
    ]);
  });
});
