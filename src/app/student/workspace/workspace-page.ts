import { BreakpointObserver } from '@angular/cdk/layout';
import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject, input, resource, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatAnchor, MatIconAnchor } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatTab, MatTabGroup } from '@angular/material/tabs';
import { MatTooltip } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import { map } from 'rxjs';

import { APP_PATHS } from '../../core/app-paths';
import { AppTitleStrategy } from '../../core/app-title-strategy';
import { ExerciseService } from '../../data/exercise-service';
import { DifficultyChip } from '../../shared/difficulty-chip/difficulty-chip';
import { formatCall, formatValue, isMultilineText } from '../../shared/format-value';
import { LoadError } from '../../shared/load-error/load-error';
import { Mascot } from '../../shared/mascot/mascot';
import { LoadingSkeleton } from '../../shared/skeleton/loading-skeleton';
import { Skeleton } from '../../shared/skeleton/skeleton';
import { splitInlineCode } from '../../shared/split-inline-code';
import { StatusChip } from '../../shared/status-chip/status-chip';
import { AttemptStore } from './attempt-store';

/**
 * Below this width (Tailwind's `md`) the zones become tabs, one at a time: stacked, they did not fit
 * in a phone screen without scrolling the whole page (ficha 03, 5.4).
 */
export const COMPACT_WORKSPACE_QUERY = '(max-width: 767.98px)';

/** Example rows drawn while the exercise loads. */
const SKELETON_EXAMPLES = [1, 2, 3];

/**
 * The workspace (/alumno/ejercicio/:id, ficha 03): the statement and its examples, the code and the
 * tutor of one exercise (RF-03 to RF-06). Step 1.3 builds the layout and opens the attempt; the
 * editor (1.4), the results (1.5) and the chat (1.7) fill their zones later.
 */
@Component({
  selector: 'app-workspace-page',
  imports: [
    NgTemplateOutlet,
    RouterLink,
    MatAnchor,
    MatIconAnchor,
    MatIcon,
    MatTab,
    MatTabGroup,
    MatTooltip,
    DifficultyChip,
    StatusChip,
    LoadError,
    LoadingSkeleton,
    Skeleton,
    Mascot,
  ],
  templateUrl: './workspace-page.html',
  host: {
    // The screen takes the height left under the app bar and the padding of <main>, so each zone
    // scrolls inside it instead of the whole page (5.4). The bar is 56px on phones, 64px from 600px.
    class:
      'flex h-[calc(100dvh-var(--mat-toolbar-mobile-height,56px)-3rem)] min-h-96 flex-col gap-4 min-[600px]:h-[calc(100dvh-var(--mat-toolbar-standard-height,64px)-3rem)]',
  },
})
export class WorkspacePage {
  /** Exercise id, from the `:id` of the route (withComponentInputBinding). */
  readonly id = input.required<string>();

  private readonly exercises = inject(ExerciseService);
  private readonly titles = inject(AppTitleStrategy);
  protected readonly store = inject(AttemptStore);

  protected readonly catalogPath = APP_PATHS.student.catalog;
  protected readonly skeletonExamples = SKELETON_EXAMPLES;
  protected readonly splitInlineCode = splitInlineCode;

  /** Phones: tabs instead of columns. BreakpointObserver is already an Observable (4.8). */
  protected readonly compact = toSignal(
    inject(BreakpointObserver)
      .observe(COMPACT_WORKSPACE_QUERY)
      .pipe(map((state) => state.matches)),
    { requireSync: true },
  );

  protected readonly detail = resource({
    params: () => this.id(),
    loader: async ({ params: exerciseId, abortSignal }) => {
      const detail = await this.exercises.getDetail(exerciseId);
      // The tab says which exercise it is, not just «Ejercicio» (WCAG 2.4.2), unless the student left.
      if (!abortSignal.aborted) {
        this.titles.setScreenTitle(detail.exercise.title);
      }
      return detail;
    },
  });

  /** Opening the exercise opens or creates its attempt (2.4); the store keeps it for every zone. */
  protected readonly opening = resource({
    params: () => this.id(),
    loader: ({ params: exerciseId }) => this.store.open(exerciseId),
  });

  protected readonly error = computed(() => this.detail.error() ?? this.opening.error());

  /**
   * What the statement zone shows: the exercise, its visible tests as the calls the student would
   * write with the value each must return, and how many hidden checks it has (2.5).
   */
  protected readonly content = computed(() => {
    if (!this.detail.hasValue()) return undefined;
    const { exercise, visibleTests, hiddenTestCount } = this.detail.value();
    const examples = visibleTests.map((test) => {
      const multiline = isMultilineText(test.expectedOutput);
      return {
        key: test.id,
        call: formatCall(exercise.functionName, test.input),
        expected: multiline ? test.expectedOutput : formatValue(test.expectedOutput),
        multiline,
      };
    });
    return { exercise, examples, hiddenTestCount };
  });

  /** The statement folds away on wide screens, so the code gets its room. */
  protected readonly statementOpen = signal(true);

  protected toggleStatement(): void {
    this.statementOpen.update((open) => !open);
  }

  /** Reloads only what failed. */
  protected retry(): void {
    if (this.detail.error()) this.detail.reload();
    if (this.opening.error()) this.opening.reload();
  }
}
