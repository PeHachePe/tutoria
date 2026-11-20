import { inject, Service } from '@angular/core';

import {
  type AssignmentChanges,
  type BlockDraft,
  BlockService,
  type PlannedBlock,
  type PlannedGroup,
} from '../block-service';
import { DataError } from '../data-error';
import type { ClassBlock, ExerciseAssignment } from '../exercise';
import type { Json } from './database.types';
import { SUPABASE_CLIENT } from './supabase-client';
import { check, unwrap } from './supabase-error';
import { toAssignment, toClassBlock, toExercise, toSubject } from './supabase-rows';
import { localTimeZone } from './time-zone';
import { compareGroups } from '../group-name';

/**
 * Blocks and assignments in Supabase (4.3b). The RLS decides who changes them; adding and
 * reordering go through RPCs that count the positions on the server, in one transaction.
 */
@Service({ autoProvided: false })
export class SupabaseBlockService extends BlockService {
  private readonly supabase = inject(SUPABASE_CLIENT);

  /** The RLS gives a teacher their groups and the administration every group, with their class. */
  async listGroups(): Promise<PlannedGroup[]> {
    const rows = unwrap(
      await this.supabase
        .from('class_group')
        .select('id, label, school_class(name, school_year), subject(*)'),
    );
    return rows
      .map((row) => ({
        id: row.id,
        name: row.school_class.name,
        label: row.label,
        schoolYear: row.school_class.school_year,
        subject: toSubject(row.subject),
      }))
      .sort(compareGroups);
  }

  /** Two requests at once: the blocks with their exercises, and who started each assignment. */
  async listBlocks(groupId: string): Promise<PlannedBlock[]> {
    const [group, counts] = await Promise.all([
      this.supabase
        .from('class_group')
        .select('id, class_block(*, exercise_assignment(*, exercise(*)))')
        .eq('id', groupId)
        .order('position', { referencedTable: 'class_block' })
        .order('position', { referencedTable: 'class_block.exercise_assignment' })
        .single(),
      this.supabase.rpc('assignment_student_counts', { target_group_id: groupId }),
    ]);
    const started = new Map(
      unwrap(counts).map((row) => [row.assignment_id, row.student_count] as const),
    );
    return unwrap(group).class_block.map(({ exercise_assignment, ...block }) => ({
      block: toClassBlock(block),
      assignments: exercise_assignment.map(({ exercise, ...assignment }) => ({
        assignment: toAssignment(assignment),
        exercise: toExercise(exercise),
        studentCount: started.get(assignment.id) ?? 0,
      })),
    }));
  }

  async createBlock(groupId: string, draft: BlockDraft): Promise<ClassBlock> {
    const row = unwrap(
      await this.supabase
        .rpc('create_block', {
          target_group_id: groupId,
          block_title: draft.title,
          block_source_locale: draft.sourceLocale,
          // A check of the table accepts only titles (is_valid_text_translations)
          block_translations: draft.translations as Json,
          block_is_hidden: draft.isHidden,
          // Left out, it is null (the default of the function)
          block_opens_at: draft.opensAt ?? undefined,
        })
        .single(),
    );
    return toClassBlock(row);
  }

  async updateBlock(blockId: string, draft: BlockDraft): Promise<ClassBlock> {
    const row = unwrap(
      await this.supabase
        .from('class_block')
        .update({
          title: draft.title,
          source_locale: draft.sourceLocale,
          translations: draft.translations as Record<string, Json>,
          is_hidden: draft.isHidden,
          opens_at: draft.opensAt,
        })
        .eq('id', blockId)
        .select()
        .single(),
    );
    return toClassBlock(row);
  }

  /** The RLS deletes nothing somebody started (or of another teacher): `invalid`. */
  async removeBlock(blockId: string): Promise<void> {
    const deleted = unwrap(
      await this.supabase.from('class_block').delete().eq('id', blockId).select('id'),
    );
    if (deleted.length === 0) throw new DataError('invalid', 'The block cannot be deleted');
  }

  async reorderBlocks(groupId: string, blockIds: readonly string[]): Promise<void> {
    check(
      await this.supabase.rpc('reorder_blocks', {
        target_group_id: groupId,
        block_ids: [...blockIds],
      }),
    );
  }

  async assign(blockId: string, exerciseIds: readonly string[]): Promise<ExerciseAssignment[]> {
    const rows = unwrap(
      await this.supabase.rpc('assign_exercises', {
        target_block_id: blockId,
        exercise_ids: [...exerciseIds],
      }),
    );
    return rows.map(toAssignment);
  }

  async updateAssignment(
    assignmentId: string,
    changes: AssignmentChanges,
  ): Promise<ExerciseAssignment> {
    const row = unwrap(
      await this.supabase
        .from('exercise_assignment')
        .update({ is_hidden: changes.isHidden, due_at: changes.dueAt })
        .eq('id', assignmentId)
        .select()
        .single(),
    );
    return toAssignment(row);
  }

  /** As `removeBlock`: what somebody started stays. */
  async unassign(assignmentId: string): Promise<void> {
    const deleted = unwrap(
      await this.supabase.from('exercise_assignment').delete().eq('id', assignmentId).select('id'),
    );
    if (deleted.length === 0) throw new DataError('invalid', 'The assignment cannot be deleted');
  }

  async reorderAssignments(blockId: string, assignmentIds: readonly string[]): Promise<void> {
    check(
      await this.supabase.rpc('reorder_assignments', {
        target_block_id: blockId,
        assignment_ids: [...assignmentIds],
      }),
    );
  }

  /** On the server, which closes the gap and makes room in one transaction (`move_assignment`). */
  /** With the RPC `copy_blocks`, in one transaction; the dates move in the zone of the browser. */
  async copyBlocks(
    sourceGroupId: string,
    targetGroupId: string,
    withDates: boolean,
  ): Promise<number> {
    return unwrap(
      await this.supabase.rpc('copy_blocks', {
        source_group_id: sourceGroupId,
        target_group_id: targetGroupId,
        with_dates: withDates,
        time_zone: localTimeZone(),
      }),
    );
  }

  async moveAssignment(
    assignmentId: string,
    blockId: string,
    position: number,
  ): Promise<ExerciseAssignment> {
    const row = unwrap(
      await this.supabase
        .rpc('move_assignment', {
          target_assignment_id: assignmentId,
          target_block_id: blockId,
          target_position: position,
        })
        .single(),
    );
    return toAssignment(row);
  }
}
