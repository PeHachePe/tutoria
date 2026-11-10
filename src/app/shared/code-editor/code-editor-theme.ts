import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { EditorView } from '@codemirror/view';
import { tags } from '@lezer/highlight';

/**
 * Look of the editor with the tokens of the active theme, so it follows light and dark mode without
 * a second theme (4.7). It is CodeMirror's own styling API: its styles are scoped to the editor and
 * win over its base theme, which global CSS would have to fight (D-029).
 */
const editorTheme = EditorView.theme({
  // It fills the room its host gives it, a column with the hint below.
  '&': {
    flex: '1 1 0',
    minHeight: '0',
    color: 'var(--mat-sys-on-surface)',
    backgroundColor: 'var(--mat-sys-surface-container-lowest)',
    borderRadius: 'var(--mat-sys-corner-small, 8px)',
    border: '1px solid var(--mat-sys-outline-variant)',
  },
  // The same visible focus as the rest of the app (WCAG 2.4.7)
  '&.cm-focused': {
    outline: '2px solid var(--mat-sys-primary)',
    outlineOffset: '2px',
  },
  '.cm-scroller': {
    fontFamily: 'inherit',
    lineHeight: '1.6',
    overflow: 'auto',
  },
  '.cm-content': { caretColor: 'var(--mat-sys-primary)', padding: '0.5rem 0' },
  '.cm-cursor, .cm-dropCursor': {
    borderLeftColor: 'var(--mat-sys-primary)',
    borderLeftWidth: '2px',
  },
  '.cm-gutters': {
    color: 'var(--mat-sys-on-surface-variant)',
    backgroundColor: 'var(--mat-sys-surface-container-low)',
    borderRight: '1px solid var(--mat-sys-outline-variant)',
    borderTopLeftRadius: 'inherit',
    borderBottomLeftRadius: 'inherit',
  },
  // Translucent: the selection is drawn in a layer under the text, which an opaque line would hide
  '.cm-activeLine': {
    backgroundColor: 'color-mix(in srgb, var(--mat-sys-on-surface) 5%, transparent)',
  },
  '.cm-activeLineGutter': {
    color: 'var(--mat-sys-on-surface)',
    backgroundColor: 'var(--mat-sys-surface-container)',
  },
  '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, ::selection':
    { backgroundColor: 'var(--mat-sys-primary-container)' },
  '.cm-matchingBracket, &.cm-focused .cm-matchingBracket': {
    color: 'inherit',
    backgroundColor: 'var(--mat-sys-secondary-container)',
    outline: '1px solid var(--mat-sys-secondary)',
  },
  '.cm-nonmatchingBracket, &.cm-focused .cm-nonmatchingBracket': {
    color: 'var(--mat-sys-error)',
  },
  '.cm-placeholder': { color: 'var(--mat-sys-on-surface-variant)' },
});

/**
 * Colours of the code. Each one is a role of the Material palette, which keeps AA contrast over the
 * surfaces in both modes, and comments are also italic so colour is not the only difference.
 */
const highlightStyle = HighlightStyle.define([
  {
    tag: [tags.keyword, tags.controlKeyword, tags.definitionKeyword, tags.moduleKeyword],
    color: 'var(--mat-sys-primary)',
    fontWeight: '600',
  },
  { tag: [tags.string, tags.special(tags.string), tags.regexp], color: 'var(--mat-sys-tertiary)' },
  { tag: [tags.number, tags.bool, tags.null, tags.atom], color: 'var(--app-info)' },
  {
    tag: [tags.function(tags.variableName), tags.function(tags.propertyName)],
    color: 'var(--mat-sys-secondary)',
  },
  {
    tag: [tags.definition(tags.variableName), tags.definition(tags.function(tags.variableName))],
    color: 'var(--mat-sys-on-surface)',
    fontWeight: '600',
  },
  { tag: tags.comment, color: 'var(--mat-sys-on-surface-variant)', fontStyle: 'italic' },
  { tag: tags.invalid, color: 'var(--mat-sys-error)' },
]);

/** Theme and code colours of `<app-code-editor>`. */
export const codeEditorTheme = [editorTheme, syntaxHighlighting(highlightStyle)];
