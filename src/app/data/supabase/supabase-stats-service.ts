import { inject, Service } from '@angular/core';

import {
  type BlockStats,
  type DeadlineStats,
  type GroupHistory,
  StatsService,
  type WorkStats,
} from '../stats-service';
import type { Database } from './database.types';
import { SUPABASE_CLIENT } from './supabase-client';
import { unwrap } from './supabase-error';
import { toClassBlock, toExercise, toIso } from './supabase-rows';

type Functions = Database['public']['Functions'];
type WorkRow = Functions['group_work_stats']['Returns'][number];
type DeadlineRow = Functions['group_deadline_stats']['Returns'][number];

/** The figures of a block nobody has counted yet: one created between the requests. */
const NO_WORK: WorkStats = {
  attempts: 0,
  activeStudents: 0,
  hints: 0,
  solved: 0,
  medianSeconds: null,
  stuckStudents: 0,
};

/**
 * The history of a group in Supabase (4.5, D-073). The counts come from `group_work_stats` and
 * `group_deadline_stats`, which follow the rules of `groupHistoryOf()` and answer `P0002`
 * (`not_found`) for a group the user does not teach; the blocks and the texts of their exercises,
 * from the tables.
 */
@Service({ autoProvided: false })
export class SupabaseStatsService extends StatsService {
  private readonly supabase = inject(SUPABASE_CLIENT);

  /** Three requests at once: the blocks with their exercises, and both functions. */
  async groupHistory(groupId: string): Promise<GroupHistory> {
    const [blockAnswer, workAnswer, deadlineAnswer] = await Promise.all([
      this.supabase
        .from('class_block')
        .select('*, exercise_assignment(id, exercise(*))')
        .eq('group_id', groupId)
        .order('position')
        .order('position', { referencedTable: 'exercise_assignment' }),
      this.supabase.rpc('group_work_stats', { target_group_id: groupId }),
      this.supabase.rpc('group_deadline_stats', { target_group_id: groupId }),
    ]);
    const work = unwrap(workAnswer);
    const deadlineRows = unwrap(deadlineAnswer);
    const rows = unwrap(blockAnswer);
    const workOf = new Map(work.map((row) => [row.id, row]));

    const blocks = rows.map(({ exercise_assignment, ...row }): BlockStats => {
      const stats = workOf.get(row.id);
      return {
        block: toClassBlock(row),
        assignments: stats?.assignments ?? 0,
        ...(stats ? toWorkStats(stats) : NO_WORK),
        // Those with figures are the assignments that count
        exercises: exercise_assignment.flatMap(({ id, exercise }) => {
          const ofExercise = workOf.get(id);
          return ofExercise
            ? [{ assignmentId: id, exercise: toExercise(exercise), ...toWorkStats(ofExercise) }]
            : [];
        }),
      };
    });

    // The due dates are of these blocks: both answers are of the same group
    const order = new Map(rows.map((row, index) => [row.id, index]));
    const position = (blockId: string) => order.get(blockId) as number;
    const deadlines = deadlineRows
      .map(toDeadlineStats)
      .sort((a, b) => a.dueAt.localeCompare(b.dueAt) || position(a.blockId) - position(b.blockId));

    return { students: work[0]?.students ?? 0, blocks, deadlines };
  }
}

function toWorkStats(row: WorkRow): WorkStats {
  return {
    attempts: row.attempts,
    activeStudents: row.active_students,
    hints: row.hints,
    solved: row.solved,
    // The function answers 0 for a median that does not exist: no submission takes no time
    medianSeconds: row.median_seconds === 0 ? null : row.median_seconds,
    stuckStudents: row.stuck_students,
  };
}

/** The three parallel arrays of the row, back to one student each, by name. */
function toDeadlineStats(row: DeadlineRow): DeadlineStats {
  return {
    blockId: row.block_id,
    dueAt: toIso(row.due_at),
    assignments: row.assignments,
    onTime: row.on_time,
    lastHours: row.last_hours,
    late: row.late,
    missing: row.missing_ids
      .map((id, index) => ({
        student: { id, name: row.missing_names[index] },
        pending: row.missing_pending[index],
      }))
      .sort((a, b) => a.student.name.localeCompare(b.student.name, 'es')),
  };
}
