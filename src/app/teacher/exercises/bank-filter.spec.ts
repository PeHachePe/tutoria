import type { BankExercise } from '../../data/exercise-service';
import { SEED } from '../../data/mock/fixtures/seed';
import { OTHER_TEACHER_ID, TEACHER_ID } from '../../data/mock/fixtures/users';
import { type BankFilters, filterBank, NO_FILTERS, pageOf } from './bank-filter';

const BANK: readonly BankExercise[] = SEED.exercises.map((exercise) => ({
  exercise,
  subjectIds: SEED.exerciseSubjects
    .filter((row) => row.exerciseId === exercise.id)
    .map((row) => row.subjectId),
  testCount: 3,
  studentCount: 0,
  groups: [],
}));

function titles(filters: Partial<BankFilters>, userId = TEACHER_ID): string[] {
  return filterBank(BANK, { ...NO_FILTERS, ...filters }, { locale: 'es', userId }).map(
    (entry) => entry.exercise.functionName,
  );
}

describe('filterBank', () => {
  it('keeps every exercise without filters', () => {
    expect(titles({})).toHaveLength(SEED.exercises.length);
  });

  it('searches the title and topics in any language, without accents nor capitals', () => {
    expect(titles({ search: 'ano bisiesto' })).toEqual(['isLeapYear']);
    expect(titles({ search: 'LEAP' })).toEqual(['isLeapYear']);
    expect(titles({ search: 'traspàs' })).toEqual(['isLeapYear']);
    expect(titles({ search: '  ' })).toHaveLength(SEED.exercises.length);
  });

  it('also finds an exercise by its function', () => {
    expect(titles({ search: 'countvowels' })).toEqual(['countVowels']);
  });

  it('filters by difficulty and author', () => {
    const initial = titles({ difficulty: 'initial' });
    expect(initial).toContain('countEvens');
    expect(initial).not.toContain('gcd');

    expect(titles({ mine: true }, OTHER_TEACHER_ID)).toEqual(
      SEED.exercises
        .filter((exercise) => exercise.createdBy === OTHER_TEACHER_ID)
        .map((exercise) => exercise.functionName),
    );
  });
});

describe('pageOf', () => {
  const rows = Array.from({ length: 45 }, (_, i) => i);

  it('cuts the rows into pages of 20', () => {
    expect(pageOf(rows, 0)).toEqual({ rows: rows.slice(0, 20), pageIndex: 0 });
    expect(pageOf(rows, 2)).toEqual({ rows: [40, 41, 42, 43, 44], pageIndex: 2 });
  });

  it('shows the last page for a page past the end, and the first for nonsense', () => {
    expect(pageOf(rows, 9).pageIndex).toBe(2);
    expect(pageOf(rows, -1).pageIndex).toBe(0);
    expect(pageOf(rows, Number.NaN).pageIndex).toBe(0);
    expect(pageOf([], 3)).toEqual({ rows: [], pageIndex: 0 });
  });
});
