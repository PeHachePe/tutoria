import type { AppLocale } from '../../core/i18n/locale';
import type { ManagedGroup } from '../../data/group-service';
import { subjectName } from '../../data/localized-text';

/** A group as the selector of the screen offers it. */
export interface GroupOption {
  readonly managed: ManagedGroup;
  readonly id: string;
  readonly label: string;
}

/**
 * The most recent school year first, then by name and subject (in the language of the interface).
 * A started group is never removed, so past years pile up below the current one.
 */
export function sortGroups(groups: readonly ManagedGroup[], locale: AppLocale): ManagedGroup[] {
  const subject = (managed: ManagedGroup) => subjectName(managed.subject, locale).name;
  return [...groups].sort(
    (a, b) =>
      b.group.schoolYear.localeCompare(a.group.schoolYear) ||
      a.group.name.localeCompare(b.group.name, locale) ||
      subject(a).localeCompare(subject(b), locale),
  );
}

/**
 * «Name · subject», as Bloques and Histórico name a group: a class has one group per subject. With
 * the year when that is not enough, as for the same class of another year.
 */
export function labelGroups(groups: readonly ManagedGroup[], locale: AppLocale): GroupOption[] {
  const labels = groups.map(
    (managed) => `${managed.group.name} · ${subjectName(managed.subject, locale).name}`,
  );
  return groups.map((managed, index) => ({
    managed,
    id: managed.group.id,
    label:
      labels.filter((label) => label === labels[index]).length > 1
        ? `${labels[index]} · ${managed.group.schoolYear}`
        : labels[index],
  }));
}
