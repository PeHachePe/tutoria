import type { Attempt } from '../attempt';
import type { Exercise, Test } from '../exercise';
import type { ExerciseTranslations } from '../exercise-text';
import type { ProcessEvent } from '../process-event';
import type { HintLevel, Intensity, TutorInteraction } from '../tutor';
import type { AppUser } from '../user';
import type { Database } from './database.types';

type Tables = Database['public']['Tables'];

/** A row of a table, as PostgREST returns it. */
export type Row<Table extends keyof Tables> = Tables[Table]['Row'];

/**
 * The same ISO format the mock data uses (`2026-09-01T08:00:00.000Z`): Postgres answers with its
 * own (`2026-09-01 08:00:00+00`), and the screens sort dates as text.
 */
export function toIso(timestamp: string): string {
  return new Date(timestamp).toISOString();
}

function toIsoOrNull(timestamp: string | null): string | null {
  return timestamp === null ? null : toIso(timestamp);
}

/** From the columns of the database to the types of the app (`data/*.ts`). */
export function toAppUser(row: Row<'app_user'>): AppUser {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    status: row.status,
    privacyNoticeSeenAt: toIsoOrNull(row.privacy_notice_seen_at),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

export function toExercise(row: Row<'exercise'>): Exercise {
  return {
    id: row.id,
    title: row.title,
    statement: row.statement,
    difficulty: row.difficulty,
    topics: row.topics,
    sourceLocale: row.source_locale,
    // A check of the table gives it this shape (is_valid_exercise_translations)
    translations: row.translations as ExerciseTranslations,
    language: row.language,
    functionName: row.function_name,
    maxRepeatedFailures: row.max_repeated_failures,
    maxIdleMinutes: row.max_idle_minutes,
    createdBy: row.created_by,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

export function toTest(row: Row<'test'>): Test {
  return {
    id: row.id,
    exerciseId: row.exercise_id,
    // A check of the table makes it a JSON array
    input: row.input as unknown[],
    expectedOutput: row.expected_output,
    isHidden: row.is_hidden,
    position: row.position,
  };
}

export function toAttempt(row: Row<'attempt'>): Attempt {
  return {
    id: row.id,
    exerciseId: row.exercise_id,
    userId: row.user_id,
    assignmentId: row.assignment_id,
    currentCode: row.current_code,
    finalCode: row.final_code,
    status: row.status,
    startedAt: toIso(row.started_at),
    finishedAt: toIsoOrNull(row.finished_at),
    updatedAt: toIso(row.updated_at),
  };
}

export function toProcessEvent(row: Row<'process_event'>): ProcessEvent {
  // Each type keeps its own detail: the server and the browser write it with that shape (2.8)
  return {
    id: row.id,
    attemptId: row.attempt_id,
    type: row.type,
    timestamp: toIso(row.timestamp),
    detail: row.detail,
  } as ProcessEvent;
}

export function toTutorInteraction(row: Row<'tutor_interaction'>): TutorInteraction {
  return {
    id: row.id,
    attemptId: row.attempt_id,
    trigger: row.trigger,
    // Checks of the table keep both between 1 and 3
    hintLevel: row.hint_level as HintLevel,
    studentMessage: row.student_message,
    transcript: row.transcript,
    emotion: row.emotion,
    intensity: row.intensity as Intensity,
    elusion: row.elusion,
    promptVersion: row.prompt_version,
    createdAt: toIso(row.created_at),
  };
}
