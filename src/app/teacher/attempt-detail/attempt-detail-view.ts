import { NgTemplateOutlet } from '@angular/common';
import {
  afterNextRender,
  Component,
  computed,
  inject,
  Injector,
  input,
  linkedSignal,
  untracked,
  viewChild,
} from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MatButtonToggle, MatButtonToggleGroup } from '@angular/material/button-toggle';
import { MatIcon } from '@angular/material/icon';
import { RouterLink } from '@angular/router';

import { APP_PATHS } from '../../core/app-paths';
import { LanguageService } from '../../core/i18n/language-service';
import { PageReloader } from '../../core/page-reloader';
import type { Attempt } from '../../data/attempt';
import type { AttemptRef, LiveAttemptDetail } from '../../data/live-service';
import { blockTitle, exerciseText } from '../../data/localized-text';
import { CodeEditor } from '../../shared/code-editor/code-editor';
import { Skeleton } from '../../shared/skeleton/skeleton';
import { StatusChip } from '../../shared/status-chip/status-chip';
import { LiveReasonText } from '../live/live-reason';
import { exercisePosition } from '../live/live-state';
import { LiveStore } from '../live/live-store';
import type { WorkState } from '../live/live-work';
import { AttemptEvolution } from './attempt-evolution';
import { attemptNow } from './attempt-now';
import { AttemptNowCard } from './attempt-now-card';
import { attemptRuns } from './attempt-runs';
import { attemptSummary } from './attempt-summary';
import {
  attemptTimeline,
  entryIdOf,
  type TimelineCategory,
  timelineCategory,
} from './attempt-timeline';
import { AttemptTimelineList } from './attempt-timeline-list';
import { GUIDE_ANCHORS, GuideAnchor } from '../../core/guide/guide-anchor';

/** An attempt as the detail shows it: what was loaded joined with what arrived live since. */
export interface AttemptView extends LiveAttemptDetail {
  /** The attempts of the student at the same assignment, by number. */
  readonly attempts: readonly AttemptRef[];
  /** When it was loaded: what happens later arrived live. */
  readonly loadedAt: number;
}

/** The filters of the timeline: every entry, or those of one category. */
export type TimelineFilter = 'all' | Exclude<TimelineCategory, 'other'>;

const FILTERS: readonly { readonly value: TimelineFilter; readonly label: string }[] = [
  { value: 'all', label: $localize`:@@detail.filter.all:Todo` },
  { value: 'tests', label: $localize`:@@detail.filter.tests:Pruebas` },
  { value: 'tutor', label: $localize`:@@detail.filter.tutor:Tutor` },
  { value: 'browser', label: $localize`:@@detail.filter.browser:Pegados y salidas` },
];

/** The code the teacher reads: the submitted one once frozen, the one in the editor until then. */
function codeOf(attempt: Attempt): string {
  return attempt.finalCode ?? attempt.currentCode;
}

/**
 * An attempt that has loaded (ficha 07): whose it is, why they wait for the teacher if they do,
 * where it stands («Ahora»), its evolution, its timeline with filters and its code read only.
 * `AttemptDetailPage` loads it.
 */
@Component({
  selector: 'app-attempt-detail-view',
  imports: [
    GuideAnchor,
    MatButton,
    MatButtonToggle,
    MatButtonToggleGroup,
    MatIcon,
    NgTemplateOutlet,
    RouterLink,
    AttemptEvolution,
    AttemptNowCard,
    AttemptTimelineList,
    CodeEditor,
    LiveReasonText,
    Skeleton,
    StatusChip,
  ],
  templateUrl: './attempt-detail-view.html',
  host: { class: 'flex flex-col gap-5' },
})
export class AttemptDetailView {
  protected readonly anchors = GUIDE_ANCHORS;
  private readonly store = inject(LiveStore);
  private readonly pageReloader = inject(PageReloader);
  private readonly locale = inject(LanguageService).locale;
  private readonly injector = inject(Injector);
  private readonly list = viewChild(AttemptTimelineList);

  readonly view = input.required<AttemptView>();

  /** The clock of the panel, which ticks: how long ago the latest help was. */
  protected readonly clock = this.store.now;
  protected readonly editorLabel = $localize`:@@detail.code.label:Código del alumno`;
  protected readonly timelineLabel = $localize`:@@detail.timeline.label:Línea temporal del intento`;

  /** «Suma de una lista · ejercicio 2 · Tema 1: Bucles», with what the panel knows. */
  protected readonly context = computed(() => {
    const { exercise, groupId, blockId } = this.view();
    const text = exerciseText(exercise.exercise, this.locale);
    const position = exercisePosition(this.store.exercises(), exercise.assignmentId);
    const block = this.store
      .groups()
      .find((group) => group.id === groupId)
      ?.blocks.find((candidate) => candidate.id === blockId);
    return {
      exercise: text.title,
      exerciseLang: text.locale === this.locale ? null : text.locale,
      position,
      block: block ? blockTitle(block, this.locale).title : null,
    };
  });

