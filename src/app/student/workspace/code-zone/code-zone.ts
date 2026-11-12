import { DatePipe, NgTemplateOutlet } from '@angular/common';
import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  Injector,
  input,
  model,
  output,
  viewChild,
} from '@angular/core';
import { MatAnchor, MatButton, MatIconButton } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { MatTooltip } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { APP_PATHS } from '../../../core/app-paths';
import { PageReloader } from '../../../core/page-reloader';
import { appTool, declareAppTool, ToolError } from '../../../core/tools/app-tool';
import type { Exercise } from '../../../data/exercise';
import { skeletonCode } from '../../../data/tutor';
import { checkFix, type CodeFix, declaresFunction } from '../../../data/tutor/code-fix';
import { TUTOR_TOOL } from '../../../data/tutor/tutor-tools';
import { CodeEditor, type FormatOutcome } from '../../../shared/code-editor/code-editor';
import { LoadingSkeleton } from '../../../shared/skeleton/loading-skeleton';
import { Skeleton } from '../../../shared/skeleton/skeleton';
import { AttemptStore } from '../attempt-store';
import { BrowserSignals } from '../browser-signals';
import { RetryButton } from '../../../shared/retry-button/retry-button';
import { isSessionExpired, SignInAgain } from '../../../shared/sign-in-again/sign-in-again';
import { actionErrorMessage } from './action-error-message';
import { RunResults } from './run-results';
import { SaveIndicator } from './save-indicator';
import { SubmitDialog } from './submit-dialog';
import { TutorStore } from '../tutor-store';

/** What the zone asks of the editor, without naming its class (see `editableEditor`). */
interface WritableEditor {
  format(): Promise<FormatOutcome>;
  code(): string;
  replaceCode(code: string, line: number): void;
  focus(): void;
}

/** The note next to the function «Insertar» wrote (2.5f). */
const SKELETON_NOTE = $localize`:@@workspace.skeletonMark:Tu función: escribe dentro lo que hace`;

/** The note next to the line «Aplicar» fixed (2.5f). */
const FIX_NOTE = $localize`:@@workspace.fixMark:Aquí estaba el despiste`;

/** Id of the zone, which the splitter beside it controls. */
export const CODE_ZONE_ID = 'code-zone';

/**
 * The code zone of the workspace (ficha 03): the editor with its autosave (1.4), «Ejecutar pruebas»
 * and «Entregar» with their results (1.5, CU-01) and the pastes the browser signals record (1.6). It
 * is the main zone: it takes the room the others leave, and on wide screens it can take the
 * statement's too.
 */
@Component({
  selector: 'app-code-zone',
  imports: [
    DatePipe,
    NgTemplateOutlet,
    RouterLink,
    MatAnchor,
    MatButton,
    RetryButton,
    MatIconButton,
    MatIcon,
    MatTooltip,
    LoadingSkeleton,
    Skeleton,
    CodeEditor,
    SaveIndicator,
    RunResults,
    SignInAgain,
  ],
  templateUrl: './code-zone.html',
  host: {
    role: 'region',
    'aria-labelledby': 'code-heading',
    '[id]': 'zoneId',
    class: 'flex min-h-48 flex-1 flex-col gap-3 rounded-xl bg-panel p-4',
    '[class.h-full]': 'compact()',
  },
})
export class CodeZone {
  /** The exercise, once it is there: the editor needs its language and the name of its function. */
  readonly exercise = input<Exercise>();
  /** Phones: a tab of its own, which needs no «Ampliar el código». */
  readonly compact = input(false);
  /**
   * Wide screens: the code takes the room of the statement, which gives it its height, and goes
   * back with the same button. The tutor stays in sight, to ask and to see it step in (6.2).
   */
  readonly expanded = model(false);
  /** Where «Siguiente ejercicio» goes once submitted, or null to go back to the catalog (2.5c). */
  readonly nextPath = input<string | null>(null);
  /** «Practicar de nuevo» opened a new attempt here: the page drops the number from the URL. */
  readonly practised = output<void>();

  protected readonly store = inject(AttemptStore);
  /** Where the tutor marks the code and points at the results (2.5e). */
  protected readonly tutor = inject(TutorStore);
  /** Pastes from outside the code, recorded for the attempt open for changes (2.8). */
  protected readonly signals = inject(BrowserSignals);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly pageReloader = inject(PageReloader);

