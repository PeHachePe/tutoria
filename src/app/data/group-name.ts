/**
 * How a group is named where its subject goes apart (5.2d): its class and, for a split, its label,
 * as «1.º DAW A · Desdoble inglés».
 */
export function groupName(className: string, label: string | null): string {
  return label ? `${className} · ${label}` : className;
}

/**
 * How the selectors name a group: «1.º DAW A · Programación básica», and the label of a split after
 * the subject, as «1.º DAW A · Programación básica · Desdoble inglés».
 */
export function groupTitle(className: string, subjectName: string, label: string | null): string {
  const title = `${className} · ${subjectName}`;
  return label ? `${title} · ${label}` : title;
}

/** What the order of the groups reads of each. */
export interface OrderedGroup {
  readonly name: string;
  readonly label: string | null;
  readonly schoolYear: string;
  readonly subject: { readonly name: string };
}

/**
 * The order of the groups of a teacher in Bloques, Histórico and the live panel (5.2d): the most
 * recent year first, so they open on one of this year and not on one of years ago, then by class,
 * subject and the group of the whole class before its splits.
 */
export function compareGroups(a: OrderedGroup, b: OrderedGroup): number {
  return (
    b.schoolYear.localeCompare(a.schoolYear) ||
    a.name.localeCompare(b.name, 'es') ||
    a.subject.name.localeCompare(b.subject.name, 'es') ||
    (a.label ?? '').localeCompare(b.label ?? '', 'es')
  );
}
