import { inject, Service } from '@angular/core';

import { DataError } from '../data-error';
import {
  type LiveAttemptDetail,
  type LiveGroup,
  LiveService,
  type LiveSnapshot,
  type LiveUpdate,
} from '../live-service';
import { SUPABASE_CLIENT } from './supabase-client';
import { unwrap } from './supabase-error';
import {
  type Row,
  toAttempt,
  toClassBlock,
  toExercise,
  toProcessEvent,
  toSubject,
  toTest,
  toTutorInteraction,
} from './supabase-rows';

/**
 * The live panel in Supabase (4.1). The RLS decides what the teacher reads: their own groups and
 * the attempts, events and tutor interactions of their students; the administrator, all (2.3).
 * Realtime sends the changes of `attempt` and the new rows of `process_event` and
 * `tutor_interaction` with the same RLS, published by the migrations `live_realtime` and
 * `attempt_detail_realtime`.
 */
@Service({ autoProvided: false })
export class SupabaseLiveService extends LiveService {
  private readonly supabase = inject(SUPABASE_CLIENT);

  /** One request for the groups with their subject and blocks, and one per group for its latest block. */
  async listGroups(): Promise<LiveGroup[]> {
    const groups = unwrap(
      await this.supabase.from('class_group').select('id, name, subject(*), class_block(*)'),
    );
    const latest = await Promise.all(groups.map((group) => this.latestBlockId(group.id)));
    return groups
      .map((group, index) => ({
        id: group.id,
        name: group.name,
        subject: toSubject(group.subject),
        blocks: group.class_block.map(toClassBlock).sort((a, b) => a.position - b.position),
        latestBlockId: latest[index],
      }))
      .sort(
        (a, b) =>
          a.name.localeCompare(b.name, 'es') || a.subject.name.localeCompare(b.subject.name, 'es'),
      );
  }

  /** Three requests at once: the block (to know it is of the group), the students and the exercises. */
  async snapshot(groupId: string, blockId: string): Promise<LiveSnapshot> {
    const [block, enrollments, assignments] = await Promise.all([
      this.supabase
        .from('class_block')
        .select('id')
        .eq('id', blockId)
        .eq('group_id', groupId)
        .maybeSingle(),
      this.supabase.from('enrollment').select('app_user(id, name)').eq('group_id', groupId),
      this.supabase
        .from('exercise_assignment')
        .select('id, exercise(*, test(*))')
        .eq('group_id', groupId)
        .eq('block_id', blockId)
        .order('id'),
    ]);
    if (unwrap(block) === null) {
      throw new DataError('not_found');
    }
    const exercises = unwrap(assignments).map(({ id, exercise }) => {
      const { test, ...row } = exercise;
      const tests = test.map(toTest).sort((a, b) => a.position - b.position);
      return { assignmentId: id, exercise: toExercise(row), tests };
    });
    const attempts =
      exercises.length === 0
        ? []
        : unwrap(
            await this.supabase
              .from('attempt')
              .select('*, process_event(*)')
              .in(
                'assignment_id',
                exercises.map((entry) => entry.assignmentId),
              ),
          );
    return {
      students: unwrap(enrollments)
        .map(({ app_user }) => ({ id: app_user.id, name: app_user.name }))
        .sort((a, b) => a.name.localeCompare(b.name, 'es')),
      exercises,
      // toAttempt() reads the columns of the attempt and leaves its embedded events aside
      attempts: attempts.map((attempt) => toAttempt(attempt)),
      events: attempts.flatMap(({ process_event }) => process_event.map(toProcessEvent)),
    };
  }

  /** One request: the attempt with everything embedded, sorted here. */
  async attemptDetail(attemptId: string): Promise<LiveAttemptDetail> {
    const row = unwrap(
      await this.supabase
        .from('attempt')
        .select(
          '*, app_user(id, name), process_event(*), tutor_interaction(*), exercise_assignment(id, group_id, block_id, exercise(*, test(*)))',
        )
        .eq('id', attemptId)
        .maybeSingle(),
    );
    // Hidden by the RLS, or without assignment: nothing of the panel leads to it
    const assignment = row?.exercise_assignment;
    if (!row || !assignment) {
      throw new DataError('not_found');
    }
    const { test, ...exercise } = assignment.exercise;
    return {
      groupId: assignment.group_id,
      blockId: assignment.block_id,
      student: { id: row.app_user.id, name: row.app_user.name },
      exercise: {
        assignmentId: assignment.id,
        exercise: toExercise(exercise),
        tests: test.map(toTest).sort((a, b) => a.position - b.position),
      },
      // toAttempt() reads the columns of the attempt and leaves what is embedded aside
      attempt: toAttempt(row),
      events: row.process_event
        .map(toProcessEvent)
        .sort((a, b) => a.timestamp.localeCompare(b.timestamp)),
      interactions: row.tutor_interaction
        .map(toTutorInteraction)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    };
  }

  watch(groupId: string, onUpdate: (update: LiveUpdate) => void): () => void {
    const channel = this.supabase
      .channel(`live:${groupId}`)
      .on<Row<'attempt'>>(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'attempt' },
        (change) => {
          // Attempts are never deleted while a class works; a deletion has nothing to show
          if (change.eventType !== 'DELETE') {
            onUpdate({ type: 'attempt', attempt: toAttempt(change.new) });
          }
        },
      )
      .on<Row<'process_event'>>(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'process_event' },
        (change) => onUpdate({ type: 'event', event: toProcessEvent(change.new) }),
      )
      .on<Row<'tutor_interaction'>>(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'tutor_interaction' },
        (change) => onUpdate({ type: 'interaction', interaction: toTutorInteraction(change.new) }),
      )
      .subscribe();
    return () => void this.supabase.removeChannel(channel);
  }

  private async latestBlockId(groupId: string): Promise<string | null> {
    const attempt = unwrap(
      await this.supabase
        .from('attempt')
        .select('exercise_assignment!inner(block_id, group_id)')
        .eq('exercise_assignment.group_id', groupId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    );
    return attempt?.exercise_assignment.block_id ?? null;
  }
}
