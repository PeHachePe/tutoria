import { countedAttempt } from '../attempt-progress';
import type { Attempt } from '../attempt';
import type { ClassBlock, Exercise, ExerciseAssignment } from '../exercise';
import type { LiveStudent } from '../live-service';
import type { ProcessEvent } from '../process-event';
import {
  type BlockStats,
  DEADLINE_LAST_HOURS,
  type DeadlineStats,
  type GroupHistory,
  type MissingSubmission,
  type WorkStats,
} from '../stats-service';
import { longestFailureStreak } from '../../shared/is-stuck';
import { isVisibleAssignment } from './mock-access';
import type { MockTables } from './mock-tables';

const SECOND_MS = 1000;
const HOUR_MS = 3_600_000;
const SOLVED: ReadonlySet<Attempt['status']> = new Set(['passed', 'submitted']);

/** An attempt that counts, with its exercise. */
interface CountedEntry {
  readonly attempt: Attempt;
  readonly exercise: Exercise;
}

/**
 * The history of a group over the mock tables (ficha 09, D-073), as the RPC of 4.5 will count it:
 * of those enrolled now, the attempt that counts of each student and assignment (`countedAttempt()`).
 */
export function groupHistoryOf(tables: MockTables, groupId: string): GroupHistory {
  const enrolled = new Set(
    tables.enrollments.filter((enrollment) => enrollment.groupId === groupId).map((e) => e.userId),
  );
  const students: LiveStudent[] = tables.users
    .filter((user) => enrolled.has(user.id))
    .map(({ id, name }) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));
  const blocks = tables.classBlocks
    .filter((block) => block.groupId === groupId)
    .sort((a, b) => a.position - b.position);
  const assignments = tables.assignments.filter((assignment) => assignment.groupId === groupId);
  const counted = countedAttempts(tables.attempts, enrolled);
  const events = eventsByAttempt(tables.events);
  const exercises = new Map(tables.exercises.map((exercise) => [exercise.id, exercise]));

  /** The figures of some attempts, each with the exercise whose threshold says who got stuck. */
  const statsOf = (entries: readonly CountedEntry[]): WorkStats => ({
    attempts: entries.length,
    activeStudents: new Set(entries.map(({ attempt }) => attempt.userId)).size,
    hints: entries
      .flatMap(({ attempt }) => events.get(attempt.id) ?? [])
      .filter((event) => event.type === 'hint_requested').length,
    solved: entries.filter(({ attempt }) => SOLVED.has(attempt.status)).length,
    medianSeconds: median(
      entries.flatMap(({ attempt }) =>
        attempt.status === 'submitted'
          ? [(finishedAt(attempt) - Date.parse(attempt.startedAt)) / SECOND_MS]
          : [],
      ),
    ),
    stuckStudents: new Set(
      entries
        .filter(
          ({ attempt, exercise }) =>
            longestFailureStreak(events.get(attempt.id) ?? []) >= exercise.maxRepeatedFailures,
        )
        .map(({ attempt }) => attempt.userId),
    ).size,
  });

  const blockStats = blocks.map((block): BlockStats => {
    const ofBlock = assignments
      .filter((assignment) => assignment.blockId === block.id)
      .sort((a, b) => a.position - b.position)
      .map((assignment) => {
        const exercise = exercises.get(assignment.exerciseId) as Exercise;
        const entries = (counted.get(assignment.id) ?? []).map((attempt) => ({
          attempt,
          exercise,
        }));
        return { assignment, exercise, entries };
      })
      .filter(({ assignment, entries }) => !assignment.isHidden || entries.length > 0);
    return {
      block,
      assignments: ofBlock.length,
      ...statsOf(ofBlock.flatMap(({ entries }) => entries)),
      exercises: ofBlock.map(({ assignment, exercise, entries }) => ({
        assignmentId: assignment.id,
        exercise,
        ...statsOf(entries),
      })),
    };
  });

  return {
    students: students.length,
    blocks: blockStats,
    deadlines: students.length
      ? deadlinesOf(
          blocks,
          assignments.filter((a) => a.dueAt !== null && isVisibleAssignment(tables, a)),
          students,
          counted,
        )
      : [],
  };
}

