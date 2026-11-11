import { BreakpointObserver } from '@angular/cdk/layout';
import {
  afterNextRender,
  Component,
  computed,
  DOCUMENT,
  ElementRef,
  inject,
  Injector,
  input,
  linkedSignal,
  resource,
  signal,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatAnchor, MatButton, MatIconAnchor } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatMenu, MatMenuItem, MatMenuTrigger } from '@angular/material/menu';
import { MatTab, MatTabGroup, MatTabLabel } from '@angular/material/tabs';
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
import { Mascot, type MascotMood } from '../../shared/mascot/mascot';
import type { Reaction } from '../../shared/reactions/reaction';
import { ReactionOverlay } from '../../shared/reactions/reaction-overlay';
import { LoadingSkeleton } from '../../shared/skeleton/loading-skeleton';
import { Skeleton } from '../../shared/skeleton/skeleton';
import { Splitter } from '../../shared/splitter/splitter';
import { StatusChip } from '../../shared/status-chip/status-chip';
import { nextInBlock } from '../catalog/catalog-blocks';
import { SettingsStore } from '../settings/settings-store';
import { AttemptStore } from './attempt-store';
import { BrowserSignals } from './browser-signals';
import { CODE_ZONE_ID, CodeZone } from './code-zone/code-zone';
import {
  CODE_SHARE,
  readPaneShare,
  readTutorFloating,
  savePaneShare,
  saveTutorFloating,
  STATEMENT_SHARE,
} from './pane-share';
import { STATEMENT_ZONE_ID, StatementZone } from './statement-zone/statement-zone';
import { TutorPanel } from './tutor/tutor-panel';
import { TutorStore } from './tutor-store';

/**
 * Below this width (Tailwind's `md`) the zones become tabs, one at a time: stacked, they did not fit
 * in a phone screen without scrolling the whole page (ficha 03, 5.4).
 */
export const COMPACT_WORKSPACE_QUERY = '(max-width: 767.98px)';

/**
 * Tablets (below Tailwind's `lg`): the tutor column would narrow the code too much, so the tutor
 * folds into the floating mascot, as it does with the code expanded (D-033).
 */
const NARROW_WORKSPACE_QUERY = '(max-width: 1023.98px)';

/** Narrowest the tutor column gets, whatever the share: below it, the hints read badly (D-030). */
const TUTOR_MIN_WIDTH = '16rem';

/** Position of the tutor among the tabs of a phone. */
const TUTOR_TAB = 2;

/**
 * The workspace (/alumno/ejercicio/:id, ficha 03): the statement and its examples, the code and the
 * tutor of one exercise of a block (RF-03 to RF-06), each in a zone of its own. The page loads the
 * exercise of the assignment, opens its latest attempt or the one of `?intento=` (2.5c), lays the
 * zones out (columns with splitters on wide screens, tabs on phones) and listens to the window to
 * keep the code and record absences (2.8).
 */