  protected readonly zoneId = CODE_ZONE_ID;
  protected readonly catalogPath = APP_PATHS.student.catalog;
  protected readonly editorLabel = $localize`:@@workspace.editorLabel:Código`;
  protected readonly expandCodeTooltip = $localize`:@@workspace.expandCodeTooltip:Ampliar el código`;
  protected readonly collapseCodeTooltip = $localize`:@@workspace.collapseCodeTooltip:Volver a la vista normal`;

  /**
   * What the editor starts with, once both the attempt and the exercise are there: the help it shows
   * while the code is empty («Escribe aquí la función `sum`», D-018) is read when it is created.
   */
  protected readonly editor = computed(() => {
    const attempt = this.store.attempt();
    const exercise = this.exercise();
    if (!attempt || !exercise) return undefined;
    return {
      code: attempt.currentCode,
      language: exercise.language,
      placeholder: $localize`:@@workspace.editorPlaceholder:Escribe aquí la función ${exercise.functionName}:functionName:`,
    };
  });

  /** The note that replaces the buttons once submitted, which takes the focus then. */
  private readonly submittedNote = viewChild<ElementRef<HTMLElement>>('submittedNote');
  private readonly heading = viewChild<ElementRef<HTMLElement>>('heading');
  /**
   * The editor the student writes in, found by its name and not by its class: naming the class here
   * would bring CodeMirror into the workspace and undo its `@defer` (4.7).
   */
  private readonly editableEditor = viewChild<WritableEditor>('editableEditor');

  /**
   * What only our tutor does in the code and with the submission, when the student presses its
   * button (2.5f, D-047): never through WebMCP. The zone has the editor and «Entregar».
   */
  protected readonly tutorTools = [
    declareAppTool(appTool(TUTOR_TOOL.formatCode, () => this.formatForTutor())),
    declareAppTool(
      appTool(TUTOR_TOOL.insertSkeleton, ({ parameters }) => this.insertSkeleton(parameters)),
    ),
    declareAppTool(appTool(TUTOR_TOOL.proposeFix, (fix) => this.applyFix(fix))),
    declareAppTool(appTool(TUTOR_TOOL.submitAttempt, () => this.submitForTutor())),
  ];

  protected readonly actionSessionExpired = computed(() =>
    isSessionExpired(this.store.actionError()?.error),
  );
  protected readonly actionErrorMessage = computed(() => {
    const failure = this.store.actionError();
    return failure && actionErrorMessage(failure);
  });

  /**
   * Read aloud once a run ends, as the results appear away from the button that started it. The
   * summary of the results only says it again for those who look.
   */
  protected readonly runAnnouncement = computed(() => {
    const run = this.store.lastRun();
    if (!run) return '';
    if (run.loadError) {
      return $localize`:@@workspace.runAnnouncement.notRun:El código no se ha podido ejecutar.`;
    }
    const passed = run.results.filter((result) => result.passed).length;
    const total = run.results.length;
    return passed === total
      ? $localize`:@@workspace.runAnnouncement.allPassed:Todas las pruebas superadas. Ya puedes entregar.`
      : $localize`:@@workspace.runAnnouncement.somePassed:${passed}:passed: de ${total}:total: pruebas superadas.`;
  });

  protected toggleExpanded(): void {
    this.expanded.update((expanded) => !expanded);
  }

  /** Each edit is saved; the marks of the tutor were about the code as it was (2.5e). */
  protected updateCode(code: string): void {
    this.store.updateCode(code);
    this.tutor.clearMarks();
  }

  /** «Formatear el código»: the editor puts it in order, or says why it cannot (2.5d). */
  protected formatCode(): void {
    void this.editableEditor()?.format();
  }

  /** «Entregar» asks first: once submitted, the code cannot change (2.4). True once submitted. */
  protected async confirmSubmit(): Promise<boolean> {
    if (!this.store.canSubmit()) return false;
    const confirmation = this.dialog.open(SubmitDialog);
    // It goes with the zone, as the data notice with the area (StudentLayout)
    const removeClose = this.destroyRef.onDestroy(() => confirmation.close());
    const confirmed = await firstValueFrom(confirmation.afterClosed());
    removeClose();
    return confirmed ? this.submit() : false;
  }

