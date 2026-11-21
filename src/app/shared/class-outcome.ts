import type { PreviousClass } from '../data/group-service';
import type { ClassOutcome } from '../data/user';

/** In the order of the menu: what happens to most students first (5.2g, D-084). */
export const CLASS_OUTCOMES: readonly ClassOutcome[] = [
  'promotes',
  'repeats',
  'graduates',
  'leaves',
];

/** How the final evaluation of a student shows: its name, its icon and its colours. */
export interface OutcomeLook {
  readonly label: string;
  readonly icon: string;
  /** The background and text of its chip, as tokens of the theme. */
  readonly chip: string;
}

/** The look of each outcome, and of none yet. */
export function outcomeLook(outcome: ClassOutcome | null): OutcomeLook {
  switch (outcome) {
    case 'promotes':
      return {
        label: $localize`:@@classOutcome.promotes:Promociona`,
        icon: 'trending_up',
        chip: 'bg-success-container text-on-success-container',
      };
    case 'repeats':
      return {
        label: $localize`:@@classOutcome.repeats:Repite`,
        icon: 'replay',
        chip: 'bg-warning-container text-on-warning-container',
      };
    case 'graduates':
      return {
        label: $localize`:@@classOutcome.graduates:Titula`,
        icon: 'school',
        chip: 'bg-primary-container text-on-primary-container',
      };
    case 'leaves':
      return {
        label: $localize`:@@classOutcome.leaves:Baja`,
        icon: 'logout',
        chip: 'border border-outline-variant bg-surface-container-highest text-on-surface-variant',
      };
    case null:
      return {
        label: $localize`:@@classOutcome.none:Sin evaluar`,
        icon: 'radio_button_unchecked',
        chip: 'border border-outline-variant text-on-surface-variant',
      };
  }
}

/** «4 promocionan», «1 repite»: a part of the summary of the evaluation. */
export function outcomeCount(outcome: ClassOutcome, count: number): string {
  switch (outcome) {
    case 'promotes':
      return count === 1
        ? $localize`:@@classOutcome.count.promotes.one:1 promociona`
        : $localize`:@@classOutcome.count.promotes:${count}:count: promocionan`;
    case 'repeats':
      return count === 1
        ? $localize`:@@classOutcome.count.repeats.one:1 repite`
        : $localize`:@@classOutcome.count.repeats:${count}:count: repiten`;
    case 'graduates':
      return count === 1
        ? $localize`:@@classOutcome.count.graduates.one:1 titula`
        : $localize`:@@classOutcome.count.graduates:${count}:count: titulan`;
    case 'leaves':
      return count === 1
        ? $localize`:@@classOutcome.count.leaves.one:1 baja`
        : $localize`:@@classOutcome.count.leaves:${count}:count: bajas`;
  }
}

/**
 * «Evaluación final: 5 de 8 · 4 promocionan · 1 repite»: how far the evaluation of a class went,
 * with only the outcomes somebody has.
 */
export function outcomeSummary(outcomes: readonly (ClassOutcome | null)[]): string {
  const done = outcomes.filter((outcome) => outcome !== null).length;
  const parts = CLASS_OUTCOMES.flatMap((outcome) => {
    const count = outcomes.filter((other) => other === outcome).length;
    return count > 0 ? [outcomeCount(outcome, count)] : [];
  });
  const total = outcomes.length;
  return [
    $localize`:@@classOutcome.summary:Evaluación final: ${done}:done: de ${total}:total:`,
    ...parts,
  ].join(' · ');
}

/**
 * Where a student without a class comes from, as a heading of the students chosen together:
 * «Promocionan de 1.º DAW A · 2025/26», «Repiten 2.º DAM B · 2025/26», or none without a class.
 */
export function previousClassLabel(previous: PreviousClass | null): string {
  if (previous === null) return $localize`:@@classOutcome.from.none:Sin clase anterior`;
  const from = `${previous.name} · ${previous.schoolYear}`;
  switch (previous.outcome) {
    case 'promotes':
      return $localize`:@@classOutcome.from.promotes:Promocionan de ${from}:class:`;
    case 'repeats':
      return $localize`:@@classOutcome.from.repeats:Repiten ${from}:class:`;
    default:
      // Never one who finished: they are not chosen again
      return $localize`:@@classOutcome.from.unevaluated:Sin evaluar en ${from}:class:`;
  }
}

/** The students without a class who come from the same place, under its heading (5.2g). */
export interface CandidateSection<Candidate extends { readonly previous: PreviousClass | null }> {
  readonly label: string;
  readonly candidates: readonly Candidate[];
}

/** Within a class: those who go on first, then those not evaluated, then those who repeat. */
const SECTION_ORDER: readonly (ClassOutcome | null)[] = ['promotes', null, 'repeats'];

/**
 * The students without a class by where they come from, in the order of the list within each:
 * the latest year first, then by class, and those who never had a class last.
 */
export function candidateSections<Candidate extends { readonly previous: PreviousClass | null }>(
  candidates: readonly Candidate[],
): CandidateSection<Candidate>[] {
  const sections = new Map<string, { previous: PreviousClass | null; candidates: Candidate[] }>();
  for (const candidate of candidates) {
    const label = previousClassLabel(candidate.previous);
    const section = sections.get(label) ?? { previous: candidate.previous, candidates: [] };
    section.candidates.push(candidate);
    sections.set(label, section);
  }
  return [...sections.entries()]
    .sort(([, a], [, b]) => compareOrigins(a.previous, b.previous))
    .map(([label, { candidates: chosen }]) => ({ label, candidates: chosen }));
}

function compareOrigins(a: PreviousClass | null, b: PreviousClass | null): number {
  if (a === null || b === null) return (a === null ? 1 : 0) - (b === null ? 1 : 0);
  return (
    b.schoolYear.localeCompare(a.schoolYear) ||
    a.name.localeCompare(b.name, 'es') ||
    SECTION_ORDER.indexOf(a.outcome) - SECTION_ORDER.indexOf(b.outcome)
  );
}

/** They finished the cycle or left the school (5.2g): not taken at once into another class. */
export function isFinished(outcome: ClassOutcome | null): boolean {
  return outcome === 'graduates' || outcome === 'leaves';
}

/**
 * «Titula · 2.º DAW A · 2025/26», or «1.º DAM B · 2026/27» without an evaluation: the last class of
 * a student, under their name.
 */
export function previousClassLine({ name, schoolYear, outcome }: PreviousClass): string {
  const place = `${name} · ${schoolYear}`;
  return outcome === null ? place : `${outcomeLook(outcome).label} · ${place}`;
}
