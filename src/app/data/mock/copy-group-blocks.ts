import type { ClassBlock, ExerciseAssignment } from '../exercise';
import { shiftDate } from '../school-year-shift';
import type { MockDb } from './mock-db';

/**
 * The blocks of a group after those of another, as `copy_group_blocks` (5.2c, D-079): in their
 * order, with their exercises, order, visibility and translations, and their dates moved by
 * `shiftDays` or none without it. How many blocks were copied. Without checks: its callers do them.
 */
export function copyGroupBlocks(
  db: MockDb,
  sourceGroupId: string,
  targetGroupId: string,
  shiftDays: number | null,
): number {
  const { classBlocks, assignments } = db.tables();
  const last = Math.max(
    0,
    ...classBlocks.filter((block) => block.groupId === targetGroupId).map((b) => b.position),
  );
  const sources = classBlocks
    .filter((block) => block.groupId === sourceGroupId)
    .sort((a, b) => a.position - b.position);
  const blocks: ClassBlock[] = [];
  const copies: ExerciseAssignment[] = [];
  sources.forEach((source, index) => {
    const block: ClassBlock = {
      ...source,
      id: crypto.randomUUID(),
      groupId: targetGroupId,
      position: last + index + 1,
      opensAt: shiftDate(source.opensAt, shiftDays),
    };
    blocks.push(block);
    for (const assignment of assignments.filter((row) => row.blockId === source.id)) {
      copies.push({
        ...assignment,
        id: crypto.randomUUID(),
        groupId: targetGroupId,
        blockId: block.id,
        dueAt: shiftDate(assignment.dueAt, shiftDays),
      });
    }
  });
  db.update('classBlocks', (rows) => [...rows, ...blocks]);
  db.update('assignments', (rows) => [...rows, ...copies]);
  return blocks.length;
}