  protected readonly timeline = computed(() => {
    const { attempt, events, interactions, exercise } = this.view();
    return attemptTimeline(attempt, events, interactions, exercise);
  });

  /**
   * Whether the student works on this attempt now, as the row of the panel says: absent when the
   * row is on another attempt, the panel is loading or the student is no longer in the group.
   */
  protected readonly work = computed<WorkState>(() => {
    const { student, attempt } = this.view();
    const row = this.store.rows().find((candidate) => candidate.student.id === student.id);
    return row?.attempt?.id === attempt.id ? row.work : 'absent';
  });

  protected readonly now = computed(() => {
    const { attempt, events, exercise } = this.view();
    return attemptNow(attempt, events, this.timeline(), exercise, this.work());
  });

  /** «En directo»: the student works on it now, and it is not submitted yet. */
  protected readonly isLive = computed(
    () => this.now().mode === 'now' && this.work() === 'working',
  );

  protected readonly summary = computed(() => {
    const { attempt, events, interactions } = this.view();
    return attemptSummary(attempt, events, interactions, this.now().mode, this.store.now());
  });

  protected readonly runs = computed(() => attemptRuns(this.view().events));

  /** «Todo» and the categories with some entry, each with the entries it shows. */
  protected readonly filters = computed(() => {
    const counts: Record<TimelineFilter, number> = { all: 0, tests: 0, tutor: 0, browser: 0 };
    for (const entry of this.timeline()) {
      counts.all++;
      const category = timelineCategory(entry);
      if (category !== 'other') counts[category]++;
    }
    return FILTERS.filter((option) => option.value === 'all' || counts[option.value] > 0).map(
      (option) => ({ ...option, count: counts[option.value] }),
    );
  });

  /** Without an entry of tests, tutor or browser, there is nothing to filter. */
  protected readonly showFilters = computed(() => this.filters().length > 1);

  /** The filter chosen; back to «Todo» if its category runs out of entries. */
  protected readonly filter = linkedSignal<
    readonly { readonly value: TimelineFilter }[],
    TimelineFilter
  >({
    source: this.filters,
    computation: (filters, previous) =>
      previous && filters.some((option) => option.value === previous.value)
        ? previous.value
        : 'all',
  });

  protected readonly shownEntries = computed(() => {
    const filter = this.filter();
    return filter === 'all'
      ? this.timeline()
      : this.timeline().filter((entry) => timelineCategory(entry) === filter);
  });

  /** The student waits for the teacher with this attempt: the reason, with «Atendido». */
  protected readonly queued = computed(() => this.store.queuedFor(this.view().attempt.id));

  private readonly attemptId = computed(() => this.view().attempt.id);

  /** The code the editor shows: the one of the attempt when it opened, until the teacher asks for the latest. */
  private readonly shownCodeState = linkedSignal({
    // A computed, so the code only resets when the attempt changes, not with each live change
    source: this.attemptId,
    computation: () => untracked(() => codeOf(this.view().attempt)),
  });
  protected readonly shownCode = this.shownCodeState.asReadonly();

  /** The student changed the code since the editor was created. */
  protected readonly codeChanged = computed(() => codeOf(this.view().attempt) !== this.shownCode());

  /** Grows with each code the editor shows: the template creates a new editor for each one. */
  protected readonly editorGeneration = linkedSignal<string, number>({
    source: this.shownCode,
    computation: (_, previous) => (previous?.value ?? 0) + 1,
  });

  protected showLatestCode(): void {
    this.shownCodeState.set(codeOf(this.view().attempt));
  }

  protected attemptPath(attempt: AttemptRef): string {
    return APP_PATHS.teacher.attempt(attempt.id);
  }

  /**
   * Goes to the entry of the timeline that tells an event or an interaction: back to «Todo» if the
   * filter hides it and, once painted, the list takes it into view with the focus.
   */
  protected goToEntry(id: string): void {
    const entryId = entryIdOf(this.timeline(), id);
    if (entryId === null) return;
    if (!this.shownEntries().some((entry) => entry.id === entryId)) {
      this.filter.set('all');
    }
    afterNextRender(() => this.list()?.reveal(entryId), { injector: this.injector });
  }

  protected attend(studentId: string): void {
    this.store.attend(studentId);
  }

  protected attendedLabel(name: string): string {
    return $localize`:@@live.queue.attendLabel:Marcar como atendido: ${name}:name:`;
  }

  protected selectFilter(filter: TimelineFilter): void {
    this.filter.set(filter);
  }

  protected reloadPage(): void {
    this.pageReloader.reload();
  }
}