  /** The editor the tutor writes in: none while it downloads, or once submitted. */
  private writable(): WritableEditor {
    const editor = this.editableEditor();
    if (!editor) throw new ToolError('The code cannot be changed now');
    return editor;
  }

  /** «Formatear el código», asked by the tutor (2.5f). */
  private async formatForTutor(): Promise<{ formatted: boolean }> {
    const outcome = await this.writable().format();
    if (outcome === 'failed') {
      throw new ToolError('The code cannot be read, so it cannot be formatted');
    }
    return { formatted: outcome === 'formatted' };
  }

  /**
   * «Insertar» (2.5f): the empty function of the exercise, alone in an empty editor or after the code
   * there is, as the chat shows it. Not if the code already declares it.
   */
  private insertSkeleton(parameters: readonly string[]): { inserted: string } {
    const editor = this.writable();
    const { functionName } = this.exercise()!; // the editor is only there with the exercise
    const code = editor.code();
    if (declaresFunction(code, functionName)) {
      throw new ToolError(`The code already declares the function ${functionName}`);
    }
    const before = code.trimEnd();
    const skeleton = skeletonCode(functionName, parameters);
    const next = before ? `${before}\n\n${skeleton}` : skeleton;
    this.write(editor, next, next.split('\n').length - 1, SKELETON_NOTE);
    return { inserted: functionName };
  }

  /**
   * «Aplicar» (2.5f): the slip the tutor found, checked again against the code as it is now, which
   * may have changed since it answered. Only a slip of writing, never the logic (D-047).
   */
  private applyFix(fix: CodeFix): { line: number } {
    const editor = this.writable();
    const check = checkFix(editor.code(), fix, { functionName: this.exercise()?.functionName });
    if (!check.ok) {
      throw new ToolError(
        check.problem === 'unchanged'
          ? 'The code is already fixed'
          : 'The fix no longer fits the code as it is',
      );
    }
    this.write(editor, check.code, check.line, FIX_NOTE);
    return { line: check.line };
  }

  /**
   * Writes the code, marks the line with a note (which, on a phone, shows the code) and leaves the
   * focus in the editor, so Ctrl + Z is at hand. The edit clears the marks: the note goes after it.
   */
  private write(editor: WritableEditor, code: string, line: number, note: string): void {
    editor.replaceCode(code, line);
    this.tutor.mark([{ line, note }]);
    afterNextRender(() => editor.focus(), { injector: this.injector });
  }

  /** «Entregar», asked by the tutor (2.5f): the same dialog, and only the student confirms. */
  private async submitForTutor(): Promise<{ submitted: boolean }> {
    if (!this.store.canSubmit()) {
      throw new ToolError('Only an attempt that passes every test can be submitted');
    }
    return { submitted: await this.confirmSubmit() };
  }

  /** Tries again the run, the submission or the new attempt that failed. */
  protected retryAction(): void {
    switch (this.store.actionError()?.action) {
      case 'submit':
        void this.submit();
        break;
      case 'retry':
        void this.practiseAgain();
        break;
      default:
        void this.store.run();
    }
  }

  /**
   * «Practicar de nuevo» (2.5c): a new attempt, empty. The note with the button goes away, so the
   * focus goes to the heading of the zone, over the editor (WCAG 2.4.3).
   */
  protected async practiseAgain(): Promise<void> {
    if (await this.store.retry()) {
      this.practised.emit();
      afterNextRender(() => this.heading()?.nativeElement.focus(), { injector: this.injector });
    }
  }

  /** Reloads the page when the chunk of the editor could not be downloaded. */
  protected reloadPage(): void {
    this.pageReloader.reload();
  }

  /**
   * The buttons give way to the note that says it is submitted: the focus goes there, instead of
   * being lost with the button that had it (WCAG 2.4.3).
   */
  private async submit(): Promise<boolean> {
    const submitted = await this.store.submit();
    if (submitted) {
      afterNextRender(() => this.submittedNote()?.nativeElement.focus(), {
        injector: this.injector,
      });
    }
    return submitted;
  }
}
