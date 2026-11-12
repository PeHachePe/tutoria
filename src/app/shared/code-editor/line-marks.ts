import { type EditorState, RangeSetBuilder, StateEffect, StateField } from '@codemirror/state';
import { Decoration, type DecorationSet, EditorView, WidgetType } from '@codemirror/view';

import type { LineMark } from './line-mark';

/** Replaces the marks of the editor: the tutor marked other lines, or none (2.5e). */
export const setLineMarks = StateEffect.define<readonly LineMark[]>();

const MARKED_LINE = Decoration.line({ class: 'bg-tertiary-container/60' });

/** The note of a marked line, after its code: words of the tutor, never code (2.6). */
class NoteWidget extends WidgetType {
  constructor(readonly note: string) {
    super();
  }

  override eq(other: NoteWidget): boolean {
    return other.note === this.note;
  }

  override toDOM(): HTMLElement {
    const note = document.createElement('span');
    note.className =
      'ms-3 rounded-md bg-tertiary-container px-2 py-0.5 font-sans text-label-medium text-on-tertiary-container';
    note.textContent = this.note;
    return note;
  }
}

/** The lines of the code that exist, once each and in order, as CodeMirror needs them. */
export function markDecorations(state: EditorState, marks: readonly LineMark[]): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const lines = [...marks]
    .filter((mark) => mark.line <= state.doc.lines)
    .sort((a, b) => a.line - b.line)
    .filter((mark, index, sorted) => sorted[index - 1]?.line !== mark.line);
  for (const mark of lines) {
    const line = state.doc.line(mark.line);
    builder.add(line.from, line.from, MARKED_LINE);
    if (mark.note) {
      builder.add(
        line.to,
        line.to,
        Decoration.widget({ widget: new NoteWidget(mark.note), side: 1 }),
      );
    }
  }
  return builder.finish();
}

/**
 * The marks of the tutor in the editor: they start with `initial`, change with `setLineMarks` and go
 * away with the first edit, as they were about the code as it was.
 */
export function lineMarks(initial: readonly LineMark[]) {
  return StateField.define<DecorationSet>({
    create: (state) => markDecorations(state, initial),
    update: (marks, transaction) => {
      for (const effect of transaction.effects) {
        if (effect.is(setLineMarks)) return markDecorations(transaction.state, effect.value);
      }
      return transaction.docChanged ? Decoration.none : marks;
    },
    provide: (field) => EditorView.decorations.from(field),
  });
}
