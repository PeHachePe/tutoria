import {
  MAX_EMAIL_LENGTH,
  MAX_USER_NAME_LENGTH,
  normalizeEmail,
} from '../../data/admin/user-rules';
import type { AppUser } from '../../data/user';
import { toCsv } from '../../shared/download-text';
import { EMAIL_SHAPE } from './user-form';

/** What keeps a line of the list from becoming an account. */
export type StudentLineProblem = 'no_email' | 'no_name' | 'name_too_long' | 'email_too_long';

/** A line of the pasted list (5.2h), with its number in the text to find it there. */
export interface StudentLine {
  readonly line: number;
  readonly text: string;
  /** Empty with a problem. */
  readonly name: string;
  /** In lower case, as Auth keeps it; empty with a problem. */
  readonly email: string;
  readonly problem: StudentLineProblem | null;
}

/** What is done with a line: created, or why not. */
export type StudentRowStatus = 'new' | 'existing' | 'disabled' | 'repeated' | StudentLineProblem;

export interface StudentRow extends StudentLine {
  readonly status: StudentRowStatus;
  /** The account the email already has, active or disabled. */
  readonly account: AppUser | null;
}

/** An account created and the password to hand over in person (D-072). */
export interface Credential {
  readonly name: string;
  readonly email: string;
  readonly password: string;
}

/** An address anywhere in the line: up to a space, a separator, a quote or a bracket. */
const EMAIL_IN_LINE = /[^\s;,\t<>"'()]+@[^\s;,\t<>"'()]+/;

/** The columns of a spreadsheet pasted as text, and a separator left where the email was. */
const COLUMN_SEPARATOR = /[;\t]/;

/** Words of a surname written in lower case: «María de la Fuente del Río». */
const NAME_PARTICLES = new Set([
  'de',
  'del',
  'la',
  'las',
  'los',
  'y',
  'e',
  'i',
  'da',
  'van',
  'von',
]);

/** The lines with something, trimmed, with their number from 1. */
export function studentListLines(text: string): { line: number; text: string }[] {
  return text
    .split(/\r?\n/)
    .map((line, index) => ({ line: index + 1, text: line.trim() }))
    .filter(({ text: line }) => line !== '');
}

/**
 * The list as secretaría gives it (5.2h): a student a line, their name and email in any order,
 * separated by «;», a tab (as Excel copies it) or a comma. «Apellidos, Nombre» becomes the name
 * first, as the accounts have it, and a name in capitals is written as a name.
 */
export function readStudentList(text: string): StudentLine[] {
  return studentListLines(text).map(({ line, text: content }) => {
    const empty = { line, text: content, name: '', email: '' };
    const found = EMAIL_IN_LINE.exec(content);
    if (!found || !EMAIL_SHAPE.test(found[0])) return { ...empty, problem: 'no_email' };
    const email = normalizeEmail(found[0]);
    const rest = `${content.slice(0, found.index)};${content.slice(found.index + found[0].length)}`;
    const name = nameOf(rest);
    if (name === '') return { ...empty, problem: 'no_name' };
    if (name.length > MAX_USER_NAME_LENGTH) return { ...empty, problem: 'name_too_long' };
    if (email.length > MAX_EMAIL_LENGTH) return { ...empty, problem: 'email_too_long' };
    return { line, text: content, name, email, problem: null };
  });
}

/**
 * Each line against the accounts already loaded, before creating anything: a new one, an email
 * that has an account (active or disabled), one repeated in the list or a line that is not valid.
 */
export function reviewStudentList(text: string, users: readonly AppUser[]): StudentRow[] {
  const accounts = new Map(users.map((user) => [user.email, user]));
  const seen = new Set<string>();
  return readStudentList(text).map((line) => {
    if (line.problem) return { ...line, status: line.problem, account: null };
    const account = accounts.get(line.email) ?? null;
    if (account) {
      return { ...line, status: account.status === 'active' ? 'existing' : 'disabled', account };
    }
    if (seen.has(line.email)) return { ...line, status: 'repeated', account: null };
    seen.add(line.email);
    return { ...line, status: 'new', account: null };
  });
}

/** The accounts created as a spreadsheet opens them: name, email and password. */
export function credentialsCsv(credentials: readonly Credential[]): string {
  return toCsv([
    [
      $localize`:@@studentList.csv.name:Nombre`,
      $localize`:@@studentList.csv.email:Correo`,
      $localize`:@@studentList.csv.password:Contraseña`,
    ],
    ...credentials.map(({ name, email, password }) => [name, email, password]),
  ]);
}

/**
 * The name of the files of the credentials, without extension: «Credenciales 1.º DAW A 2026-27», or
 * of the day (`2026-11-21`) without a class. The CSV and the PDF printed are named alike; a slash is
 * not allowed in the name of a file.
 */
export function credentialsTitle(
  schoolClass: { readonly name: string; readonly schoolYear: string } | null,
  day: string,
): string {
  const title = $localize`:@@studentList.fileName:Credenciales`;
  const of = schoolClass ? `${schoolClass.name} ${schoolClass.schoolYear.replace('/', '-')}` : day;
  return `${title} ${of}`;
}

/** What is left of a line without its email: its columns joined, without quotes or brackets. */
function nameOf(rest: string): string {
  const joined = rest
    .replace(/[<>"]/g, ' ')
    .split(COLUMN_SEPARATOR)
    .map((column) => column.replace(/^[\s,]+|[\s,]+$/g, ''))
    .filter((column) => column !== '')
    .join(' ');
  const parts = joined.split(',');
  const ordered = parts.length === 2 ? `${parts[1]} ${parts[0]}` : joined;
  const name = ordered.replace(/\s+/g, ' ').trim();
  return isAllCapitals(name) ? asName(name) : name;
}

function isAllCapitals(text: string): boolean {
  return text !== text.toLocaleLowerCase('es') && text === text.toLocaleUpperCase('es');
}

/** «MARÍA JOSÉ DE LA FUENTE» as «María José de la Fuente», also each half of «GARCÍA-LÓPEZ». */
function asName(text: string): string {
  return text
    .toLocaleLowerCase('es')
    .split(' ')
    .map((word, index) =>
      index > 0 && NAME_PARTICLES.has(word)
        ? word
        : word
            .split('-')
            .map((part) => part.charAt(0).toLocaleUpperCase('es') + part.slice(1))
            .join('-'),
    )
    .join(' ');
}
