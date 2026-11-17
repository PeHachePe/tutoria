import type { LiveStudent } from '../../data/live-service';

/** Students a segment names before «y N más»: a tooltip, not a list. */
export const NAMES_SHOWN = 2;

/**
 * Who is in a segment of a bar of «Dónde está la clase», by first name: «Con fallos: Aya, Hugo y 3
 * más». Up to `NAMES_SHOWN + 1` students, all of them; with more, the first ones and how many more.
 */
export function segmentNames(
  label: string,
  students: readonly LiveStudent[],
  locale: string,
): string {
  const first = students.map((student) => student.name.split(' ')[0]);
  const names =
    first.length <= NAMES_SHOWN + 1
      ? first
      : [
          ...first.slice(0, NAMES_SHOWN),
          $localize`:@@live.names.more:${first.length - NAMES_SHOWN}:n: más`,
        ];
  const list = new Intl.ListFormat(locale, { style: 'long', type: 'conjunction' }).format(names);
  return `${label}: ${list}`;
}
