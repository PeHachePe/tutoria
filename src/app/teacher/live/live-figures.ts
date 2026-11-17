import { LIVE_WINDOW_MINUTES } from '../../data/live-service';
import type { LiveRow } from './live-row';
import type { LiveState } from './live-state';

const MINUTE_MS = 60_000;

/** The figures of the header of the panel (D-068), also the filters of the table. */
export interface LiveFigures {
  /** Somebody did something in the session window: live, or «Fuera de clase». */
  readonly inClass: boolean;
  readonly students: number;
  readonly working: number;
  readonly stopped: number;
  readonly absent: number;
  /** The size of the queue. */
  readonly needHelp: number;
  /** With a block, who has it whole submitted; with the whole class, who submitted in the session. */
  readonly finishedIds: ReadonlySet<string>;
  /** With a block, the size of `finishedIds`; with the whole class, the submissions of the session. */
  readonly finished: number;
  /** With a block: submitted exercises over students × exercises, 0 to 100, rounded; else null. */
  readonly progress: number | null;
  /** With a block, who has an attempt at it («Han empezado», out of class); else empty. */
  readonly startedIds: ReadonlySet<string>;
  /** The latest activity of the rows, for «Fuera de clase · última actividad», or null. */
  readonly lastActivity: number | null;
}

/** The figures of a group now; `blockId` null is the whole class. */
export function liveFigures(
  state: LiveState,
  rows: readonly LiveRow[],
  blockId: string | null,
  needHelp: number,
  now: number,
): LiveFigures {
  const count = (work: LiveRow['work']) => rows.filter((row) => row.work === work).length;
  const activities = [...state.students.values()];
  const activity = rows.flatMap((row) => (row.lastActivity === null ? [] : [row.lastActivity]));
  const base = {
    inClass: rows.some((row) => row.work !== 'absent'),
    students: rows.length,
    working: count('working'),
    stopped: count('stopped'),
    absent: count('absent'),
    needHelp,
    lastActivity: activity.length > 0 ? Math.max(...activity) : null,
  };

  if (blockId === null) {
    const from = now - LIVE_WINDOW_MINUTES * MINUTE_MS;
    const submissions = activities.map(({ student, events }) => ({
      student,
      count: events.filter((e) => e.type === 'submit' && Date.parse(e.timestamp) >= from).length,
    }));
    return {
      ...base,
      finishedIds: new Set(submissions.filter((s) => s.count > 0).map((s) => s.student.id)),
      finished: submissions.reduce((total, s) => total + s.count, 0),
      progress: null,
      startedIds: new Set(),
    };
  }

  const assignmentIds = new Set<string | null>(
    state.exercises.filter((e) => e.blockId === blockId).map((e) => e.assignmentId),
  );
  const perStudent = activities.map(({ student, attempts }) => {
    const inBlock = attempts.filter((a) => assignmentIds.has(a.assignmentId));
    return {
      id: student.id,
      started: inBlock.length > 0,
      submitted: new Set(inBlock.filter((a) => a.status === 'submitted').map((a) => a.assignmentId))
        .size,
    };
  });
  const possible = assignmentIds.size * activities.length;
  const submitted = perStudent.reduce((total, student) => total + student.submitted, 0);
  const finishedIds = new Set(
    perStudent
      .filter((student) => assignmentIds.size > 0 && student.submitted === assignmentIds.size)
      .map((student) => student.id),
  );
  return {
    ...base,
    finishedIds,
    finished: finishedIds.size,
    progress: possible === 0 ? null : Math.round((submitted / possible) * 100),
    startedIds: new Set(perStudent.filter((student) => student.started).map((s) => s.id)),
  };
}
