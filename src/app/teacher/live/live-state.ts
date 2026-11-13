import type { Attempt } from '../../data/attempt';
import type { LiveExercise, LiveSnapshot, LiveStudent, LiveUpdate } from '../../data/live-service';
import type { ProcessEvent } from '../../data/process-event';
import type { TutorInteraction } from '../../data/tutor';

/** What a student has done in the block: their attempts and the events of those attempts. */
export interface StudentActivity {
  readonly student: LiveStudent;
  readonly attempts: readonly Attempt[];
  readonly events: readonly ProcessEvent[];
  /**
   * Tutor interactions that arrived live: the snapshot does not carry them, the panel does not need
   * them, and the detail of the attempt (4.2) adds them to the ones it loads.
   */
  readonly interactions: readonly TutorInteraction[];
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
      return [student.id, { student, attempts, events, interactions: [] }];
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
