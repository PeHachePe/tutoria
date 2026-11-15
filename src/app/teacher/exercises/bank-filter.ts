import type { Difficulty } from '../../data/exercise';
import type { BankExercise } from '../../data/exercise-service';
import { type ContentLocale, exerciseText } from '../../data/localized-text';
import { searchable } from '../../shared/searchable';

/**
 * The filters of the part of the bank that is loaded (4.3), which live in its URL. The subjects
 * choose that part, in the server (`BankScope`).
 */
export interface BankFilters {
  readonly search: string;
  readonly difficulty: Difficulty | null;
  /** Only the exercises the user wrote. */
  readonly mine: boolean;
  /** The archived exercises instead of the others (D-060): out of the bank, not deleted. */
  readonly archived: boolean;
}

export const NO_FILTERS: BankFilters = {
  search: '',
  difficulty: null,
  mine: false,
  archived: false,
};

/** Who looks at the bank: the language they read in and who they are. */
export interface BankReader {
  readonly locale: ContentLocale;
  /** Nobody's exercises are «mine» without one. */
  readonly userId: string | undefined;
}

/**
 * The exercises that pass every filter: the archived ones or the others, never both. The search looks in the title and topics of every language
 * (a teacher may remember the exercise by its English title) and in the function, without accents
 * nor capitals: «ano bisiesto» finds «Año bisiesto».
 */
export function filterBank(
  entries: readonly BankExercise[],
  filters: BankFilters,
  reader: BankReader,
): BankExercise[] {
  const words = searchable(filters.search).split(/\s+/).filter(Boolean);
  return entries.filter(
    ({ exercise }) =>
      (exercise.archivedAt !== null) === filters.archived &&
      (filters.difficulty === null || exercise.difficulty === filters.difficulty) &&
      (!filters.mine || exercise.createdBy === reader.userId) &&
      words.every((word) => haystackOf(exercise, reader.locale).includes(word)),
  );
}

function haystackOf(exercise: BankExercise['exercise'], locale: ContentLocale): string {
  const texts = [exerciseText(exercise, locale), exercise, ...Object.values(exercise.translations)];
  return searchable(
    [exercise.functionName, ...texts.flatMap((text) => [text.title, ...text.topics])].join(' '),
  );
}

/** Exercises per page: a screen or two of rows, light to draw however big the bank grows. */
export const BANK_PAGE_SIZE = 20;

/** A page of rows, from 0; a page past the end shows the last one (a link kept after deleting). */
export function pageOf<Row>(
  rows: readonly Row[],
  pageIndex: number,
  pageSize = BANK_PAGE_SIZE,
): { readonly rows: readonly Row[]; readonly pageIndex: number } {
  const last = Math.max(0, Math.ceil(rows.length / pageSize) - 1);
  const wanted = Number.isFinite(pageIndex) ? Math.trunc(pageIndex) : 0;
  const index = Math.min(Math.max(0, wanted), last);
  return { rows: rows.slice(index * pageSize, (index + 1) * pageSize), pageIndex: index };
}
