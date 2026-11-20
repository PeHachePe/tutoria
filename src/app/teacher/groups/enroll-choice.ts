import type { UserRef } from '../../data/group-service';

/**
 * Adds to the students chosen the candidates who are neither chosen nor enrolled yet; says how many
 * it added. Used to take the students of another class, of a pasted list or without a class (5.2d).
 */
export function addToChoice(
  chosen: readonly UserRef[],
  candidates: readonly UserRef[],
  enrolledIds: ReadonlySet<string>,
): { readonly chosen: readonly UserRef[]; readonly added: number } {
  const taken = new Set([...enrolledIds, ...chosen.map(({ id }) => id)]);
  const fresh = candidates.filter(({ id }) => !taken.has(id));
  return { chosen: [...chosen, ...fresh], added: fresh.length };
}

/** The items in pieces of `size` at most, in their order: the requests the server takes. */
export function inBatches<T>(items: readonly T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let start = 0; start < items.length; start += size) {
    batches.push(items.slice(start, start + size));
  }
  return batches;
}
