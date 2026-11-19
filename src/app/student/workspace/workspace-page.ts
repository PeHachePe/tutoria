import { Component, computed, DOCUMENT, inject, input, resource } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatAnchor, MatButton, MatIconAnchor } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatMenu, MatMenuItem, MatMenuTrigger } from '@angular/material/menu';
import { MatTooltip } from '@angular/material/tooltip';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';

import { APP_PATHS, STUDENT_PARAMS } from '../../core/app-paths';
import { AuthStore } from '../../auth/auth-store';
import { AppTitleStrategy } from '../../core/app-title-strategy';
import { LanguageService } from '../../core/i18n/language-service';
import { ExerciseService } from '../../data/exercise-service';
import { blockTitle, exerciseText, subjectName } from '../../data/localized-text';
import { DifficultyChip } from '../../shared/difficulty-chip/difficulty-chip';
import { LoadError } from '../../shared/load-error/load-error';
import { LoadingSkeleton } from '../../shared/skeleton/loading-skeleton';
import { Skeleton } from '../../shared/skeleton/skeleton';
import { StatusChip } from '../../shared/status-chip/status-chip';
import { nextInBlock } from '../catalog/catalog-blocks';
import { AttemptStore } from './attempt-store';
import { TutorSpeaker } from './tutor-speaker';
import { BrowserSignals } from './browser-signals';
import { WorkspaceLayout } from './workspace-layout';

/**
 * The workspace (/alumno/ejercicio/:id, ficha 03): the statement and its examples, the code and the
 * tutor of one exercise of a block (RF-03 to RF-06), each in a zone of its own. The page loads the
 * exercise of the assignment, opens its latest attempt or the one of `?intento=` (2.5c), shows
 * where it is, and listens to the window to keep the code and record absences (2.8). The zones are
 * laid out by `WorkspaceLayout`, which a teacher's try of an exercise shares (4.3e).
 */
@Component({
  selector: 'app-workspace-page',
  imports: [
    RouterLink,
    MatAnchor,
    MatButton,
    MatIconAnchor,
    MatIcon,
    MatMenu,
    MatMenuItem,
    MatMenuTrigger,
    MatTooltip,
    DifficultyChip,
    StatusChip,
    LoadError,
    LoadingSkeleton,
    Skeleton,
    WorkspaceLayout,
  ],
  templateUrl: './workspace-page.html',
  host: {
    // The code is saved 800 ms after the last change: these keep the latest changes when the student
    // hides the tab (phones may close it without warning) or tries to leave with something unsaved.
    '(document:visibilitychange)': 'onVisibilityChange()',
    '(window:beforeunload)': 'warnIfUnsaved($event)',
    // Absences from the window, another tab or another app (2.8)
    '(window:blur)': 'signals.left()',
    '(window:focus)': 'signals.returned()',
    // The screen takes the height left under the app bar and the padding of <main>, so each zone
    // scrolls inside it instead of the whole page (5.4). The bar is 56px on phones, 64px from 600px.
    class:
      'flex h-[calc(100dvh-var(--mat-toolbar-mobile-height,56px)-3rem)] min-h-96 flex-col gap-4 min-[600px]:h-[calc(100dvh-var(--mat-toolbar-standard-height,64px)-3rem)]',
  },
})
export class WorkspacePage {
  /** Assignment id, from the `:id` of the route (withComponentInputBinding). */
  readonly id = input.required<string>();

  private readonly router = inject(Router);
  /** The attempt asked for in the URL (`?intento=2`), to review an earlier one; none is the latest. */
  private readonly attemptNumber = toSignal(
    inject(ActivatedRoute).queryParamMap.pipe(
      map((params) => {
        const number = Number(params.get(STUDENT_PARAMS.attempt));
        return Number.isInteger(number) && number > 0 ? number : undefined;
      }),
    ),
    { initialValue: undefined },
  );

  private readonly exercises = inject(ExerciseService);
  private readonly titles = inject(AppTitleStrategy);
  private readonly locale = inject(LanguageService).locale;
  private readonly document = inject(DOCUMENT);
  private readonly userId = inject(AuthStore).userId;
  protected readonly store = inject(AttemptStore);
  /** Pastes and absences, recorded for the attempt open for changes (2.8). */
  protected readonly signals = inject(BrowserSignals);
  /** The tutor's voice: silent with the tab hidden (2.11). */
  private readonly speaker = inject(TutorSpeaker);

