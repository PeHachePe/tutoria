import type { Attempt } from '../../data/attempt';
import type { LiveExercise, LiveSnapshot, LiveStudent, LiveUpdate } from '../../data/live-service';
import type { ProcessEvent } from '../../data/process-event';
import type { TutorInteraction } from '../../data/tutor';

/**
 * What a student has done in the group: their attempts, and the events and tutor interactions of
 * those attempts.
 */
export interface StudentActivity {
  readonly student: LiveStudent;
  readonly attempts: readonly Attempt[];
  readonly events: readonly ProcessEvent[];
  readonly interactions: readonly TutorInteraction[];
}

/** A group followed live: its exercises and, by student id, what each one has done. */
export interface LiveState {
  /** Every exercise of the group, by block and position, as the snapshot gives them. */
  readonly exercises: readonly LiveExercise[];
  /** In the order of the snapshot (by name). */
  readonly students: ReadonlyMap<string, StudentActivity>;
}

/** The state of a group from its snapshot. */
export function liveState(snapshot: LiveSnapshot): LiveState {
  const students = new Map(
    snapshot.students.map((student) => {
      const attempts = snapshot.attempts.filter((attempt) => attempt.userId === student.id);
      const attemptIds = new Set(attempts.map((attempt) => attempt.id));
      const events = snapshot.events.filter((event) => attemptIds.has(event.attemptId));
      const interactions = snapshot.interactions.filter((interaction) =>
        attemptIds.has(interaction.attemptId),
      );
      return [student.id, { student, attempts, events, interactions }];
    }),
  );
  return { exercises: snapshot.exercises, students };
}

/**
 * Position of an exercise in its block, from 1, or null if it is not in the group: counted, as
 * `exercise_assignment.position` may have gaps.
 */
export function exercisePosition(
  exercises: readonly LiveExercise[],
  assignmentId: string,
): number | null {
  const exercise = exercises.find((entry) => entry.assignmentId === assignmentId);
  if (!exercise) return null;
  const block = exercises.filter((entry) => entry.blockId === exercise.blockId);
  return block.indexOf(exercise) + 1;
}

/**
 * The state after a live change, without mutating the previous one: only the student it concerns
 * gets a new entry. Changes of other groups, unknown attempts and repeated events leave
 * the very same state, so nothing derived from it recomputes.
 */
export function applyLiveUpdate(state: LiveState, update: LiveUpdate): LiveState {
  switch (update.type) {
    case 'attempt':
      return applyAttempt(state, update.attempt);
    case 'event':
      return applyEvent(state, update.event);
    case 'interaction':
      return applyInteraction(state, update.interaction);
  }
}

function applyInteraction(state: LiveState, interaction: TutorInteraction): LiveState {
  const activity = [...state.students.values()].find(({ attempts }) =>
    attempts.some((attempt) => attempt.id === interaction.attemptId),
  );
  if (!activity || activity.interactions.some((known) => known.id === interaction.id)) {
    return state;
  }
  return withStudent(state, { ...activity, interactions: [...activity.interactions, interaction] });
}

function applyAttempt(state: LiveState, attempt: Attempt): LiveState {
  const activity = state.students.get(attempt.userId);
  const inGroup = state.exercises.some((entry) => entry.assignmentId === attempt.assignmentId);
  if (!activity || !inGroup) {
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
