import { javascriptLanguage } from '@codemirror/lang-javascript';
import { highlightCode, tagHighlighter, tags } from '@lezer/highlight';

/**
 * The colours of the code, as Tailwind classes with the tokens of the active theme, shared by the
 * editor and the blocks of code of the chat (2.5d), so a piece of code looks the same in both. Each
 * one is a role of the Material palette, which keeps AA contrast over the surfaces in both modes, and
 * comments are also italic so colour is not the only difference (4.7).
 */
export const codeHighlighter = tagHighlighter([
  {
    tag: [tags.keyword, tags.controlKeyword, tags.definitionKeyword, tags.moduleKeyword],
    class: 'font-semibold text-primary',
  },
  { tag: [tags.string, tags.special(tags.string), tags.regexp], class: 'text-tertiary' },
  { tag: [tags.number, tags.bool, tags.null, tags.atom], class: 'text-info' },
  {
    tag: [tags.function(tags.variableName), tags.function(tags.propertyName)],
    class: 'text-secondary',
  },
  {
    tag: [tags.definition(tags.variableName), tags.definition(tags.function(tags.variableName))],
    class: 'font-semibold text-on-surface',
  },
  { tag: tags.comment, class: 'italic text-on-surface-variant' },
  { tag: tags.invalid, class: 'text-error' },
]);

/** A piece of highlighted code: its text and the classes of its colour, empty for plain text. */
export interface HighlightedPiece {
  readonly text: string;
  readonly classes: string;
}

/** JavaScript in pieces with the classes of their colours, line breaks included, to draw as spans. */
export function highlightJavaScript(code: string): HighlightedPiece[] {
  const pieces: HighlightedPiece[] = [];
  highlightCode(
    code,
    javascriptLanguage.parser.parse(code),
    codeHighlighter,
    (text, classes) => pieces.push({ text, classes }),
    () => pieces.push({ text: '\n', classes: '' }),
  );
  return pieces;
}
