import type { ClassCandidate, PreviousClass, UserRef } from '../../data/group-service';
import { isFinished, previousClassLine } from '../../shared/class-outcome';

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

/**
 * Why a student is not taken at once into a class (5.2g): already in another class of its year (one
 * class a year), or finished the cycle or left the school in their last class. Null for one who
 * can be. `schoolYear` is that of the class, or null for one group, which any student may take.
 */
export type EnrollBlocker = 'other_class' | 'finished';

export function enrollBlocker(
  { previous }: ClassCandidate,
  schoolYear: string | null,
): EnrollBlocker | null {
  if (previous === null) return null;
  if (schoolYear !== null && previous.schoolYear === schoolYear) return 'other_class';
  return isFinished(previous.outcome) ? 'finished' : null;
}

/**
 * The candidates of a pasted list or another class, split into those taken and those left out with
 * why, after leaving out who is enrolled already (who is in this class is not in another one).
 */
export function sortOutCandidates(
  candidates: readonly ClassCandidate[],
  enrolledIds: ReadonlySet<string>,
  schoolYear: string | null,
): { readonly kept: readonly UserRef[]; readonly skipped: readonly string[] } {
  const fresh = candidates.filter(({ student }) => !enrolledIds.has(student.id));
  return {
    kept: fresh
      .filter((candidate) => enrollBlocker(candidate, schoolYear) === null)
      .map(({ student }) => student),
    skipped: fresh.flatMap((candidate) => {
      const blocker = enrollBlocker(candidate, schoolYear);
      return blocker === null ? [] : [skippedLine(candidate, blocker)];
    }),
  };
}

/** «Lucía Martín Gómez · Ya está en 1.º DAW A · 2026/27», «Andrea Peña Iglesias · Baja · …». */
export function skippedLine({ student, previous }: ClassCandidate, blocker: EnrollBlocker): string {
  return `${student.name} · ${blockerLine(previous!, blocker)}`;
}

/** What says why, under the name or in the list of those left out. */
export function blockerLine(previous: PreviousClass, blocker: EnrollBlocker | null): string {
  return blocker === 'other_class'
    ? $localize`:@@enrollDialog.otherClass:Ya está en ${previous.name}:class: · ${previous.schoolYear}:year:`
    : previousClassLine(previous);
}
