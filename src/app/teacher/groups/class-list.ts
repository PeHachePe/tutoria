import type { AppLocale } from '../../core/i18n/locale';
import type {
  ClassSubject,
  ManagedClass,
  ManagedGroup,
  RosterStudent,
} from '../../data/group-service';
import { subjectName } from '../../data/localized-text';
import { toCsv } from '../../shared/download-text';

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

/** The groups of a class as its dialogs read them, whoever teaches them. */
export function classSubjectsOf(groups: readonly ManagedGroup[]): ClassSubject[] {
  return groups.map(({ group, teacherName }) => ({
    subjectId: group.subjectId,
    label: group.label,
    teacherName,
  }));
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
 * The label a new split of a subject starts with: «Desdoble 1» for its first split, whether or not
 * the class has its group of the whole class, then the next number nobody uses.
 */
export function nextSplitLabel(groups: readonly ClassSubject[], subjectId: string): string {
  const splits = groups.filter((group) => group.subjectId === subjectId && group.label !== null);
  const taken = new Set(splits.map(({ label }) => label));
  let number = splits.length + 1;
  while (taken.has(splitLabel(number))) number++;
  return splitLabel(number);
}

function splitLabel(number: number): string {
  return $localize`:@@classList.split:Desdoble ${number}:number:`;
}

/** Words left out of the initials of a subject, in the languages of the interface. */
const MINOR_WORDS = new Set([
  'a',
  'al',
  'amb',
  'and',
  'con',
  'de',
  'del',
  'e',
  'el',
  'els',
  'en',
  'i',
  'in',
  'la',
  'las',
  'les',
  'los',
  'of',
  'per',
  'para',
  'por',
  'the',
  'y',
]);

/**
 * The initials of a subject, for the head of its column: «Programación básica» is PB and
 * «Desarrollo web en entorno cliente», DWEC; a name of one word keeps its first three letters.
 */
export function subjectInitials(name: string): string {
  const words = name
    .split(/\s+/)
    .filter((word) => word !== '' && !MINOR_WORDS.has(word.toLowerCase()));
  const initials =
    words.length === 1 ? words[0].slice(0, 3) : words.map((word) => word[0]).join('');
  return initials.toLocaleUpperCase();
}

/** A column of the table of the students: a group of the class. */
export interface RosterColumn {
  readonly managed: ManagedGroup;
  /** «PB». */
  readonly initials: string;
  /** Under the initials: the label of a split and the teacher, «Desdoble inglés · Javier». */
  readonly detail: string;
  /** What the column is, whole: «Programación básica · Desdoble inglés». */
  readonly title: string;
}

/** The columns of the groups, in the order given. */
export function rosterColumns(groups: readonly ManagedGroup[], locale: AppLocale): RosterColumn[] {
  return groups.map((managed) => {
    const firstName = managed.teacherName.split(' ')[0];
    return {
      managed,
      initials: subjectInitials(subjectName(managed.subject, locale).name),
      detail: managed.group.label ? `${managed.group.label} · ${firstName}` : firstName,
      title: subjectLine(managed, locale),
    };
  });
}

/**
 * The students as a spreadsheet opens them (CSV with «;», as Excel in Spanish reads it): name,
 * email, whether they are in the class and in each group.
 */
export function rosterCsv(
  rows: readonly RosterStudent[],
  columns: readonly RosterColumn[],
): string {
  const yes = $localize`:@@classList.csv.yes:Sí`;
  const no = $localize`:@@classList.csv.no:No`;
  const head = [
    $localize`:@@classList.csv.name:Nombre`,
    $localize`:@@classList.csv.email:Correo`,
    $localize`:@@classList.csv.member:En la clase`,
    ...columns.map(({ title }) => title),
  ];
  const lines = rows.map((row) => [
    row.student.name,
    row.student.email,
    row.member ? yes : no,
    ...columns.map(({ managed }) => (row.groupIds.includes(managed.group.id) ? yes : no)),
  ]);
  return toCsv([head, ...lines]);
}

/** «1.º DAW A 2026-27.csv»: a slash is not allowed in the name of a file. */
export function rosterFileName(className: string, schoolYear: string): string {
  return `${className} ${schoolYear.replace('/', '-')}.csv`;
}
