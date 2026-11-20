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
