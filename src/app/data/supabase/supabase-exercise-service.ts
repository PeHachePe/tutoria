import { inject, Service } from '@angular/core';

import { assignedExercise, type AttemptSummary, summarizeAttempt } from '../attempt-progress';
import { DataError } from '../data-error';
import type {
  AssignedExercise,
  AssignedGroup,
  Exercise,
  ExerciseAssignment,
  ExerciseDetail,
} from '../exercise';
import { ExerciseService, ExerciseWithTests } from '../exercise-service';
import type { HintLevel } from '../tutor';
import { SUPABASE_CLIENT } from './supabase-client';
import { unwrap } from './supabase-error';
import {
  type Row,
  toAssignment,
  toClassBlock,
  toExercise,
  toIso,
  toSubject,
  toTest,
} from './supabase-rows';

/**
 * Exercises, tests and assignments in Supabase. The RLS decides what each user reads (2.1): a
 * student only gets the exercises assigned to their groups and their visible tests.
 */
@Service({ autoProvided: false })
export class SupabaseExerciseService extends ExerciseService {
  private readonly supabase = inject(SUPABASE_CLIENT);

  /**
   * Two requests at once, whatever the number of cards: the assignments the student sees (the RLS
   * leaves out the hidden ones), with their exercise, block, group and subject, and the student's
   * attempts, with what the tutor answered in them.
   */
  async listAssigned(userId: string): Promise<AssignedExercise[]> {
    const [assignments, attempts] = await Promise.all([
      this.supabase
        .from('exercise_assignment')
        .select(
          'id, exercise(*), class_block(*), class_group!inner(id, name, subject(*), enrollment!inner(user_id))',
        )
        .eq('class_group.enrollment.user_id', userId)
        .order('id'),
      this.supabase
        .from('attempt')
        .select('assignment_id, number, status, updated_at, tutor_interaction(trigger, hint_level)')
        .eq('user_id', userId),
    ]);
    const attemptsOf = new Map<string, AttemptSummary[]>();
    for (const attempt of unwrap(attempts)) {
      if (attempt.assignment_id === null) continue;
      const summary = summarizeAttempt(
        { number: attempt.number, status: attempt.status, updatedAt: toIso(attempt.updated_at) },
        attempt.tutor_interaction.map(({ trigger, hint_level }) => ({
          trigger,
          // Checks of the table keep it between 1 and 3
          hintLevel: hint_level as HintLevel,
        })),
      );
      attemptsOf.set(attempt.assignment_id, [
        ...(attemptsOf.get(attempt.assignment_id) ?? []),
        summary,
      ]);
    }
    return unwrap(assignments).map((assignment) =>
      assignedExercise(
        {
          exercise: toExercise(assignment.exercise),
          assignmentId: assignment.id,
          group: toAssignedGroup(assignment.class_group),
          block: toClassBlock(assignment.class_block),
        },
        attemptsOf.get(assignment.id) ?? [],
      ),
    );
  }

  /**
   * The assignment with its exercise, its visible tests, its block and its group; then how many
   * hidden tests it has, which needs the exercise.
   */
  async getDetail(assignmentId: string): Promise<ExerciseDetail> {
    const assignment = unwrap(
      await this.supabase
        .from('exercise_assignment')
        .select('id, exercise(*, test(*)), class_block(*), class_group(id, name, subject(*))')
        .eq('id', assignmentId)
        .eq('exercise.test.is_hidden', false)
        .order('position', { referencedTable: 'exercise.test' })
        .single(),
    );
    const { test, ...exercise } = assignment.exercise;
    const hidden = unwrap(
      await this.supabase.rpc('hidden_test_count', { target_exercise_id: exercise.id }),
    );
    return {
      exercise: toExercise(exercise),
      assignmentId: assignment.id,
      group: toAssignedGroup(assignment.class_group),
      block: toClassBlock(assignment.class_block),
      visibleTests: test.map(toTest),
      hiddenTestCount: hidden,
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
      await this.supabase.from('exercise_assignment').select().eq('group_id', groupId).order('id'),
    );
    return rows.map(toAssignment);
  }

  async assign(assignment: Omit<ExerciseAssignment, 'id'>): Promise<ExerciseAssignment> {
    const row = unwrap(
      await this.supabase
        .from('exercise_assignment')
        .insert({
          group_id: assignment.groupId,
          block_id: assignment.blockId,
          exercise_id: assignment.exerciseId,
          is_hidden: assignment.isHidden,
        })
        .select()
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

/** The group of an assignment, with its subject. */
function toAssignedGroup(row: {
  id: string;
  name: string;
  subject: Row<'subject'>;
}): AssignedGroup {
  return { id: row.id, name: row.name, subject: toSubject(row.subject) };
}

function savingNotYet(): Promise<Exercise> {
  return Promise.reject(new DataError('unavailable', 'Saving exercises arrives in step 4.3'));
}
