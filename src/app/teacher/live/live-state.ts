import type { Attempt } from '../../data/attempt';
import type { LiveExercise, LiveSnapshot, LiveStudent, LiveUpdate } from '../../data/live-service';
import type { ProcessEvent } from '../../data/process-event';

/** What a student has done in the block: their attempts and the events of those attempts. */
export interface StudentActivity {
  readonly student: LiveStudent;
  readonly attempts: readonly Attempt[];
  readonly events: readonly ProcessEvent[];
}

/** A block followed live: its exercises and, by student id, what each one has done. */
export interface LiveState {
  readonly exercises: readonly LiveExercise[];
  /** In the order of the snapshot (by name). */
  readonly students: ReadonlyMap<string, StudentActivity>;
}

/** The state of a block from its snapshot. */
export function liveState(snapshot: LiveSnapshot): LiveState {
  const students = new Map(
    snapshot.students.map((student) => {
      const attempts = snapshot.attempts.filter((attempt) => attempt.userId === student.id);
      const attemptIds = new Set(attempts.map((attempt) => attempt.id));
      const events = snapshot.events.filter((event) => attemptIds.has(event.attemptId));
      return [student.id, { student, attempts, events }];
    }),
  );
  return { exercises: snapshot.exercises, students };
}

/**
 * The state after a live change, without mutating the previous one: only the student it concerns
 * gets a new entry. Changes of other blocks or groups, unknown attempts and repeated events leave
 * the very same state, so nothing derived from it recomputes.
 */
export function applyLiveUpdate(state: LiveState, update: LiveUpdate): LiveState {
  return update.type === 'attempt'
    ? applyAttempt(state, update.attempt)
    : applyEvent(state, update.event);
}

function applyAttempt(state: LiveState, attempt: Attempt): LiveState {
  const activity = state.students.get(attempt.userId);
  const inBlock = state.exercises.some((entry) => entry.assignmentId === attempt.assignmentId);
  if (!activity || !inBlock) {
    return state;
  }
  const others = activity.attempts.filter((candidate) => candidate.id !== attempt.id);
  return withStudent(state, { ...activity, attempts: [...others, attempt] });
}

function applyEvent(state: LiveState, event: ProcessEvent): LiveState {
  const activity = [...state.students.values()].find(({ attempts }) =>
    attempts.some((attempt) => attempt.id === event.attemptId),
  );
  if (!activity || activity.events.some((known) => known.id === event.id)) {
    return state;
  }
  return withStudent(state, { ...activity, events: [...activity.events, event] });
}

function withStudent(state: LiveState, activity: StudentActivity): LiveState {
  const students = new Map(state.students);
  students.set(activity.student.id, activity);
  return { ...state, students };
}
