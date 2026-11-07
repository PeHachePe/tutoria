export interface TextPart {
  readonly text: string;
  /** Written between backticks in the source, to be shown as code. */
  readonly code: boolean;
}

/**
 * Splits a statement into plain text and the code written between backticks (`suma`), so the
 * template can show the code as code without parsing HTML. An unpaired backtick stays as text.
 */
export function splitInlineCode(text: string): TextPart[] {
  return text
    .split(/(`[^`]+`)/)
    .filter((part) => part !== '')
    .map((part) =>
      part.length > 2 && part.startsWith('`') && part.endsWith('`')
        ? { text: part.slice(1, -1), code: true }
        : { text: part, code: false },
    );
}
