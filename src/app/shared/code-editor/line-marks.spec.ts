import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';

import { lineMarks, markDecorations, setLineMarks } from './line-marks';

const CODE = 'function suma(v) {\n  let total = 0;\n  return total;\n}';

function decorated(state: EditorState, marks = markDecorations(state, [])) {
  const found: { from: number; to: number; line: boolean }[] = [];
  marks.between(0, state.doc.length, (from, to, value) => {
    found.push({ from, to, line: value.spec.class !== undefined });
  });
  return found;
}

describe('markDecorations', () => {
  const state = EditorState.create({ doc: CODE });

  it('marks each line once, in order, with its note after the code', () => {
    const marks = markDecorations(state, [
      { line: 3, note: 'Revisa el return' },
      { line: 2 },
      { line: 3 },
      { line: 9 },
    ]);
    expect(decorated(state, marks)).toEqual([
      { from: state.doc.line(2).from, to: state.doc.line(2).from, line: true },
      { from: state.doc.line(3).from, to: state.doc.line(3).from, line: true },
      { from: state.doc.line(3).to, to: state.doc.line(3).to, line: false },
    ]);
  });
});

describe('lineMarks', () => {
  let view: EditorView;

  afterEach(() => view.destroy());

  function editor(initial = [{ line: 1, note: 'Aquí' }]) {
    const field = lineMarks(initial);
    view = new EditorView({ state: EditorState.create({ doc: CODE, extensions: [field] }) });
    return () => decorated(view.state, view.state.field(field));
  }

  it('starts with the marks given and shows their notes', () => {
    const marks = editor();
    expect(marks()).toHaveLength(2);
    const note = view.dom.querySelector('.cm-line span.bg-tertiary-container');
    expect(note?.textContent).toBe('Aquí');
  });

  it('changes with the effect, keeps them while nothing is edited and drops them on the first edit', () => {
    const marks = editor([]);
    view.dispatch({ effects: setLineMarks.of([{ line: 2 }]) });
    expect(marks()).toHaveLength(1);

    view.dispatch({ selection: { anchor: 3 } });
    view.dispatch({ effects: EditorView.scrollIntoView(0) });
    expect(marks()).toHaveLength(1);

    view.dispatch({ changes: { from: 0, insert: '// ' } });
    expect(marks()).toEqual([]);
  });

  it('draws the same note once', () => {
    editor([{ line: 1, note: 'Aquí' }]);
    view.dispatch({ effects: setLineMarks.of([{ line: 1, note: 'Aquí' }]) });
    expect(view.dom.querySelectorAll('span.bg-tertiary-container')).toHaveLength(1);
  });
});
