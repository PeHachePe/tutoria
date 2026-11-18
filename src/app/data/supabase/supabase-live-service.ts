import { inject, Service } from '@angular/core';

import { DataError } from '../data-error';
import {
  LIVE_WINDOW_MINUTES,
  type LiveAttemptDetail,
  type LiveExercise,
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
 * the attempts, events and tutor interactions at their assignments; the administrator, all (2.3).
 * Realtime sends the changes of `attempt` and the new rows of `process_event` and
 * `tutor_interaction` with the same RLS, published by the migrations `live_realtime` and
 * `attempt_detail_realtime`.
 */
const MINUTE_MS = 60_000;

/** An attempt with its events and tutor interactions, as the snapshot reads it. */
const ATTEMPT_COLUMNS = '*, process_event(*), tutor_interaction(*)';

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

  /**
   * Three requests at once (the group with its blocks, the students and the exercises), then the
   * attempts of the session and, with a block, those of the block: two more at once, joined by id.
   */
  async snapshot(groupId: string, blockId: string | null): Promise<LiveSnapshot> {
    const [group, enrollments, assignments] = await Promise.all([
      this.supabase
        .from('class_group')
        .select('id, class_block(id, position)')
        .eq('id', groupId)
        .maybeSingle(),
      this.supabase.from('enrollment').select('app_user(id, name)').eq('group_id', groupId),
      this.supabase
        .from('exercise_assignment')
        .select('id, block_id, position, exercise(*, test(*))')
        .eq('group_id', groupId),
    ]);
    const blocks = unwrap(group)?.class_block;
    if (!blocks || (blockId !== null && !blocks.some((block) => block.id === blockId))) {
      throw new DataError('not_found');
    }
    const blockOrder = [...blocks].sort((a, b) => a.position - b.position).map((block) => block.id);
    const exercises = unwrap(assignments)
      .sort(
        (a, b) =>
          blockOrder.indexOf(a.block_id) - blockOrder.indexOf(b.block_id) ||
          a.position - b.position,
      )
      .map(({ id, block_id, exercise }) => {
        const { test, ...row } = exercise;
        const tests = test.map(toTest).sort((a, b) => a.position - b.position);
        return { assignmentId: id, blockId: block_id, exercise: toExercise(row), tests };
      });
    const attempts = await this.sessionAttempts(exercises, blockId);
    return {
      students: unwrap(enrollments)
        .map(({ app_user }) => ({ id: app_user.id, name: app_user.name }))
        .sort((a, b) => a.name.localeCompare(b.name, 'es')),
      exercises,
      // toAttempt() reads the columns of the attempt and leaves what is embedded aside
      attempts: attempts.map((attempt) => toAttempt(attempt)),
      events: attempts.flatMap(({ process_event }) => process_event.map(toProcessEvent)),
      interactions: attempts.flatMap(({ tutor_interaction }) =>
        tutor_interaction.map(toTutorInteraction),
      ),
    };
  }

  /** One request: the attempt with everything embedded, sorted here. */
  async attemptDetail(attemptId: string): Promise<LiveAttemptDetail> {
    const row = unwrap(
      await this.supabase
        .from('attempt')
        .select(
          '*, app_user(id, name), process_event(*), tutor_interaction(*), exercise_assignment(id, group_id, block_id, exercise(*, test(*)), attempt(id, number, user_id))',
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
        blockId: assignment.block_id,
        exercise: toExercise(exercise),
        tests: test.map(toTest).sort((a, b) => a.position - b.position),
      },
      // toAttempt() reads the columns of the attempt and leaves what is embedded aside
      attempt: toAttempt(row),
      // The embedded attempts are those of the assignment the RLS lets the teacher see
      siblings: assignment.attempt
        .filter((other) => other.user_id === row.user_id)
        .sort((a, b) => a.number - b.number)
        .map((other) => ({ id: other.id, number: other.number })),
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

  /**
   * The attempts of the group that changed in the session window and, with a block, every one at
   * its assignments: two requests at once rather than an `or()` with a date inside, joined by id.
   */
  private async sessionAttempts(exercises: readonly LiveExercise[], blockId: string | null) {
    if (exercises.length === 0) return [];
    const from = new Date(Date.now() - LIVE_WINDOW_MINUTES * MINUTE_MS).toISOString();
    const ofBlock = exercises.filter((entry) => entry.blockId === blockId);
    const attempts = (assignmentIds: readonly string[]) =>
      this.supabase.from('attempt').select(ATTEMPT_COLUMNS).in('assignment_id', assignmentIds);
    const [session, block] = await Promise.all([
      attempts(exercises.map((entry) => entry.assignmentId)).gte('updated_at', from),
      ofBlock.length > 0 ? attempts(ofBlock.map((entry) => entry.assignmentId)) : null,
    ]);
    const joined = new Map(unwrap(session).map((attempt) => [attempt.id, attempt]));
    for (const attempt of block ? unwrap(block) : []) {
      joined.set(attempt.id, attempt);
    }
    return [...joined.values()];
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
