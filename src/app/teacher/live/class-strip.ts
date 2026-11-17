import type { LiveExercise } from '../../data/live-service';
import type { LiveRow } from './live-row';

/** The statuses a student at an exercise can be in: with an attempt, at least in progress. */
export type StripStatus = 'in_progress' | 'tests_failed' | 'passed' | 'submitted';

/** Students far from the bulk the strip names: one or two, never a group (D-070). */
export const OUTLIER_STUDENTS = 2;
/** Exercises away from the bulk from which a student is far behind or ahead. */
export const OUTLIER_GAP = 2;
/** Students in the strip under which nobody is named: in a small class, everybody is «far». */
export const OUTLIER_MIN_CLASS = 6;

/** An exercise of the block and who is at it now. */
export interface StripColumn {
  readonly exercise: LiveExercise;
  /** In its block, from 1. */
  readonly position: number;
  readonly total: number;
  readonly counts: Readonly<Record<StripStatus, number>>;
}

/** One or two students alone far from the bulk, named over their column. */
export interface StripOutlier {
  readonly position: number;
  readonly side: 'behind' | 'ahead';
  /** First names, sorted. */
  readonly names: readonly string[];
}

/** «Dónde está la clase» as one strip: where each student is in the block. */
export interface ClassStrip {
  readonly columns: readonly StripColumn[];
  /** Where the middle half of the class is, by position; null without anybody. */
  readonly bulk: { readonly from: number; readonly to: number } | null;
  readonly outliers: readonly StripOutlier[];
}

/**
 * Where each student is in a block (D-070): a column per exercise with who is at it now, by
 * status, the middle half of the class, and who is alone far from it. It answers «where is the
 * class» with 5 exercises or 200 in the same room, and does not hide a student alone at an
 * exercise. In class, the students of the session; out of class, everybody with an attempt, where
 * they left off. `exercises` are those of the block, in order.
 */
export function classStrip(
  rows: readonly LiveRow[],
  exercises: readonly LiveExercise[],
  inClass: boolean,
): ClassStrip {
  const positionOf = new Map(
    exercises.map((exercise, index) => [exercise.assignmentId, index + 1]),
  );
  const placed = rows.flatMap((row) => {
    const position = row.exercise && positionOf.get(row.exercise.assignmentId);
    if (!position || (inClass && row.work === 'absent')) return [];
    const status: StripStatus = row.status === 'not_started' ? 'in_progress' : row.status;
    return [{ row, position, status }];
  });

  const columns = exercises.map((exercise, index): StripColumn => {
    const here = placed.filter((entry) => entry.position === index + 1);
    const count = (status: StripStatus) => here.filter((entry) => entry.status === status).length;
    return {
      exercise,
      position: index + 1,
      total: here.length,
      counts: {
        in_progress: count('in_progress'),
        tests_failed: count('tests_failed'),
        passed: count('passed'),
        submitted: count('submitted'),
      },
    };
  });

  const positions = placed.map((entry) => entry.position).sort((a, b) => a - b);
  if (positions.length === 0) return { columns, bulk: null, outliers: [] };
  const last = positions.length - 1;
  const bulk = {
    from: positions[Math.floor(last * 0.25)],
    to: positions[Math.ceil(last * 0.75)],
  };

  const outliers =
    positions.length < OUTLIER_MIN_CLASS
      ? []
      : columns.flatMap((column): StripOutlier[] => {
          const behind = column.position < bulk.from - OUTLIER_GAP;
          const ahead = column.position > bulk.to + OUTLIER_GAP;
          if (column.total === 0 || column.total > OUTLIER_STUDENTS || !(behind || ahead)) {
            return [];
          }
          const names = placed
            .filter((entry) => entry.position === column.position)
            .map((entry) => entry.row.student.name.split(' ')[0])
            .sort((a, b) => a.localeCompare(b, 'es'));
          return [{ position: column.position, side: behind ? 'behind' : 'ahead', names }];
        });
  return { columns, bulk, outliers };
}
