import { undo } from '@codemirror/commands';
import { EditorView, runScopeHandlers } from '@codemirror/view';
import { TestBed } from '@angular/core/testing';
import { render, screen, waitFor } from '@testing-library/angular';

import { CodeEditor } from './code-editor';
import { CodeFormatter } from './code-formatter';

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
  const runShortcut = vi.fn<() => void>();
  const result = await render(CodeEditor, {
    inputs: { initialCode, label: 'Código', placeholder, readonly },
    on: { codeChange, pasted, runShortcut },
  });
  const textbox = screen.getByRole('textbox', { name: 'Código' });
  // Typing into a contenteditable does not reach CodeMirror in jsdom: edits go through its view,
  // marked as CodeMirror marks what the student types or pastes.
  const view = EditorView.findFromDOM(textbox);
  if (!view) throw new Error('CodeMirror view not found');
  return { ...result, textbox, view, codeChange, pasted, runShortcut };
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

  it('reports nothing as pasted when the text was already in the code, such as a copied line', async () => {
    const { view, codeChange, pasted } = await renderEditor({ initialCode: 'total += x;\n' });

    view.dispatch({ changes: { from: 12, insert: 'total += x;' }, userEvent: 'input.paste' });

    expect(codeChange).toHaveBeenCalledExactlyOnceWith('total += x;\ntotal += x;');
    expect(pasted).not.toHaveBeenCalled();
  });

  it('reports nothing when only the selection moves', async () => {
    const { view, codeChange } = await renderEditor({ initialCode: 'abc' });

    view.dispatch({ selection: { anchor: 1 } });

    expect(codeChange).not.toHaveBeenCalled();
  });

  it('explains how to leave the editor with the keyboard', async () => {
    const { textbox } = await renderEditor();

    const hint = screen.getByText(/Esc y después Tab/);
    expect(textbox.getAttribute('aria-describedby')).toBe(hint.id);
  });

  it('asks to run the tests with Ctrl + Enter, instead of adding a line', async () => {
    // jsdom is not a Mac: there Mod is Ctrl, and ⌘ + Enter is the same binding on a Mac
    const { view, runShortcut, codeChange } = await renderEditor({ initialCode: 'abc' });

    const handled = runScopeHandlers(
      view,
      new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true }),
      'editor',
    );

    expect(handled).toBe(true);
    expect(runShortcut).toHaveBeenCalledOnce();
    expect(codeChange).not.toHaveBeenCalled();
  });

  it('does not ask to run a read-only code', async () => {
    const { view, runShortcut } = await renderEditor({ readonly: true });

    runScopeHandlers(view, new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true }), 'editor');

    expect(runShortcut).not.toHaveBeenCalled();
  });

  it('only shows the code when it is read only', async () => {
    const { textbox, view } = await renderEditor({ initialCode: 'abc', readonly: true });

    expect(view.state.readOnly).toBe(true);
    expect(textbox.getAttribute('aria-readonly')).toBe('true');
    expect(screen.queryByText(/Esc y después Tab/)).toBeNull();
  });

  describe('formatting', () => {
    const MESSY = 'function f(a){\nreturn a+1}';
    const TIDY = 'function f(a) {\n  return a + 1;\n}\n';
    const BROKEN = 'f(\nx';

    it('puts the code in order, reports it and lets Ctrl + Z undo it', async () => {
      const { view, fixture, codeChange } = await renderEditor({ initialCode: MESSY });

      await fixture.componentInstance.format();

      expect(view.state.doc.toString()).toBe(TIDY);
      expect(codeChange).toHaveBeenLastCalledWith(TIDY);
      undo(view);
      expect(view.state.doc.toString()).toBe(MESSY);
    });

    it('formats with Mayús + Alt + F, as VS Code does', async () => {
      const { view } = await renderEditor({ initialCode: MESSY });

      const handled = runScopeHandlers(
        view,
        // With Shift the key is «F»: CodeMirror finds the binding by its key code, as browsers send
        new KeyboardEvent('keydown', { key: 'F', keyCode: 70, shiftKey: true, altKey: true }),
        'editor',
      );

      expect(handled).toBe(true);
      await waitFor(() => expect(view.state.doc.toString()).toBe(TIDY));
    });

    it('says the line of the error of a code it cannot read, until the code changes', async () => {
      const { view, fixture, codeChange } = await renderEditor({ initialCode: BROKEN });

      await fixture.componentInstance.format();
      fixture.detectChanges();

      expect(view.state.doc.toString()).toBe(BROKEN);
      expect(codeChange).not.toHaveBeenCalled();
      expect(screen.getByRole('status').textContent).toContain('error en la línea 2');

      view.dispatch({ changes: { from: 4, insert: ')' }, userEvent: 'input.type' });
      fixture.detectChanges();
      expect(screen.queryByRole('status')).toBeNull();
    });

    it('changes nothing in a code already in order', async () => {
      const { fixture, codeChange } = await renderEditor({ initialCode: TIDY });

      await fixture.componentInstance.format();

      expect(codeChange).not.toHaveBeenCalled();
    });

    it('does not format a read-only code', async () => {
      const { view, fixture } = await renderEditor({ initialCode: MESSY, readonly: true });

      await fixture.componentInstance.format();

      expect(view.state.doc.toString()).toBe(MESSY);
    });

    it('keeps what the student typed while it was formatting', async () => {
      const { view, fixture } = await renderEditor({ initialCode: MESSY });

      const formatting = fixture.componentInstance.format();
      view.dispatch({ changes: { from: 0, insert: '// ' }, userEvent: 'input.type' });
      await formatting;

      expect(view.state.doc.toString()).toBe(`// ${MESSY}`);
    });
  });

  it('says so when it could not format at all, as when Prettier does not download', async () => {
    const formatter: Pick<CodeFormatter, 'format'> = {
      format: () => Promise.resolve({ ok: false }),
    };
    TestBed.overrideProvider(CodeFormatter, { useValue: formatter });
    const { fixture } = await renderEditor({ initialCode: 'x' });

    await fixture.componentInstance.format();
    fixture.detectChanges();

    expect(screen.getByRole('status').textContent).toContain('No se ha podido formatear el código');
  });

  it('closes CodeMirror when it is removed', async () => {
    const { view, fixture } = await renderEditor();
    const destroy = vi.spyOn(view, 'destroy');

    fixture.destroy();

    expect(destroy).toHaveBeenCalledOnce();
  });
});