/** Of each assignment, the attempt that counts of each student enrolled now. */
function countedAttempts(
  attempts: readonly Attempt[],
  enrolled: ReadonlySet<string>,
): ReadonlyMap<string, Attempt[]> {
  const byKey = new Map<string, Attempt[]>();
  for (const attempt of attempts) {
    if (attempt.assignmentId === null || !enrolled.has(attempt.userId)) continue;
    const key = `${attempt.assignmentId}|${attempt.userId}`;
    byKey.set(key, [...(byKey.get(key) ?? []), attempt]);
  }
  const byAssignment = new Map<string, Attempt[]>();
  for (const candidates of byKey.values()) {
    const attempt = countedAttempt(candidates) as Attempt;
    const assignmentId = attempt.assignmentId as string;
    byAssignment.set(assignmentId, [...(byAssignment.get(assignmentId) ?? []), attempt]);
  }
  return byAssignment;
}

function eventsByAttempt(events: readonly ProcessEvent[]): ReadonlyMap<string, ProcessEvent[]> {
  const byAttempt = new Map<string, ProcessEvent[]>();
  for (const event of events) {
    byAttempt.set(event.attemptId, [...(byAttempt.get(event.attemptId) ?? []), event]);
  }
  return byAttempt;
}

/** The middle value, or the mean of the two middle ones, rounded; null without values. */
function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return Math.round(sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2);
}

/** When a submitted attempt was submitted: the server always sets it on submitting (2.4). */
function finishedAt(attempt: Attempt): number {
  return Date.parse(attempt.finishedAt as string);
}

/** One entry per block and due date, by date and then by the order of the blocks. */
function deadlinesOf(
  blocks: readonly ClassBlock[],
  assignments: readonly ExerciseAssignment[],
  students: readonly LiveStudent[],
  counted: ReadonlyMap<string, Attempt[]>,
): DeadlineStats[] {
  const groups = new Map<string, ExerciseAssignment[]>();
  for (const assignment of assignments) {
    const key = `${assignment.blockId}|${assignment.dueAt}`;
    groups.set(key, [...(groups.get(key) ?? []), assignment]);
  }
  const order = (blockId: string) => blocks.findIndex((block) => block.id === blockId);
  return [...groups.values()]
    .map((group) => deadlineOf(group, students, counted))
    .sort(
      (a, b) => Date.parse(a.dueAt) - Date.parse(b.dueAt) || order(a.blockId) - order(b.blockId),
    );
}

function deadlineOf(
  assignments: readonly ExerciseAssignment[],
  students: readonly LiveStudent[],
  counted: ReadonlyMap<string, Attempt[]>,
): DeadlineStats {
  const { blockId, dueAt } = assignments[0];
  const due = Date.parse(dueAt as string);
  const lastHoursFrom = due - DEADLINE_LAST_HOURS * HOUR_MS;
  let onTime = 0;
  let lastHours = 0;
  let late = 0;
  const missing: MissingSubmission[] = [];
  for (const student of students) {
    let pending = 0;
    for (const assignment of assignments) {
      const attempt = counted.get(assignment.id)?.find((a) => a.userId === student.id);
      if (attempt?.status !== 'submitted') {
        pending++;
        continue;
      }
      const finished = finishedAt(attempt);
      if (finished > due) {
        late++;
      } else {
        onTime++;
        if (finished > lastHoursFrom) lastHours++;
      }
    }
    if (pending) missing.push({ student, pending });
  }
  return {
    blockId,
    dueAt: dueAt as string,
    assignments: assignments.length,
    onTime,
    lastHours,
    late,
    missing,
  };
}
