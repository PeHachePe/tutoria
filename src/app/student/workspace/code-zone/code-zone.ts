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
import type { Exercise } from '../../../data/exercise';
import { CodeEditor } from '../../../shared/code-editor/code-editor';
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

  protected readonly store = inject(AttemptStore);
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

  /** «Entregar» asks first: once submitted, the code cannot change (2.4). */
  protected async confirmSubmit(): Promise<void> {
    if (!this.store.canSubmit()) return;
    const confirmation = this.dialog.open(SubmitDialog);
    // It goes with the zone, as the data notice with the area (StudentLayout)
    const removeClose = this.destroyRef.onDestroy(() => confirmation.close());
    const confirmed = await firstValueFrom(confirmation.afterClosed());
    removeClose();
    if (confirmed) await this.submit();
  }

  /** Tries again the run or the submission that failed. */
  protected retryAction(): void {
    if (this.store.actionError()?.action === 'submit') {
      void this.submit();
    } else {
      void this.store.run();
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
  private async submit(): Promise<void> {
    if (await this.store.submit()) {
      afterNextRender(() => this.submittedNote()?.nativeElement.focus(), {
        injector: this.injector,
      });
    }
  }
}
