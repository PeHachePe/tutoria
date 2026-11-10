import { inject, Service } from '@angular/core';

import type { AttemptStatus } from '../attempt';
import { DataError } from '../data-error';
import type { AssignedExercise, Exercise, ExerciseAssignment, ExerciseDetail } from '../exercise';
import { ExerciseService, ExerciseWithTests } from '../exercise-service';
import type { HintLevel } from '../tutor';
import { SUPABASE_CLIENT } from './supabase-client';
import { unwrap } from './supabase-error';
import { toExercise, toIso, toTest } from './supabase-rows';

/**
 * Exercises, tests and assignments in Supabase. The RLS decides what each user reads (2.1): a
 * student only gets the exercises assigned to their groups and their visible tests.
 */
@Service({ autoProvided: false })
export class SupabaseExerciseService extends ExerciseService {
  private readonly supabase = inject(SUPABASE_CLIENT);

  /**
   * Two requests at once, whatever the number of cards: the assignments of the student's groups,
   * with their exercise and the title of their session, and the student's attempts, with what the
   * tutor answered in them (one attempt per exercise, 2.1).
   */
  async listAssigned(userId: string): Promise<AssignedExercise[]> {
    const [assignments, attempts] = await Promise.all([
      this.supabase
        .from('exercise_assignment')
        .select(
          'id, session, exercise(*), class_session(title), class_group!inner(enrollment!inner(user_id))',
        )
        .eq('class_group.enrollment.user_id', userId)
        .order('session')
        .order('id'),
      this.supabase
        .from('attempt')
        .select('exercise_id, status, updated_at, tutor_interaction(trigger, hint_level)')
        .eq('user_id', userId),
    ]);
    const attemptOf = new Map(unwrap(attempts).map((attempt) => [attempt.exercise_id, attempt]));
    return unwrap(assignments).map((assignment) => {
      const attempt = attemptOf.get(assignment.exercise.id);
      const interactions = attempt?.tutor_interaction ?? [];
      const levels = interactions.map((interaction) => interaction.hint_level as HintLevel);
      return {
        exercise: toExercise(assignment.exercise),
        assignmentId: assignment.id,
        session: assignment.session,
        sessionTitle: assignment.class_session.title,
        updatedAt: attempt ? toIso(attempt.updated_at) : null,
        status: (attempt?.status ?? 'not_started') satisfies AttemptStatus,
        hintCount: interactions.filter((interaction) => interaction.trigger === 'hint').length,
        hintLevel: levels.length ? (Math.max(...levels) as HintLevel) : null,
      };
    });
  }

  async getDetail(exerciseId: string): Promise<ExerciseDetail> {
    const [exercise, tests, hidden] = await Promise.all([
      this.supabase.from('exercise').select().eq('id', exerciseId).single(),
      this.supabase
        .from('test')
        .select()
        .eq('exercise_id', exerciseId)
        .eq('is_hidden', false)
        .order('position'),
      this.supabase.rpc('hidden_test_count', { target_exercise_id: exerciseId }),
    ]);
    return {
      exercise: toExercise(unwrap(exercise)),
      visibleTests: unwrap(tests).map(toTest),
      hiddenTestCount: unwrap(hidden),
    };
  }

  async list(): Promise<Exercise[]> {
    return unwrap(await this.supabase.from('exercise').select().order('created_at')).map(
      toExercise,
    );
  }

  async getWithTests(exerciseId: string): Promise<ExerciseWithTests> {
    const row = unwrap(
      await this.supabase
        .from('exercise')
        .select('*, test(*)')
        .eq('id', exerciseId)
        .order('position', { referencedTable: 'test' })
        .single(),
    );
    const { test, ...exercise } = row;
    return { exercise: toExercise(exercise), tests: test.map(toTest) };
  }

  /**
   * Saving an exercise writes it and replaces its tests, which must happen at once: it arrives with
   * the teacher's screen, as a function of the database (step 4.3).
   */
  create(): Promise<Exercise> {
    return savingNotYet();
  }

  update(): Promise<Exercise> {
    return savingNotYet();
  }

  /** An exercise with attempts cannot be deleted (`on delete restrict`): `invalid`. */
  async remove(exerciseId: string): Promise<void> {
    const deleted = unwrap(
      await this.supabase.from('exercise').delete().eq('id', exerciseId).select('id'),
    );
    if (deleted.length === 0) throw new DataError('not_found');
  }

  async listAssignments(groupId: string): Promise<ExerciseAssignment[]> {
    const rows = unwrap(
      await this.supabase
        .from('exercise_assignment')
        .select('id, group_id, exercise_id, session')
        .eq('group_id', groupId)
        .order('session')
        .order('id'),
    );
    return rows.map(toAssignment);
  }

  async assign(assignment: Omit<ExerciseAssignment, 'id'>): Promise<ExerciseAssignment> {
    const row = unwrap(
      await this.supabase
        .from('exercise_assignment')
        .insert({
          group_id: assignment.groupId,
          exercise_id: assignment.exerciseId,
          session: assignment.session,
        })
        .select('id, group_id, exercise_id, session')
        .single(),
    );
    return toAssignment(row);
  }

  /** The attempts stay, without their assignment (`on delete set null`). */
  async unassign(assignmentId: string): Promise<void> {
    const deleted = unwrap(
      await this.supabase.from('exercise_assignment').delete().eq('id', assignmentId).select('id'),
    );
    if (deleted.length === 0) throw new DataError('not_found');
  }
}

function toAssignment(row: {
  id: string;
  group_id: string;
  exercise_id: string;
  session: number;
}): ExerciseAssignment {
  return {
    id: row.id,
    groupId: row.group_id,
    exerciseId: row.exercise_id,
    session: row.session,
  };
}

function savingNotYet(): Promise<Exercise> {
  return Promise.reject(new DataError('unavailable', 'Saving exercises arrives in step 4.3'));
}
