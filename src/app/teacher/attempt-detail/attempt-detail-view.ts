import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject, input, linkedSignal, signal, untracked } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MatButtonToggle, MatButtonToggleGroup } from '@angular/material/button-toggle';
import { MatIcon } from '@angular/material/icon';
import { RouterLink } from '@angular/router';

import { APP_PATHS } from '../../core/app-paths';
import { LanguageService } from '../../core/i18n/language-service';
import { PageReloader } from '../../core/page-reloader';
import type { Attempt } from '../../data/attempt';
import type { LiveAttemptDetail } from '../../data/live-service';
import { blockTitle, exerciseText } from '../../data/localized-text';
import { CodeEditor } from '../../shared/code-editor/code-editor';
import { Skeleton } from '../../shared/skeleton/skeleton';
import { StatusChip } from '../../shared/status-chip/status-chip';
import { LiveReasonText } from '../live/live-reason';
import { LiveStore } from '../live/live-store';
import {
  attemptFigures,
  attemptTimeline,
  type TimelineCategory,
  timelineCategory,
} from './attempt-timeline';
import { AttemptTimelineList } from './attempt-timeline-list';
import { formatDuration } from './format-duration';

/** An attempt as the detail shows it: what was loaded joined with what arrived live since. */
export interface AttemptView extends LiveAttemptDetail {
  /** The attempts of the student at the same assignment, by number. */
  readonly attempts: readonly Attempt[];
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
 * An attempt that has loaded (ficha 07): whose it is, why they wait for the teacher if they do, its
 * figures, its timeline with filters and its code read only. `AttemptDetailPage` loads it.
 */
@Component({
  selector: 'app-attempt-detail-view',
  imports: [
    MatButton,
    MatButtonToggle,
    MatButtonToggleGroup,
    MatIcon,
    NgTemplateOutlet,
    RouterLink,
    AttemptTimelineList,
    CodeEditor,
    LiveReasonText,
    Skeleton,
    StatusChip,
  ],
  templateUrl: './attempt-detail-view.html',
  // From xl, the timeline and the code take what is left of the page
  host: { class: 'flex flex-col gap-5 xl:min-h-0 xl:flex-1' },
})
export class AttemptDetailView {
  private readonly store = inject(LiveStore);
  private readonly pageReloader = inject(PageReloader);
  private readonly locale = inject(LanguageService).locale;

  readonly view = input.required<AttemptView>();

  protected readonly FILTERS = FILTERS;
  protected readonly filter = signal<TimelineFilter>('all');
  protected readonly editorLabel = $localize`:@@detail.code.label:Código del alumno`;
  protected readonly timelineLabel = $localize`:@@detail.timeline.label:Línea temporal del intento`;

  /** «Suma de una lista · ejercicio 2 · Tema 1: Bucles», with what the panel knows. */
  protected readonly context = computed(() => {
    const { exercise, groupId, blockId } = this.view();
    const text = exerciseText(exercise.exercise, this.locale);
    const position = this.store
      .exercises()
      .findIndex((entry) => entry.assignmentId === exercise.assignmentId);
    const block = this.store
      .groups()
      .find((group) => group.id === groupId)
      ?.blocks.find((candidate) => candidate.id === blockId);
    return {
      exercise: text.title,
      exerciseLang: text.locale === this.locale ? null : text.locale,
      position: position >= 0 ? position + 1 : null,
      block: block ? blockTitle(block, this.locale).title : null,
    };
  });

  protected readonly timeline = computed(() => {
    const { attempt, events, interactions, exercise } = this.view();
    return attemptTimeline(attempt, events, interactions, exercise);
  });

  protected readonly filterCounts = computed(() => {
    const counts: Record<TimelineFilter, number> = { all: 0, tests: 0, tutor: 0, browser: 0 };
    for (const entry of this.timeline()) {
      counts.all++;
      const category = timelineCategory(entry);
      if (category !== 'other') counts[category]++;
    }
    return counts;
  });

  protected readonly shownEntries = computed(() => {
    const filter = this.filter();
    return filter === 'all'
      ? this.timeline()
      : this.timeline().filter((entry) => timelineCategory(entry) === filter);
  });

  protected readonly figures = computed(() => {
    const { attempt, events, interactions } = this.view();
    return attemptFigures(attempt, events, interactions, this.store.now());
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

  protected attemptPath(attempt: Attempt): string {
    return APP_PATHS.teacher.attempt(attempt.id);
  }

  protected duration(ms: number): string {
    return formatDuration(ms);
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
