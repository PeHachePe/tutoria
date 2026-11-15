import { BreakpointObserver } from '@angular/cdk/layout';
import {
  afterNextRender,
  Component,
  computed,
  ElementRef,
  inject,
  Injector,
  input,
  linkedSignal,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatTab, MatTabGroup, MatTabLabel } from '@angular/material/tabs';
import { MatTooltip } from '@angular/material/tooltip';
import { map } from 'rxjs';

import { AuthStore } from '../../auth/auth-store';
import { appTool, declareAppTool } from '../../core/tools/app-tool';
import type { Exercise } from '../../data/exercise';
import type { ContentLocale } from '../../data/localized-text';
import { TUTOR_TOOL } from '../../data/tutor/tutor-tools';
import type { LineMark } from '../../shared/code-editor/line-mark';
import { Mascot, type MascotMood } from '../../shared/mascot/mascot';
import type { Reaction } from '../../shared/reactions/reaction';
import { ReactionOverlay } from '../../shared/reactions/reaction-overlay';
import { Splitter } from '../../shared/splitter/splitter';
import { SettingsStore } from '../settings/settings-store';
import { AttemptStore } from './attempt-store';
import { CODE_ZONE_ID, CodeZone } from './code-zone/code-zone';
import {
  CODE_SHARE,
  readPaneShare,
  readTutorFloating,
  savePaneShare,
  saveTutorFloating,
  STATEMENT_SHARE,
} from './pane-share';
import {
  type StatementContent,
  STATEMENT_ZONE_ID,
  StatementZone,
} from './statement-zone/statement-zone';
import { TutorPanel } from './tutor/tutor-panel';
import { type Pointer, TutorStore } from './tutor-store';

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

/** The tabs of a phone, in order, by the names of `setLayout` (2.5e). */
const TABS = ['exercise', 'code', 'tutor'] as const;

/** Position of the tutor among the tabs of a phone. */
const TUTOR_TAB = TABS.indexOf('tutor');

/**
 * The zones of the workspace laid out (ficha 03): columns with splitters on wide screens, the tutor
 * in its column or folded into the floating mascot, tabs on phones, and the tutor's reactions over
 * everything. Shared by the student's workspace and a teacher's try of an exercise (4.3e), each of
 * which provides the stores the zones read.
 */
@Component({
  selector: 'app-workspace-layout',
  imports: [
    ReactionOverlay,
    MatTab,
    MatTabGroup,
    MatTabLabel,
    MatTooltip,
    Splitter,
    Mascot,
    StatementZone,
    CodeZone,
    TutorPanel,
  ],
  templateUrl: './workspace-layout.html',
  host: { class: 'flex min-h-0 flex-1 flex-col' },
})
export class WorkspaceLayout {
  /** What the statement shows, once it is there. */
  readonly detail = input<StatementContent>();
  /** The language to read it in; by default, that of the interface (a teacher's try, 4.3e). */
  readonly contentLocale = input<ContentLocale>();
  readonly loading = input(false);
  /** The exercise, once it is there, for the editor. */
  readonly exercise = input<Exercise>();
  /** Where «Siguiente ejercicio» goes once submitted, or null for the button of the catalog. */
  readonly nextPath = input<string | null>(null);
  /**
   * A teacher's try (4.3e): nothing is saved, so no save indicator, and no link out to the catalog
   * or the next exercise.
   */
  readonly preview = input(false);
  /** «Practicar de nuevo» opened a new attempt. */
  readonly practised = output<void>();

  private readonly userId = inject(AuthStore).userId;
  private readonly store = inject(AttemptStore);
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

  /** The layout is the page's own: our tutor and the agents of the browser change it (2.5e). */
  protected readonly layoutTool = declareAppTool(
    appTool(TUTOR_TOOL.setLayout, (layout) => this.setLayout(layout)),
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
  /**
   * On a phone, what the tutor marks or points at is shown: the code tab for its marks and the
   * failing test, the exercise for an example or the hidden checks (2.5e).
   */
  protected readonly selectedTab = linkedSignal<
    { readonly pointer: Pointer | null; readonly marks: readonly LineMark[] },
    number
  >({
    source: () => ({ pointer: this.tutor.pointer(), marks: this.tutor.marks() }),
    computation: ({ pointer, marks }, previous) => {
      if (pointer && pointer !== previous?.source.pointer) {
        return TABS.indexOf(pointer.target === 'failingTest' ? 'code' : 'exercise');
      }
      if (marks.length > 0 && marks !== previous?.source.marks) return TABS.indexOf('code');
      return previous?.value ?? 0;
    },
  });
  /** Where the tutor points, for the statement. */
  protected readonly pointer = this.tutor.pointer;
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

  /**
   * The layout as `setLayout` asks for it (2.5e): the code expanded or not, the tutor docked or
   * floating, the tab of a phone. Only what it names changes.
   */
  private setLayout({
    codeExpanded,
    tutor,
    tab,
  }: {
    readonly codeExpanded?: boolean;
    readonly tutor?: 'docked' | 'floating';
    readonly tab?: (typeof TABS)[number];
  }): object {
    if (tutor !== undefined && (tutor === 'floating') !== this.floatingTutor()) this.toggleDock();
    if (codeExpanded !== undefined) this.codeExpanded.set(codeExpanded);
    if (tab !== undefined) this.selectTab(TABS.indexOf(tab));
    return {
      codeExpanded: this.codeExpanded(),
      tutor: this.floatingTutor() ? 'floating' : 'docked',
      tab: TABS[this.selectedTab()],
    };
  }

  private focusQuestion(): void {
    afterNextRender(() => this.floatingPanel()?.focusQuestion(), { injector: this.injector });
  }

  /** Esc or «Minimizar» fold the tutor and give the focus back to the mascot that opened it. */
  protected closeTutor(): void {
    this.toggleTutor();
    afterNextRender(() => this.tutorToggle()?.nativeElement.focus(), { injector: this.injector });
  }
}
