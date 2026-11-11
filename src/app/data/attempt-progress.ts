import type { StoredAttemptStatus } from './attempt';
import type { AssignedExercise } from './exercise';
import type { HintLevel, TutorTrigger } from './tutor';

/** What a catalog card says of the assignment, before looking at the attempts. */
export type AssignmentCard = Pick<
  AssignedExercise,
  'exercise' | 'assignmentId' | 'group' | 'block'
>;

/**
 * A card of the catalog with the student's attempts at its assignment: the status, the date and the
 * hints of the one that counts, and the practice after it apart. Both data services build it so.
 */
export function assignedExercise(
  card: AssignmentCard,
  attempts: readonly AttemptSummary[],
): AssignedExercise {
  const { counted, practice, repetitions } = assignmentProgress(attempts);
  return {
    ...card,
    updatedAt: counted?.updatedAt ?? null,
    status: counted?.status ?? 'not_started',
    hintCount: counted?.hintCount ?? 0,
    hintLevel: counted?.hintLevel ?? null,
    practice,
    repetitions,
  };
}

/** One attempt of the student at an assignment, as the catalog shows it. */
export interface AttemptSummary {
  readonly number: number;
  readonly status: StoredAttemptStatus;
  readonly updatedAt: string;
  /** Hints the student asked for («Pedir pista»). */
  readonly hintCount: number;
  /** Highest level the tutor reached, or null without interactions. */
  readonly hintLevel: HintLevel | null;
}

/** The attempts of a student at an assignment: the one that counts and the practice after it. */
export interface AssignmentProgress {
  readonly counted: AttemptSummary | null;
  /** The latest attempt after the one that counts, or null. */
  readonly practice: AttemptSummary | null;
  /** Attempts after the one that counts. */
  readonly repetitions: number;
}

/**
 * The attempt that counts for the class (statistics, history and catalog): the first submitted or,
 * while none is, the first. A new one only starts once the latest is submitted (2.5c), so it is
 * always number 1; the rule says why, not how the numbers happen to go.
 */
export function countedAttempt<
  Attempt extends { readonly number: number; readonly status: string },
>(attempts: readonly Attempt[]): Attempt | undefined {
  const sorted = [...attempts].sort((a, b) => a.number - b.number);
  return sorted.find((attempt) => attempt.status === 'submitted') ?? sorted[0];
}

/** Splits the attempts at an assignment into the one that counts and the practice. */
export function assignmentProgress(attempts: readonly AttemptSummary[]): AssignmentProgress {
  const counted = countedAttempt(attempts) ?? null;
  const latest = attempts.reduce<AttemptSummary | null>(
    (found, attempt) => (found === null || attempt.number > found.number ? attempt : found),
    null,
  );
  return {
    counted,
    practice: latest === counted ? null : latest,
    repetitions: Math.max(attempts.length - 1, 0),
  };
}

/** An attempt with what the tutor did in it, in the shape of the catalog. */
export function summarizeAttempt(
  attempt: Pick<AttemptSummary, 'number' | 'status' | 'updatedAt'>,
  interactions: readonly { readonly trigger: TutorTrigger; readonly hintLevel: HintLevel }[],
): AttemptSummary {
  const levels = interactions.map((interaction) => interaction.hintLevel);
  return {
    number: attempt.number,
    status: attempt.status,
    updatedAt: attempt.updatedAt,
    hintCount: interactions.filter((interaction) => interaction.trigger === 'hint').length,
    hintLevel: levels.length ? (Math.max(...levels) as HintLevel) : null,
  };
}
