/**
 * The frontier of `proposeFix` (2.5f, D-047): the tutor may fix a slip of writing that keeps the code
 * from running (a bracket that is missing or left over, `retrun`, `lenght`), never what makes the
 * tests fail. It is decided here, from the code, never by the model: a fix changes one line, or adds
 * one that only closes, and the only changes it may make are brackets, separators and quotes, or a
 * name nobody declared turned into a known one that is written almost the same. Operators and
 * numbers never change: `i < n` → `i <= n` is one character too, and it is the solution. The Edge
 * Function also checks in the sandbox that the error goes away; the app checks it again when the
 * student presses «Aplicar», as the code may have changed. Shared with the Edge Function, so it must
 * not import anything (D-042).
 */

/** A fix as the tutor proposes it: the line as it should be, or a line to add before `line`. */
export interface CodeFix {
  /** From 1. */
  readonly line: number;
  readonly code: string;
  /** Adds `code` as a new line in that place instead of replacing the line. */
  readonly insert?: boolean;
}

/** What one change of a fix does, to show it: `retrun` → `return`, or `''` → `)`. */
export interface FixChange {
  readonly before: string;
  readonly after: string;
}

/** Why a fix is not a slip of writing. */
export type FixProblem = 'line' | 'unchanged' | 'not_a_slip' | 'too_big';

export type FixCheck =
  | {
      readonly ok: true;
      /** The whole code, fixed. */
      readonly code: string;
      readonly line: number;
      readonly changes: readonly FixChange[];
      /** Only names change: a misspelt property, such as `lenght`, may throw no error at all. */
      readonly namesOnly: boolean;
    }
  | { readonly ok: false; readonly problem: FixProblem };

/** What the code is checked against beyond itself. */
export interface FixContext {
  /** The function the exercise asks for: a declaration may be renamed to it. */
  readonly functionName?: string;
}

/** Brackets, separators or quotes added or removed, plus names changed: a slip is small. */
export const MAX_FIX_EDITS = 3;

/** What a slip may add or remove: never an operator, a dot or a number. */
const PUNCTUATION = new Set(['(', ')', '[', ']', '{', '}', ';', ',', "'", '"', '`']);

/** The words of JavaScript and what it has without declaring anything. */
const LANGUAGE_NAMES = new Set(
  (
    'break case catch class const continue default delete do else extends false finally for ' +
    'function if in instanceof let new null of return switch this throw true try typeof ' +
    'undefined var void while async await NaN Infinity Math Number String Array Object Boolean ' +
    'JSON Set Map Date console parseInt parseFloat isNaN'
  ).split(' '),
);

/** The properties and methods of the language a first-year exercise uses. */
const PROPERTY_NAMES = new Set(
  (
    'length push pop shift unshift slice splice concat join split reverse sort indexOf ' +
    'lastIndexOf includes find findIndex filter map reduce forEach some every fill flat keys ' +
    'values entries from isArray at charAt charCodeAt fromCharCode toUpperCase toLowerCase trim ' +
    'trimStart trimEnd startsWith endsWith repeat replace replaceAll substring padStart padEnd ' +
    'toString toFixed isInteger floor ceil round trunc abs max min pow sqrt random sign PI log ' +
    'has add get set size stringify parse assign'
  ).split(' '),
);

/** A comment, a name, a number or any other character, each a token; spaces are not. */
const TOKEN = /\/\/.*|\/\*.*?\*\/|[A-Za-z_$][\w$]*|\d[\w.]*|\S/g;
const WORD = /^[A-Za-z_$][\w$]*$/;

interface Token {
  readonly text: string;
  readonly start: number;
  /** After a dot: a property or a method. */
  readonly property: boolean;
  /** Inside a text between quotes. */
  readonly quoted: boolean;
}

function tokensOf(line: string): Token[] {
  const tokens: Token[] = [];
  let quote: string | null = null;
  for (const match of line.matchAll(TOKEN)) {
    const text = match[0];
    tokens.push({
      text,
      start: match.index,
      property: tokens.at(-1)?.text === '.',
      quoted: quote !== null && text !== quote,
    });
    if (text === quote) quote = null;
    else if (quote === null && (text === "'" || text === '"' || text === '`')) quote = text;
  }
  return tokens;
}

function isWord(token: string): boolean {
  return WORD.test(token);
}

