import {
  afterNextRender,
  Component,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { javascript } from '@codemirror/lang-javascript';
import { bracketMatching, indentOnInput, type LanguageSupport } from '@codemirror/language';
import { EditorState, Prec, type Transaction } from '@codemirror/state';
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
import { CodeFormatter } from './code-formatter';
import type { LineMark } from './line-mark';
import { lineMarks, setLineMarks } from './line-marks';

/**
 * Highlighting and indentation of each language an exercise can be written in. A new language
 * (Python, Java…) only adds its CodeMirror package here (D-029).
 */
const LANGUAGES: Record<Language, () => LanguageSupport> = {
  javascript: () => javascript(),
};

let nextId = 0;

/** What «Formatear» did: the code put in order, nothing to change, or code it cannot read. */
export type FormatOutcome = 'formatted' | 'unchanged' | 'failed';

/**
 * Characters a paste brought from outside the code. Text that was already there, such as a line the
 * student copied to repeat it, is not a paste the teacher needs to see (2.8).
 */
function pastedFromOutside(transaction: Transaction): number {
  const before = transaction.startState.doc.toString();
  let length = 0;
  transaction.changes.iterChanges((_fromA, _toA, _fromB, _toB, inserted) => {
    const text = inserted.toString();
    if (!before.includes(text)) length += text.length;
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
    <!-- CodeMirror puts its editor first, above the hint. The hint only shows while the editor has
         the focus, so it does not take a line from the code, and not on touch screens, which have no
         Tab key; screen readers hear it as the description of the editor even when it is hidden. -->
    @if (!readonly()) {
      <p
        [id]="hintId"
        class="hidden text-body-small text-on-surface-variant group-focus-within:block pointer-coarse:hidden"
        i18n="@@codeEditor.hintFormat"
      >
        Tab sangra; Mayús + Alt + F formatea el código; Ctrl + Intro ejecuta las pruebas; para salir
        del editor, Esc y después Tab.
      </p>
    }
    <!-- Formatting left the code as it was: it says why, until the code changes (2.5d) -->
    @if (formatProblem(); as problem) {
      <p
        role="status"
        class="flex items-center gap-2 rounded-lg bg-warning-container px-3 py-2 text-body-small text-on-warning-container"
      >
        @if (problem.line; as line) {
          <span i18n="@@codeEditor.formatErrorLine"
            >No se puede formatear: el código tiene un error en la línea {{ line }}. Corrígelo y
            vuelve a probar.</span
          >
        } @else {
          <span i18n="@@codeEditor.formatError"
            >No se ha podido formatear el código. Vuelve a probar.</span
          >
        }
      </p>
    }
  `,
  // Inline-size containment: a long line scrolls inside the editor instead of widening its column,
  // which on a phone pushed the whole page sideways
  host: { class: 'group flex min-h-0 flex-col gap-1 contain-inline-size' },
})
export class CodeEditor {
  /** Code when the editor is created. */
  readonly initialCode = input.required<string>();
  /** Accessible name of the text area, such as «Código». */
  readonly label = input.required<string>();
  readonly language = input<Language>('javascript');
  /** Help shown while the code is empty, such as «Escribe aquí la función `sum`». */
  readonly placeholder = input('');
  readonly readonly = input(false);
  /** Lines the tutor marks, each with its note (2.5e); they go away with the first edit. */
  readonly marks = input<readonly LineMark[]>([]);

  /** The code after each change. */
  readonly codeChange = output<string>();
  /** Length of the text the student pasted from outside the code (event `paste`, 2.8). */
  readonly pasted = output<number>();
  /** Ctrl + Enter (or ⌘ + Enter): run the tests without leaving the editor. */
  readonly runShortcut = output();

  protected readonly hintId = `app-code-editor-hint-${nextId++}`;
  /** Why the last «Formatear» left the code as it was: the line of its error, if it says one. */
  protected readonly formatProblem = signal<{ readonly line?: number } | null>(null);
  private readonly host: HTMLElement = inject(ElementRef).nativeElement;
  private readonly formatter = inject(CodeFormatter);
  private view: EditorView | undefined;

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
      this.view = view;
      destroyRef.onDestroy(() => view.destroy());
    });
    // The boundary with CodeMirror: the marks of the tutor reach the editor, which shows the first one
    effect(() => {
      const marks = this.marks();
      const view = this.view;
      if (!view) return;
      const first = Math.min(...marks.map((mark) => mark.line), view.state.doc.lines);
      view.dispatch({
        effects: [
          setLineMarks.of(marks),
          ...(marks.length > 0
            ? [EditorView.scrollIntoView(view.state.doc.line(first).from, { y: 'center' })]
            : []),
        ],
      });
    });
  }

  /**
   * Puts the code in order (2.5d): indentation, spaces, semicolons and braces, with the cursor on the
   * same piece of code. It is one change of the history, so Ctrl + Z undoes it. Code that cannot be
   * read stays as it is, and the editor says the line of its error. Nothing in a read only editor,
   * nor if the student typed while it was formatting.
   */
  async format(): Promise<FormatOutcome> {
    const view = this.view;
    if (!view || this.readonly()) return 'unchanged';
    const code = view.state.doc.toString();
    const result = await this.formatter.format(code, view.state.selection.main.head);
    if (!result.ok) {
      this.formatProblem.set({ line: result.line });
      return 'failed';
    }
    this.formatProblem.set(null);
    if (result.code === code || view.state.doc.toString() !== code) return 'unchanged';
    view.dispatch({
      changes: { from: 0, to: code.length, insert: result.code },
      selection: { anchor: result.cursor },
      scrollIntoView: true,
      userEvent: 'input.format',
    });
    return 'formatted';
  }

  /** The code as it is in the editor now, unsaved changes included. */
  code(): string {
    return this.view?.state.doc.toString() ?? untracked(this.initialCode);
  }

  /**
   * Writes the code the tutor brings when the student presses its button (2.5f): the skeleton or a
   * fixed slip. Only the part that changes goes in, as one change of the history, so Ctrl + Z
   * undoes it, and the cursor goes to the end of `line`. It is not a paste (2.8). Nothing in a read
   * only editor.
   */
  replaceCode(code: string, line: number): void {
    const view = this.view;
    if (!view || this.readonly()) return;
    const current = view.state.doc.toString();
    if (code === current) return;
    let start = 0;
    while (start < current.length && start < code.length && current[start] === code[start]) start++;
    let end = 0;
    while (
      end < current.length - start &&
      end < code.length - start &&
      current[current.length - 1 - end] === code[code.length - 1 - end]
    ) {
      end++;
    }
    const lines = code.split('\n');
    const shown = Math.min(Math.max(line, 1), lines.length);
    const cursor = lines.slice(0, shown).reduce((total, each) => total + each.length + 1, -1);
    view.dispatch({
      changes: {
        from: start,
        to: current.length - end,
        insert: code.slice(start, code.length - end),
      },
      selection: { anchor: cursor },
      scrollIntoView: true,
      userEvent: 'input.tutor',
    });
  }

  /** Puts the focus in the code, as after «Aplicar»: Ctrl + Z is at hand. */
  focus(): void {
    this.view?.focus();
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
      // Before the default keymap, whose Mod-Enter would insert a blank line instead; Ctrl too on a
      // Mac, where Mod is ⌘, as many code playgrounds do
      Prec.highest(
        keymap.of(
          readonly
            ? []
            : [
                ...['Mod-Enter', 'Ctrl-Enter'].map((key) => ({
                  key,
                  run: () => this.requestRun(),
                })),
                // As «Format document» in VS Code (2.5d)
                { key: 'Shift-Alt-f', run: () => this.requestFormat() },
              ],
        ),
      ),
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
      lineMarks(untracked(this.marks)),
      EditorView.editorAttributes.of({ class: 'font-mono text-body-medium' }),
      EditorView.updateListener.of((update) => this.report(update)),
    ];
  }

  private requestRun(): boolean {
    this.runShortcut.emit();
    return true;
  }

  private requestFormat(): boolean {
    void this.format();
    return true;
  }

  private report(update: ViewUpdate): void {
    if (!update.docChanged) return;
    // The code changed: whatever kept it from being formatted may be fixed
    this.formatProblem.set(null);
    this.codeChange.emit(update.state.doc.toString());
    // CodeMirror marks every paste, from the keyboard, the context menu or a phone (2.8).
    const pastedLength = update.transactions
      .filter((transaction) => transaction.isUserEvent('input.paste'))
      .reduce((total, transaction) => total + pastedFromOutside(transaction), 0);
    if (pastedLength > 0) this.pasted.emit(pastedLength);
  }
}