  protected readonly catalogPath = APP_PATHS.student.catalog;
  protected readonly detail = resource({
    params: () => this.id(),
    loader: async ({ params: assignmentId, abortSignal }) => {
      const detail = await this.exercises.getDetail(assignmentId);
      // The tab says which exercise it is, not just «Ejercicio» (WCAG 2.4.2), unless the student left.
      if (!abortSignal.aborted) {
        this.titles.setScreenTitle(exerciseText(detail.exercise, this.locale).title);
      }
      return detail;
    },
  });

  /** Opening the exercise opens or creates its attempt (2.4); the store keeps it for every zone. */
  protected readonly opening = resource({
    params: () => ({ assignmentId: this.id(), number: this.attemptNumber() }),
    loader: ({ params: { assignmentId, number } }) => this.store.open(assignmentId, number),
  });

  /**
   * Once submitted, the next exercise of the block not submitted yet, for «Siguiente ejercicio»; null
   * without one, and the button goes back to the catalog (2.5c).
   */
  protected readonly nextPath = resource({
    params: () => {
      const userId = this.userId();
      return this.store.readonly() && userId ? { userId, assignmentId: this.id() } : undefined;
    },
    loader: async ({ params: { userId, assignmentId } }) => {
      const next = nextInBlock(await this.exercises.listAssigned(userId), assignmentId);
      return next ? APP_PATHS.student.exercise(next.assignmentId) : null;
    },
    defaultValue: null,
  });

  /** Where the exercise is: its subject, which leads to its tab of the catalog, and its block. */
  protected readonly place = computed(() => {
    if (!this.detail.hasValue()) return undefined;
    const { group, block } = this.detail.value();
    const subject = subjectName(group.subject, this.locale);
    const title = blockTitle(block, this.locale);
    return {
      subject: subject.name,
      subjectLang: subject.locale === this.locale ? null : subject.locale,
      block: title.title,
      blockLang: title.locale === this.locale ? null : title.locale,
      groupParams: { [STUDENT_PARAMS.group]: group.id },
    };
  });

  /** The attempts at the assignment, for the selector: only when there is more than one. */
  protected readonly attemptChoices = computed(() => {
    const current = this.store.attempt();
    const list = this.store.attemptList();
    if (!current || list.length < 2) return [];
    const latest = Math.max(...list.map((attempt) => attempt.number));
    return list.map((attempt) => ({
      number: attempt.number,
      status: attempt.id === current.id ? current.status : attempt.status,
      current: attempt.id === current.id,
      // The latest has no number in the URL: it is the one the exercise opens with
      queryParams: { [STUDENT_PARAMS.attempt]: attempt.number === latest ? null : attempt.number },
    }));
  });

  /** «Practicar de nuevo» opened the latest attempt: the number of an earlier one leaves the URL. */
  protected dropAttemptNumber(): void {
    if (this.attemptNumber() === undefined) return;
    void this.router.navigate([], {
      queryParams: { [STUDENT_PARAMS.attempt]: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  protected readonly error = computed(() => this.detail.error() ?? this.opening.error());
  /** The title in the language of the interface, or in the source one with its `lang` (D-045). */
  protected readonly heading = computed(() => {
    const exercise = this.exercise();
    if (!exercise) return undefined;
    const { title, locale } = exerciseText(exercise, this.locale);
    return { title, lang: locale === this.locale ? null : locale };
  });

  protected readonly exercise = computed(() =>
    this.detail.hasValue() ? this.detail.value().exercise : undefined,
  );

  /** Reloads only what failed. */
  protected retry(): void {
    if (this.detail.error()) this.detail.reload();
    if (this.opening.error()) this.opening.reload();
  }

  /**
   * A hidden tab saves the code and records the absence at once: it may never come back. Shown again
   * with the focus, the student is back: some browsers and phones fire no window focus on switching
   * tabs or apps.
   */
  protected onVisibilityChange(): void {
    if (this.document.visibilityState === 'hidden') {
      this.store.saveNow();
      this.signals.hidden();
      this.speaker.stop();
    } else if (this.document.hasFocus()) {
      this.signals.returned();
    }
  }

  /** The browser asks before leaving while there are changes the server does not have yet. */
  protected warnIfUnsaved(event: BeforeUnloadEvent): void {
    if (!this.store.hasUnsavedChanges()) return;
    this.store.saveNow();
    event.preventDefault();
  }
}
