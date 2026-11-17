import type { LiveGroup } from '../../data/live-service';
import type { LiveRow } from './live-row';

/**
 * The block the panel opens on when the URL names none (D-068): with students in the session, the
 * block where more than half of them work, or null (the whole class) if none reaches it; out of
 * class, the block that moved last, or the first one. Null for a group without blocks.
 */
export function defaultBlock(rows: readonly LiveRow[], group: LiveGroup): string | null {
  const inSession = rows.filter((row) => row.work !== 'absent');
  if (inSession.length === 0) {
    const latest = group.blocks.find((block) => block.id === group.latestBlockId);
    return (latest ?? group.blocks[0])?.id ?? null;
  }
  const students = new Map<string, number>();
  for (const row of inSession) {
    if (row.exercise) {
      students.set(row.exercise.blockId, (students.get(row.exercise.blockId) ?? 0) + 1);
    }
  }
  const [blockId] = [...students].find(([, count]) => count > inSession.length / 2) ?? [null];
  return blockId;
}
