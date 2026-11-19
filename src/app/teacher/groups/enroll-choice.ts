import type { UserRef } from '../../data/group-service';

/**
 * Adds to the students chosen the candidates who are neither chosen nor in the group yet, up to
 * `max`; says how many it added. Used to take the students of another group (5.2b).
 */
export function addToChoice(
  chosen: readonly UserRef[],
  candidates: readonly UserRef[],
  enrolledIds: ReadonlySet<string>,
  max: number,
): { readonly chosen: readonly UserRef[]; readonly added: number } {
  const taken = new Set([...enrolledIds, ...chosen.map(({ id }) => id)]);
  const fresh = candidates
    .filter(({ id }) => !taken.has(id))
    .slice(0, Math.max(0, max - chosen.length));
  return { chosen: [...chosen, ...fresh], added: fresh.length };
}
