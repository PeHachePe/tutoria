import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject, linkedSignal, resource } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatAnchor } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatProgressBar } from '@angular/material/progress-bar';
import { MatTabLink, MatTabNav, MatTabNavPanel } from '@angular/material/tabs';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';

import { AuthStore } from '../../auth/auth-store';
import { APP_PATHS, STUDENT_PARAMS } from '../../core/app-paths';
import { LanguageService } from '../../core/i18n/language-service';
import type { AttemptStatus } from '../../data/attempt';
import type { AssignedGroup, ClassBlock, Exercise } from '../../data/exercise';
import { ExerciseService } from '../../data/exercise-service';
import { blockTitle, exerciseText, subjectName } from '../../data/localized-text';
import { DifficultyChip } from '../../shared/difficulty-chip/difficulty-chip';
import { EmptyState } from '../../shared/empty-state/empty-state';
import { LoadError } from '../../shared/load-error/load-error';
import { Mascot } from '../../shared/mascot/mascot';
import { LoadingSkeleton } from '../../shared/skeleton/loading-skeleton';
import { Skeleton } from '../../shared/skeleton/skeleton';
import { StatusChip } from '../../shared/status-chip/status-chip';
import { catalogAction } from './catalog-action';
import {
  countByStatus,
  currentAttempt,
  groupByBlock,
  groupByGroup,
  isPassed,
  nextExercise,
} from './catalog-blocks';

/** Colour tokens of the marker in front of each exercise and of the dots of each block. */
const STATUS_TONES: Record<AttemptStatus, { readonly marker: string; readonly dot: string }> = {
  not_started: {
    marker: 'border-2 border-outline-variant text-on-surface-variant',
    dot: 'border border-outline',
  },
  in_progress: { marker: 'bg-info-container text-on-info-container', dot: 'bg-info' },
  tests_failed: { marker: 'bg-warning-container text-on-warning-container', dot: 'bg-warning' },
  passed: {
    marker: 'bg-success-container text-on-success-container',
    dot: 'bg-success-container border border-success',
  },
  submitted: { marker: 'bg-success text-on-success', dot: 'bg-success' },
};

/** Cards drawn while the catalog loads: about one block's worth. */
const SKELETON_CARDS = [1, 2, 3];

/** A text in the language of the interface, with `lang` when it fell back to its source one. */
interface ShownText {
  readonly text: string;
  readonly lang: string | null;
}

/**
 * The student's home (/alumno, ficha 02): the exercises assigned to their groups, a tab per group
 * with the name of its subject when there is more than one (2.5c), by block, with their difficulty,
 * status and progress (RF-02). No store: it only reads, so it keeps its state (4.5).
 */
@Component({
  selector: 'app-catalog-page',
  imports: [
    NgTemplateOutlet,
    RouterLink,
    MatAnchor,
    MatIcon,
    MatProgressBar,
    MatTabNav,
    MatTabLink,
    MatTabNavPanel,
    DifficultyChip,
    StatusChip,
    EmptyState,
    LoadError,
    LoadingSkeleton,
    Skeleton,
    Mascot,
  ],
  templateUrl: './catalog-page.html',
})
export class CatalogPage {
  private readonly exercises = inject(ExerciseService);
  private readonly auth = inject(AuthStore);
  private readonly locale = inject(LanguageService).locale;

  protected readonly skeletonCards = SKELETON_CARDS;

  protected readonly entries = resource({
    params: () => this.auth.userId(), // string | undefined; undefined → idle
    loader: ({ params: userId }) => this.exercises.listAssigned(userId),
    defaultValue: [],
  });

  /** The group of the tab in the URL (`?grupo=`), so a reload or «Atrás» keeps it. */
  private readonly groupParam = toSignal(
    inject(ActivatedRoute).queryParamMap.pipe(map((params) => params.get(STUDENT_PARAMS.group))),
    { initialValue: null },
  );

  private readonly groups = computed(() => groupByGroup(this.entries.value()));

  /** The tabs, only with more than one group: the name of its subject, and the group if repeated. */
  protected readonly tabs = computed(() => {
    const groups = this.groups();
    if (groups.length < 2) return [];
    const names = groups.map(({ group }) => this.subjectOf(group));
    return groups.map(({ group }, index) => {
      const repeated = names.filter((name) => name.text === names[index].text).length > 1;
      return {
        id: group.id,
        label: repeated ? `${names[index].text} · ${group.name}` : names[index].text,
        lang: names[index].lang,
        active: group.id === this.selectedId(),
        queryParams: { [STUDENT_PARAMS.group]: group.id },
      };
    });
  });

