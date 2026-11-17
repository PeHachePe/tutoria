import type { AttemptStatus } from '../../data/attempt';
import { searchable } from '../../shared/searchable';
import type { ClassOverview } from './live-overview';
import type { LiveRow } from './live-row';

/**
 * The filters of «Alumnado», the tabs of the table with their counts (D-068, D-070): `idle` answers
 * «who is not working» (stopped and not in yet), `started` exists only out of class.
 */
export type LiveFilter = 'all' | 'help' | 'working' | 'idle' | 'finished' | 'started';

/** The filters in class, in the order of the tabs. */
export const LIVE_FILTERS: readonly LiveFilter[] = ['all', 'help', 'working', 'idle', 'finished'];
/** The filters out of class: what is accumulated in the block. */
export const OFF_CLASS_FILTERS: readonly LiveFilter[] = ['all', 'started', 'finished'];

/** The value of `?filtro=` of each filter but `all`, which is its absence. */
export const LIVE_FILTER_PARAMS = {
  help: 'ayuda',
  working: 'trabajando',
  idle: 'parados',
  finished: 'terminado',
  started: 'empezado',
} as const satisfies Record<Exclude<LiveFilter, 'all'>, string>;

/**
 * Some students of «Dónde está la clase»: a segment of a bar (an exercise and a status) or, with
 * `testId`, «Ver quiénes» of «Para explicar a todos». Kept as what it is and not as a list of
 * students, so the table follows the chart while the class works.
 */
export interface ChartFilter {
  readonly assignmentId: string;
  readonly status: AttemptStatus;
  readonly testId: string | null;
}

export interface FilterCriteria {
  readonly filter: LiveFilter;
  /** As typed. */
  readonly search: string;
  readonly queuedIds: ReadonlySet<string>;
  readonly finishedIds: ReadonlySet<string>;
  readonly startedIds: ReadonlySet<string>;
  /** Only these students (`studentsOf()` of a `ChartFilter`), or null for any. */
  readonly studentIds: ReadonlySet<string> | null;
}

/** The filter of the URL: `all` without it or with a value it does not know. */
export function liveFilterOf(param: string | undefined): LiveFilter {
  const entry = Object.entries(LIVE_FILTER_PARAMS).find(([, value]) => value === param);
  return (entry?.[0] as LiveFilter | undefined) ?? 'all';
}

/** The rows of «Alumnado» that match the filter, the search and the students of the chart. */
export function filterRows(rows: readonly LiveRow[], criteria: FilterCriteria): LiveRow[] {
  const search = searchable(criteria.search.trim());
  const matches: Record<LiveFilter, (row: LiveRow) => boolean> = {
    all: () => true,
    help: (row) => criteria.queuedIds.has(row.student.id),
    working: (row) => row.work === 'working',
    idle: (row) => row.work !== 'working',
    finished: (row) => criteria.finishedIds.has(row.student.id),
    started: (row) => criteria.startedIds.has(row.student.id),
  };
  return rows.filter(
    (row) =>
      matches[criteria.filter](row) &&
      (criteria.studentIds?.has(row.student.id) ?? true) &&
      searchable(row.student.name).includes(search),
  );
}

/**
 * The students the chart counts in a `ChartFilter` now: those of the segment or, with a test,
 * whoever fails it while it is the test failing most. Nobody if the chart no longer shows it.
 */
export function studentsOf(overview: ClassOverview, filter: ChartFilter): ReadonlySet<string> {
  const exercise = overview.exercises.find(
    (entry) => entry.exercise.assignmentId === filter.assignmentId,
  );
  if (!exercise) return new Set();
  const students =
    filter.testId === null
      ? exercise.students[filter.status]
      : exercise.topFailure?.test.id === filter.testId
        ? exercise.topFailure.students
        : [];
  return new Set(students.map((student) => student.id));
}
