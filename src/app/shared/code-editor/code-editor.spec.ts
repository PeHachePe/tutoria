import { EditorView } from '@codemirror/view';
import { render, screen } from '@testing-library/angular';

import { CodeEditor } from './code-editor';

interface Options {
  readonly initialCode?: string;
  readonly placeholder?: string;
  readonly readonly?: boolean;
}

async function renderEditor({
  initialCode = '',
  placeholder = '',
  readonly = false,
}: Options = {}) {
  const codeChange = vi.fn<(code: string) => void>();
  const pasted = vi.fn<(length: number) => void>();
  const result = await render(CodeEditor, {
    inputs: { initialCode, label: 'Código', placeholder, readonly },
    on: { codeChange, pasted },
  });
  const textbox = screen.getByRole('textbox', { name: 'Código' });
  // Typing into a contenteditable does not reach CodeMirror in jsdom: edits go through its view,
  // marked as CodeMirror marks what the student types or pastes.
  const view = EditorView.findFromDOM(textbox);
  if (!view) throw new Error('CodeMirror view not found');
  return { ...result, textbox, view, codeChange, pasted };
}

describe('CodeEditor', () => {
  it('shows the initial code in a text area named by its label', async () => {
    const { textbox, view } = await renderEditor({ initialCode: 'function suma(v) {}' });

    expect(textbox.textContent).toContain('function suma(v) {}');
    expect(view.state.doc.toString()).toBe('function suma(v) {}');
  });

  it('shows the help while the code is empty', async () => {
    await renderEditor({ placeholder: 'Escribe aquí la función suma' });

    expect(screen.getByText('Escribe aquí la función suma')).toBeTruthy();
  });

  it('reports the code after each change, and nothing as pasted when typed', async () => {
    const { view, codeChange, pasted } = await renderEditor({ initialCode: 'ab' });

    view.dispatch({ changes: { from: 2, insert: 'c' }, userEvent: 'input.type' });

    expect(codeChange).toHaveBeenCalledExactlyOnceWith('abc');
    expect(pasted).not.toHaveBeenCalled();
  });

  it('reports the length of the pasted text', async () => {
    const { view, codeChange, pasted } = await renderEditor({ initialCode: 'x' });

    view.dispatch({
      changes: { from: 0, to: 1, insert: 'return 1;\nreturn 2;' },
      userEvent: 'input.paste',
    });

    expect(pasted).toHaveBeenCalledExactlyOnceWith(19);
    expect(codeChange).toHaveBeenCalledExactlyOnceWith('return 1;\nreturn 2;');
  });

  it('reports nothing when only the selection moves', async () => {
    const { view, codeChange } = await renderEditor({ initialCode: 'abc' });

    view.dispatch({ selection: { anchor: 1 } });

    expect(codeChange).not.toHaveBeenCalled();
  });

  it('explains how to leave the editor with the keyboard', async () => {
    const { textbox } = await renderEditor();

    const hint = screen.getByText(/pulsa Esc y después Tab/);
    expect(textbox.getAttribute('aria-describedby')).toBe(hint.id);
  });

  it('only shows the code when it is read only', async () => {
    const { textbox, view } = await renderEditor({ initialCode: 'abc', readonly: true });

    expect(view.state.readOnly).toBe(true);
    expect(textbox.getAttribute('aria-readonly')).toBe('true');
    expect(screen.queryByText(/pulsa Esc y después Tab/)).toBeNull();
  });

  it('closes CodeMirror when it is removed', async () => {
    const { view, fixture } = await renderEditor();
    const destroy = vi.spyOn(view, 'destroy');

    fixture.destroy();

    expect(destroy).toHaveBeenCalledOnce();
  });
});
