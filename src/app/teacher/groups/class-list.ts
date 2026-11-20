import type { AppLocale } from '../../core/i18n/locale';
import type { ManagedClass, ManagedGroup, RosterStudent } from '../../data/group-service';
import { subjectName } from '../../data/localized-text';

/** A class as the selector of the screen offers it (5.2d). */
export interface ClassOption {
  readonly managed: ManagedClass;
  readonly id: string;
  /** «1.º DAW A · 2026/27». */
  readonly label: string;
}

/** The classes as the service orders them (the most recent year first, then by name). */
export function labelClasses(classes: readonly ManagedClass[]): ClassOption[] {
  return classes.map((managed) => ({
    managed,
    id: managed.schoolClass.id,
    label: `${managed.schoolClass.name} · ${managed.schoolClass.schoolYear}`,
  }));
}

/** «Programación básica», or «Programación básica · Desdoble inglés» for a split. */
export function subjectLine(managed: ManagedGroup, locale: AppLocale): string {
  const subject = subjectName(managed.subject, locale).name;
  return managed.group.label ? `${subject} · ${managed.group.label}` : subject;
}

/** By subject in the language of the interface, the group of the whole class before its splits. */
export function sortClassGroups(
  groups: readonly ManagedGroup[],
  locale: AppLocale,
): ManagedGroup[] {
  const subject = (managed: ManagedGroup) => subjectName(managed.subject, locale).name;
  return [...groups].sort(
    (a, b) =>
      subject(a).localeCompare(subject(b), locale) ||
      (a.group.label ?? '').localeCompare(b.group.label ?? '', locale),
  );
}

/**
 * The label a new group of a subject the class already has starts with: «Desdoble 2», or the next
 * number nobody uses. Null while the class does not have the subject: it is the group of the class.
 */
export function nextSplitLabel(groups: readonly ManagedGroup[], subjectId: string): string | null {
  const same = groups.filter(({ group }) => group.subjectId === subjectId);
  if (same.length === 0) return null;
  const taken = new Set(same.map(({ group }) => group.label));
  let number = same.length + 1;
  while (taken.has(splitLabel(number))) number++;
  return splitLabel(number);
}

function splitLabel(number: number): string {
  return $localize`:@@classList.split:Desdoble ${number}:number:`;
}

/**
 * What a row of the students says besides the name: the subjects of the class a member does not
 * take, the splits they are in, or, for a student of another class, the subjects they take in this
 * one. Null for a member in every group of the whole class and no split.
 */
export function rosterNote(
  row: RosterStudent,
  groups: readonly ManagedGroup[],
  locale: AppLocale,
): string | null {
  const inGroups = new Set(row.groupIds);
  const names = (chosen: readonly ManagedGroup[]) =>
    chosen.map((managed) => subjectLine(managed, locale)).join(', ');
  if (!row.member) {
    const taken = names(groups.filter(({ group }) => inGroups.has(group.id)));
    return $localize`:@@classList.otherClass:De otra clase: ${taken}:subjects:`;
  }
  const notes: string[] = [];
  const missing = groups.filter(({ group }) => group.label === null && !inGroups.has(group.id));
  if (missing.length > 0) {
    notes.push($localize`:@@classList.missing:No cursa: ${names(missing)}:subjects:`);
  }
  const splits = groups.filter(({ group }) => group.label !== null && inGroups.has(group.id));
  if (splits.length > 0) notes.push(names(splits));
  return notes.length > 0 ? notes.join(' · ') : null;
}
