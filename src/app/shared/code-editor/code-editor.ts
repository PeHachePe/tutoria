import {
  afterNextRender,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  input,
  output,
  untracked,
} from '@angular/core';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { javascript } from '@codemirror/lang-javascript';
import { bracketMatching, indentOnInput, type LanguageSupport } from '@codemirror/language';
import { EditorState, type Transaction } from '@codemirror/state';
import {
  drawSelection,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
  placeholder,
  type ViewUpdate,
} from '@codemirror/view';

import type { Language } from '../../data/exercise';
import { codeEditorTheme } from './code-editor-theme';

/**
 * Highlighting and indentation of each language an exercise can be written in. A new language
 * (Python, Java…) only adds its CodeMirror package here (D-029).
 */
const LANGUAGES: Record<Language, () => LanguageSupport> = {
  javascript: () => javascript(),
};

let nextId = 0;

/** Characters an edit puts in the code, such as the text a paste brings. */
function insertedLength(transaction: Transaction): number {
  let length = 0;
  transaction.changes.iterChanges((_fromA, _toA, _fromB, _toB, inserted) => {
    length += inserted.length;
  });
  return length;
}

/**
 * Code editor (4.7) on CodeMirror 6, chosen for its accessibility (report, RNF): line numbers, the
 * colours of the active theme, and no autocompletion nor suggestions, so the student writes the code.
 *
 * Its inputs are read when the editor is created; afterwards the editor owns the code and reports
 * each change through `codeChange`. Whoever uses it creates a new one to show other code or to
 * change `readonly` (for instance, with `@if` on the attempt), which also starts a clean undo
 * history. That way it needs no `effect()` to copy outside changes into CodeMirror (D-029).
 */
@Component({
  selector: 'app-code-editor',
  template: `
    <!-- CodeMirror puts its editor first, above the hint -->
    @if (!readonly()) {
      <p [id]="hintId" class="text-body-small text-on-surface-variant" i18n="@@codeEditor.hint">
        Tab sangra el código. Para salir del editor con el teclado, pulsa Esc y después Tab.
      </p>
    }
  `,
  host: { class: 'flex min-h-0 flex-col gap-1' },
})
export class CodeEditor {
  /** Code when the editor is created. */
  readonly initialCode = input.required<string>();
  /** Accessible name of the text area, such as «Código». */
  readonly label = input.required<string>();
  readonly language = input<Language>('javascript');
  /** Help shown while the code is empty, such as «Escribe aquí la función `suma`». */
  readonly placeholder = input('');
  readonly readonly = input(false);

  /** The code after each change. */
  readonly codeChange = output<string>();
  /** Length of the text the student pasted (event `paste`, 2.8). */
  readonly pasted = output<number>();

  protected readonly hintId = `app-code-editor-hint-${nextId++}`;
  private readonly host: HTMLElement = inject(ElementRef).nativeElement;

  constructor() {
    const destroyRef = inject(DestroyRef);
    // CodeMirror measures what it draws, so the editor is created once the host is in the page.
    afterNextRender(() => {
      const view = new EditorView({
        state: EditorState.create({
          doc: untracked(this.initialCode),
          extensions: untracked(() => this.extensions()),
        }),
      });
      this.host.prepend(view.dom);
      destroyRef.onDestroy(() => view.destroy());
    });
  }

  private extensions() {
    const readonly = this.readonly();
    return [
      lineNumbers(),
      highlightActiveLineGutter(),
      highlightActiveLine(),
      drawSelection(),
      history(),
      indentOnInput(),
      bracketMatching(),
      LANGUAGES[this.language()](),
      // Tab indents, as in any code editor; Esc and then Tab leave the editor (CodeMirror's escape
      // hatch), which the hint below explains so keyboard users are not trapped (WCAG 2.1.2).
      keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
      placeholder(this.placeholder()),
      EditorState.readOnly.of(readonly),
      EditorView.contentAttributes.of({
        'aria-label': this.label(),
        // Already focusable as contenteditable, but axe only counts a tabindex: without it, it flags
        // the scrolling area of the editor (scrollable-region-focusable). Same place in the tab order.
        tabindex: '0',
        ...(readonly ? { 'aria-readonly': 'true' } : { 'aria-describedby': this.hintId }),
      }),
      codeEditorTheme,
      EditorView.editorAttributes.of({ class: 'font-mono text-body-medium' }),
      EditorView.updateListener.of((update) => this.report(update)),
    ];
  }

  private report(update: ViewUpdate): void {
    if (!update.docChanged) return;
    this.codeChange.emit(update.state.doc.toString());
    // CodeMirror marks every paste, from the keyboard, the context menu or a phone (2.8).
    const pastedLength = update.transactions
      .filter((transaction) => transaction.isUserEvent('input.paste'))
      .reduce((total, transaction) => total + insertedLength(transaction), 0);
    if (pastedLength > 0) this.pasted.emit(pastedLength);
  }
}
