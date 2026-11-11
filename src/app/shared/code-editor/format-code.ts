import type { CursorOptions, CursorResult } from 'prettier';

/** The code put in order, with the cursor where it was; or, if it cannot be read, the line why. */
export type FormatResult =
  | { readonly ok: true; readonly code: string; readonly cursor: number }
  | { readonly ok: false; readonly line?: number };

/** What formats: Prettier with its parser of JavaScript, downloaded the first time it is used. */
export type Formatter = (code: string, options: CursorOptions) => Promise<CursorResult>;

/**
 * The style of the code of the exercises: two spaces, semicolons and single quotes, as the seed is
 * written (D-045), and lines of 80, which fit the editor beside the tutor.
 */
const STYLE = { parser: 'babel', singleQuote: true, printWidth: 80, tabWidth: 2 } as const;

/**
 * Prettier and its plugins are big, so they come in a chunk of their own the first time a student
 * formats, never with the workspace.
 */
async function loadPrettier(): Promise<Formatter> {
  const [prettier, babel, estree] = await Promise.all([
    import('prettier/standalone'),
    import('prettier/plugins/babel'),
    import('prettier/plugins/estree'),
  ]);
  return (code, options) =>
    prettier.formatWithCursor(code, { ...options, plugins: [babel, estree.default] });
}

/**
 * Puts the student's code in order (2.5d): indentation, spaces, semicolons and braces, as a code
 * editor does with «Format document». Only how it looks, never what it does. Code that cannot be
 * read, such as a bracket left open, is not touched: the result says the line of the error, so the
 * student can fix it.
 */
export async function formatCode(
  code: string,
  cursor: number,
  load: () => Promise<Formatter> = loadPrettier,
): Promise<FormatResult> {
  try {
    const format = await load();
    const result = await format(code, { ...STYLE, cursorOffset: cursor });
    return { ok: true, code: result.formatted, cursor: result.cursorOffset };
  } catch (error) {
    const line = errorLine(error);
    return line === undefined ? { ok: false } : { ok: false, line };
  }
}

/** The line Prettier's parser says the error is in (`loc.start.line`), if it says one. */
function errorLine(error: unknown): number | undefined {
  const loc = (error as { loc?: { start?: { line?: unknown } } }).loc;
  const line = loc?.start?.line;
  return typeof line === 'number' ? line : undefined;
}