/** The names the code declares: functions, variables, parameters and what they destructure. */
function declaredNames(source: string): Set<string> {
  const names = new Set<string>();
  const add = (list: string) => {
    for (const part of list.split(',')) {
      const name = /^\s*(?:\.\.\.)?([A-Za-z_$][\w$]*)/.exec(part)?.[1];
      if (name) names.add(name);
    }
  };
  for (const [, name] of source.matchAll(
    /\b(?:function|let|const|var|class)\s+([A-Za-z_$][\w$]*)/g,
  ))
    names.add(name);
  for (const [, list] of source.matchAll(/\bfunction\b[^(]*\(([^)]*)\)/g)) add(list);
  for (const [, list] of source.matchAll(/\(([^()]*)\)\s*=>/g)) add(list);
  for (const [, name] of source.matchAll(/([A-Za-z_$][\w$]*)\s*=>/g)) names.add(name);
  for (const [, list] of source.matchAll(/\b(?:let|const|var)\s*[[{]([^\]}]*)[\]}]/g)) add(list);
  for (const [, name] of source.matchAll(/\bcatch\s*\(\s*([A-Za-z_$][\w$]*)/g)) names.add(name);
  return names;
}

/**
 * Edits between two words, a swap of two letters being one (optimal string alignment): `retrun` is
 * one away from `return`.
 */
function distance(a: string, b: string): number {
  const rows = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      rows[i][j] = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1, rows[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        rows[i][j] = Math.min(rows[i][j], rows[i - 2][j - 2] + 1);
      }
    }
  }
  return rows[a.length][b.length];
}

/** How far a slip may be from what was meant: one letter in a short word, two in a longer one. */
function closeEnough(written: string, meant: string): boolean {
  const most = Math.min(written.length, meant.length) <= 3 ? 1 : 2;
  const edits = distance(written, meant);
  return written.length >= 2 && edits > 0 && edits <= most;
}

/** What the code knows: the language, its properties and what the code declares. */
interface Known {
  readonly declared: ReadonlySet<string>;
  readonly functionName?: string;
}

function isKnown(name: string, { declared }: Known): boolean {
  return LANGUAGE_NAMES.has(name) || PROPERTY_NAMES.has(name) || declared.has(name);
}

/**
 * A name written by mistake for another: an unknown name for a known one almost the same, or the
 * function renamed to the one the exercise asks for when the code does not declare it yet.
 */
function isNameSlip(written: string, meant: string, known: Known): boolean {
  if (!closeEnough(written, meant)) return false;
  const renamesFunction = meant === known.functionName && !known.declared.has(known.functionName);
  return renamesFunction || (!isKnown(written, known) && isKnown(meant, known));
}

/** A run of tokens removed and added between two kept ones. */
interface Hunk {
  readonly removed: readonly string[];
  readonly added: readonly string[];
}

/** The tokens removed and added from one line to the other, by their longest common sequence. */
function hunksOf(before: readonly string[], after: readonly string[]): Hunk[] {
  const common = Array.from({ length: before.length + 1 }, () =>
    new Array<number>(after.length + 1).fill(0),
  );
  for (let i = before.length - 1; i >= 0; i--) {
    for (let j = after.length - 1; j >= 0; j--) {
      common[i][j] =
        before[i] === after[j]
          ? common[i + 1][j + 1] + 1
          : Math.max(common[i + 1][j], common[i][j + 1]);
    }
  }
  const hunks: Hunk[] = [];
  let removed: string[] = [];
  let added: string[] = [];
  const close = () => {
    if (removed.length > 0 || added.length > 0) hunks.push({ removed, added });
    removed = [];
    added = [];
  };
  let i = 0;
  let j = 0;
  while (i < before.length || j < after.length) {
    if (i < before.length && j < after.length && before[i] === after[j]) {
      close();
      i++;
      j++;
    } else if (j >= after.length || (i < before.length && common[i + 1][j] >= common[i][j + 1])) {
      removed.push(before[i++]);
    } else {
      added.push(after[j++]);
    }
  }
  close();
  return hunks;
}

/** A hunk a slip may make: brackets, separators and quotes, and at most one name for another. */
function isSlip({ removed, added }: Hunk, known: Known): boolean {
  const removedWords = removed.filter(isWord);
  const addedWords = added.filter(isWord);
  const rest = [...removed, ...added].filter((token) => !isWord(token));
  if (!rest.every((token) => PUNCTUATION.has(token))) return false;
  if (removedWords.length !== addedWords.length || removedWords.length > 1) return false;
  return removedWords.length === 0 || isNameSlip(removedWords[0], addedWords[0], known);
}