@Component({
  selector: 'app-workspace-page',
  imports: [
    ReactionOverlay,
    RouterLink,
    MatAnchor,
    MatButton,
    MatIconAnchor,
    MatIcon,
    MatMenu,
    MatMenuItem,
    MatMenuTrigger,
    MatTab,
    MatTabGroup,
    MatTabLabel,
    MatTooltip,
    DifficultyChip,
    StatusChip,
    LoadError,
    LoadingSkeleton,
    Skeleton,
    Splitter,
    Mascot,
    StatementZone,
    CodeZone,
    TutorPanel,
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
  private readonly tutor = inject(TutorStore);
  private readonly settings = inject(SettingsStore);
  protected readonly reactionMode = this.settings.reactions;
  protected readonly reactionEmojis = this.settings.reactionEmojis;
  /**
   * The latest reaction floats over the screen (1.8): the emotion of each new answer of the tutor,
   * or the celebration of a run. Whichever changed last wins, so each one plays once.
   */
  protected readonly reaction = linkedSignal<
    readonly [Reaction | null, Reaction | null],
    Reaction | null
  >({
    source: () => [this.tutor.reaction(), this.store.runReaction()] as const,
    computation: ([answer, run], previous) =>
      previous && run !== previous.source[1] ? run : (answer ?? run),
    equal: (a, b) => a?.id === b?.id,
  });
  protected readonly upcomingReaction = this.tutor.upcomingReaction;
  /** Turned off, the folded mascot does not move with the answers either. */
  protected readonly mascotReaction = computed(() =>
    this.reactionMode() === 'off' ? null : this.reaction(),
  );
  /** Pastes and absences, recorded for the attempt open for changes (2.8). */
  protected readonly signals = inject(BrowserSignals);

  protected readonly catalogPath = APP_PATHS.student.catalog;
  protected readonly statementZoneId = STATEMENT_ZONE_ID;
  protected readonly codeZoneId = CODE_ZONE_ID;

  /** Phones: tabs instead of columns. BreakpointObserver is already an Observable (4.8). */
  protected readonly compact = toSignal(
    inject(BreakpointObserver)
      .observe(COMPACT_WORKSPACE_QUERY)
      .pipe(map((state) => state.matches)),
    { requireSync: true },
  );

  /** Tablets: the tutor floats instead of taking a column. */
  protected readonly narrow = toSignal(
    inject(BreakpointObserver)
      .observe(NARROW_WORKSPACE_QUERY)
      .pipe(map((state) => state.matches)),
    { requireSync: true },
  );

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

  /** The statement folds away on wide screens, so the code gets its room. */
  protected readonly statementOpen = signal(true);
  /** Wide screens: the code takes the statement's room; not remembered, as the screen opens whole. */
  protected readonly codeExpanded = signal(false);

  /** Share of the left column the open statement takes, which its splitter changes. */
  protected readonly statementShare = signal(readPaneShare(STATEMENT_SHARE, this.userId()));
  /** Share of the width the code takes beside the tutor, which their splitter changes. */
  protected readonly codeShare = signal(readPaneShare(CODE_SHARE, this.userId()));
  protected readonly statementShareLimits = STATEMENT_SHARE;
  protected readonly codeShareLimits = CODE_SHARE;
  protected readonly tutorWidth = computed(
    () => `max(${TUTOR_MIN_WIDTH}, ${100 - this.codeShare()}%)`,
  );

  protected keepStatementShare(share: number): void {
    savePaneShare(STATEMENT_SHARE, this.userId(), share);
  }

  protected keepCodeShare(share: number): void {
    savePaneShare(CODE_SHARE, this.userId(), share);
  }

  /**
   * The tutor folds into the floating mascot, which opens it over the corner of the code, when the
   * student chooses it, with the code expanded and on tablets, where its column would narrow the
   * code too much (D-033). Phones keep their tab.
   */
  protected readonly floatingTutor = computed(
    () => !this.compact() && (this.codeExpanded() || this.narrow() || this.preferFloating()),
  );
  /** The student chose the floating tutor on a wide screen; remembered in this browser. */
  private readonly preferFloating = signal(readTutorFloating(this.userId()));
  protected readonly tutorOpen = signal(false);
  protected readonly openTutorLabel = $localize`:@@workspace.openTutor:Abrir el tutor`;
  protected readonly closeTutorLabel = $localize`:@@workspace.closeTutor:Cerrar el tutor`;
  private readonly tutorToggle = viewChild<ElementRef<HTMLElement>>('tutorToggle');
  /** The open floating tutor; the column one is not there while the tutor floats. */
  private readonly floatingPanel = viewChild<TutorPanel>('floatingPanel');
  private readonly injector = inject(Injector);

  /**
   * Open, it sticks its tongue out, and pulls it back on closing (1.1b); it tilts its head while the
   * tutor thinks.
   */
  protected readonly floatingMascotMood = computed<MascotMood>(() => {
    if (this.tutorOpen()) return 'chat';
    return this.tutor.answering() ? 'thinking' : 'idle';
  });

  /** The first words of the last answer, shown beside the folded mascot. */
  protected readonly latestAnswer = this.tutor.announcement;

  /**
   * A dot (and, folded, a bubble) when an answer arrives while the tutor is out of sight: another
   * tab on a phone, or the folded mascot. The student may look at the code while the tutor writes.
   */
  private readonly selectedTab = signal(0);
  private readonly seenAnswers = signal(0);
  private readonly tutorVisible = computed(() => {
    if (this.compact()) return this.selectedTab() === TUTOR_TAB;
    return !this.floatingTutor() || this.tutorOpen();
  });
  protected readonly tutorUnread = computed(
    () => !this.tutorVisible() && this.tutor.answerCount() > this.seenAnswers(),
  );

  protected markAnswersSeen(): void {
    this.seenAnswers.set(this.tutor.answerCount());
  }

  protected selectTab(index: number): void {
    if (index === TUTOR_TAB || this.selectedTab() === TUTOR_TAB) {
      this.markAnswersSeen();
    }
    this.selectedTab.set(index);
  }

  /** Opens the folded tutor with the focus on the question, ready to write, or folds it again. */
  protected toggleTutor(): void {
    this.markAnswersSeen();
    this.tutorOpen.update((open) => !open);
    if (this.tutorOpen()) this.focusQuestion();
  }

  /**
   * Floats the tutor, open so the conversation does not vanish, or fixes it in its column again,
   * which also brings the statement back. Floating, the focus goes to the question, as the button
   * that had it is gone; fixed, the column is where it was.
   */
  protected toggleDock(): void {
    const floating = !this.floatingTutor();
    this.markAnswersSeen();
    this.preferFloating.set(floating);
    saveTutorFloating(this.userId(), floating);
    if (floating) {
      this.tutorOpen.set(true);
      this.focusQuestion();
    } else {
      this.codeExpanded.set(false);
      this.tutorOpen.set(false);
    }
  }

  private focusQuestion(): void {
    afterNextRender(() => this.floatingPanel()?.focusQuestion(), { injector: this.injector });
  }

  /** Esc or «Minimizar» fold the tutor and give the focus back to the mascot that opened it. */
  protected closeTutor(): void {
    this.toggleTutor();
    afterNextRender(() => this.tutorToggle()?.nativeElement.focus(), { injector: this.injector });
  }

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