  /** The group shown: the one in the URL or, without it (or unknown), the first. */
  private readonly selectedId = computed(() => {
    const ids = this.groups().map(({ group }) => group.id);
    const asked = this.groupParam();
    return asked && ids.includes(asked) ? asked : ids[0];
  });

  private readonly shown = computed(() =>
    this.entries.value().filter((entry) => entry.group.id === this.selectedId()),
  );

  /** Blocks of the group shown, with their cards, ready for the template. */
  protected readonly blocks = computed(() =>
    groupByBlock(this.shown()).map(({ block, entries, passed, complete }) => ({
      id: block.id,
      title: this.titleOf(block),
      passed,
      complete,
      total: entries.length,
      dots: entries.map(({ assignmentId, status }) => ({
        key: assignmentId,
        classes: STATUS_TONES[status].dot,
      })),
      cards: entries.map((entry, index) => ({
        key: entry.assignmentId,
        number: index + 1,
        marker: STATUS_TONES[entry.status].marker,
        done: isPassed(entry.status),
        ready: entry.status === 'passed',
        ...this.texts(entry.exercise),
        difficulty: entry.exercise.difficulty,
        status: entry.status,
        hintCount: entry.hintCount,
        hintLevel: entry.hintLevel,
        repetitions: entry.repetitions,
        action: catalogAction(currentAttempt(entry).status),
        path: APP_PATHS.student.exercise(entry.assignmentId),
      })),
    })),
  );

  /** Blocks folded away: at first, the complete ones of every group; then whatever the student toggles. */
  protected readonly folded = linkedSignal<ReadonlySet<string>>(
    () =>
      new Set(
        groupByBlock(this.entries.value())
          .filter((block) => block.complete)
          .map(({ block }) => block.id),
      ),
  );

  protected readonly total = computed(() => this.entries.value().length);
  /** What the summary counts: the group of the tab. */
  protected readonly shownTotal = computed(() => this.shown().length);
  protected readonly passed = computed(
    () => this.shown().filter((entry) => isPassed(entry.status)).length,
  );
  /** Exercises by status, for the counters of the summary. */
  protected readonly counts = computed(() => countByStatus(this.shown()));

  /** First name for the greeting: the seed and the admin store the full name. */
  protected readonly firstName = computed(() => this.auth.user()?.name.split(' ')[0] ?? '');

  /**
   * The card «Continúa donde lo dejaste» or «Tu siguiente ejercicio», among all the groups, with the
   * subject when there are several; null once all is submitted.
   */
  protected readonly next = computed(() => {
    const next = nextExercise(this.entries.value());
    if (!next) return null;
    const { entry, kind } = next;
    const status = currentAttempt(entry).status;
    return {
      kind,
      ...this.texts(entry.exercise),
      subject: this.groups().length > 1 ? this.subjectOf(entry.group) : null,
      block: this.titleOf(entry.block),
      status,
      repetitions: entry.repetitions,
      action: catalogAction(status),
      path: APP_PATHS.student.exercise(entry.assignmentId),
    };
  });

  /**
   * Title and topics in the language of the interface, or in the source one without a translation:
   * `lang` then tells it to the screen reader (WCAG 3.1.2, D-045).
   */
  private texts(exercise: Exercise): { title: string; topics: string; lang: string | null } {
    const text = exerciseText(exercise, this.locale);
    return {
      title: text.title,
      topics: text.topics.join(' · '),
      lang: this.langOf(text.locale),
    };
  }

  private titleOf(block: ClassBlock): ShownText {
    const { title, locale } = blockTitle(block, this.locale);
    return { text: title, lang: this.langOf(locale) };
  }

  private subjectOf(group: AssignedGroup): ShownText {
    const { name, locale } = subjectName(group.subject, this.locale);
    return { text: name, lang: this.langOf(locale) };
  }

  private langOf(locale: string): string | null {
    return locale === this.locale ? null : locale;
  }

  protected toggle(blockId: string): void {
    this.folded.update((folded) => {
      const next = new Set(folded);
      if (!next.delete(blockId)) {
        next.add(blockId);
      }
      return next;
    });
  }

  /** Value of the progress bar, from 0 to 100; the bar only shows when there are exercises. */
  protected readonly percent = computed(() => (this.passed() / this.shownTotal()) * 100);
}