/** How many tokens a hunk changes: a name for another is one. */
function editsOf({ removed, added }: Hunk): number {
  const names = removed.filter(isWord).length;
  return removed.length + added.length - names;
}

/** What a fix changes in the code as it is, to show it; not whether it is a slip. */
export type FixPreview =
  | { readonly ok: true; readonly changes: readonly FixChange[] }
  | { readonly ok: false; readonly problem: 'line' | 'unchanged' };

/**
 * What a fix would change in the code as it is now: the chat shows it next to «Aplicar», and says so
 * if the student already fixed it. Whether it is a slip is for `checkFix`.
 */
export function previewFix(source: string, fix: CodeFix): FixPreview {
  const hunks = hunksIn(source.split('\n'), fix);
  if (typeof hunks === 'string') return { ok: false, problem: hunks };
  return { ok: true, changes: hunks.map(changeOf) };
}

function changeOf({ removed, added }: Hunk): FixChange {
  return { before: removed.join(''), after: added.join('') };
}

function hunksIn(lines: readonly string[], fix: CodeFix): Hunk[] | 'line' | 'unchanged' {
  const last = fix.insert ? lines.length + 1 : lines.length;
  if (!Number.isInteger(fix.line) || fix.line < 1 || fix.line > last) return 'line';
  const before = fix.insert ? [] : tokensOf(lines[fix.line - 1]).map((token) => token.text);
  const after = tokensOf(fix.code).map((token) => token.text);
  const hunks = hunksOf(before, after);
  return hunks.length === 0 ? 'unchanged' : hunks;
}

/** Checks that a fix only corrects a slip of writing, and gives the code with it. */
export function checkFix(source: string, fix: CodeFix, context: FixContext = {}): FixCheck {
  const lines = source.split('\n');
  const hunks = hunksIn(lines, fix);
  if (typeof hunks === 'string') return { ok: false, problem: hunks };
  const known: Known = { declared: declaredNames(source), functionName: context.functionName };
  if (!hunks.every((hunk) => isSlip(hunk, known))) return { ok: false, problem: 'not_a_slip' };
  if (hunks.reduce((total, hunk) => total + editsOf(hunk), 0) > MAX_FIX_EDITS) {
    return { ok: false, problem: 'too_big' };
  }
  const fixed = fix.insert
    ? [...lines.slice(0, fix.line - 1), fix.code, ...lines.slice(fix.line - 1)]
    : lines.map((line, index) => (index === fix.line - 1 ? fix.code : line));
  return {
    ok: true,
    code: fixed.join('\n'),
    line: fix.line,
    changes: hunks.map(changeOf),
    namesOnly: hunks.every(
      ({ removed, added }) =>
        removed.length === 1 && added.length === 1 && isWord(removed[0]) && isWord(added[0]),
    ),
  };
}

/**
 * The first misspelt name of the code, fixed: one that nobody declared and is almost the same as a
 * known one, and only one (`Math.mix` could be `max` or `min`). The scripted tutor uses it (2.5f).
 * Texts and comments are not code.
 */
export function suggestFix(source: string, context: FixContext = {}): CodeFix | null {
  const known: Known = { declared: declaredNames(source), functionName: context.functionName };
  const candidates = (token: Token) =>
    token.property
      ? [...PROPERTY_NAMES]
      : [...LANGUAGE_NAMES, ...known.declared].filter((name) => name !== token.text);
  for (const [index, line] of source.split('\n').entries()) {
    for (const token of tokensOf(line)) {
      if (!isWord(token.text) || token.quoted || isKnown(token.text, known)) continue;
      const close = candidates(token).filter((name) => closeEnough(token.text, name));
      const best = Math.min(...close.map((name) => distance(token.text, name)));
      const nearest = close.filter((name) => distance(token.text, name) === best);
      if (nearest.length !== 1) continue;
      const code =
        line.slice(0, token.start) + nearest[0] + line.slice(token.start + token.text.length);
      return { line: index + 1, code };
    }
  }
  return null;
}

/** Whether the code declares the function, as `function name(` or `const name =`. */
export function declaresFunction(code: string, functionName: string): boolean {
  const name = functionName.replace(/\$/g, '\\$');
  return new RegExp(`(?:\\bfunction\\s+${name}\\s*\\(|\\b(?:const|let|var)\\s+${name}\\s*=)`).test(
    code,
  );
}
