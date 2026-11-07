import { Component, computed, inject, linkedSignal, resource } from '@angular/core';
import { MatAnchor } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatProgressBar } from '@angular/material/progress-bar';
import { RouterLink } from '@angular/router';

import { AuthStore } from '../../auth/auth-store';
import { APP_PATHS } from '../../core/app-paths';
import { ExerciseService } from '../../data/exercise-service';
import { DifficultyChip } from '../../shared/difficulty-chip/difficulty-chip';
import { EmptyState } from '../../shared/empty-state/empty-state';
import { LoadError } from '../../shared/load-error/load-error';
import { Mascot } from '../../shared/mascot/mascot';
import { LoadingSkeleton } from '../../shared/skeleton/loading-skeleton';
import { Skeleton } from '../../shared/skeleton/skeleton';
import { StatusChip } from '../../shared/status-chip/status-chip';
import { catalogAction } from './catalog-action';
import { groupBySession, isPassed } from './catalog-sessions';

/** Cards drawn while the catalog loads: about one session's worth. */
const SKELETON_CARDS = [1, 2, 3];

/**
 * The student's home (/alumno, ficha 02): the exercises assigned to their groups, by session, with
 * their difficulty, status and progress (RF-02). No store: it only reads, so it keeps its state (4.5).
 */
@Component({
  selector: 'app-catalog-page',
  imports: [
    RouterLink,
    MatAnchor,
    MatIcon,
    MatProgressBar,
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

  protected readonly skeletonCards = SKELETON_CARDS;

  protected readonly entries = resource({
    params: () => this.auth.userId(), // string | undefined; undefined → idle
    loader: ({ params: userId }) => this.exercises.listAssigned(userId),
    defaultValue: [],
  });

  /** Sessions with their cards, ready for the template. */
  protected readonly sessions = computed(() =>
    groupBySession(this.entries.value()).map(({ session, entries, passed, complete }) => ({
      session,
      passed,
      complete,
      total: entries.length,
      cards: entries.map(({ exercise, assignmentId, status, hintCount, hintLevel }) => ({
        key: assignmentId,
        title: exercise.title,
        topics: exercise.topics.join(' · '),
        difficulty: exercise.difficulty,
        status,
        hintCount,
        hintLevel,
        action: catalogAction(status),
        path: APP_PATHS.student.exercise(exercise.id),
      })),
    })),
  );

  /** Sessions folded away: at first, the complete ones; then whatever the student toggles. */
  protected readonly folded = linkedSignal<ReadonlySet<number>>(
    () =>
      new Set(
        this.sessions()
          .filter((group) => group.complete)
          .map((group) => group.session),
      ),
  );

  protected readonly total = computed(() => this.entries.value().length);
  protected readonly passed = computed(
    () => this.entries.value().filter((entry) => isPassed(entry.status)).length,
  );
  protected toggle(session: number): void {
    this.folded.update((folded) => {
      const next = new Set(folded);
      if (!next.delete(session)) {
        next.add(session);
      }
      return next;
    });
  }

  /** Value of the progress bar, from 0 to 100; the bar only shows when there are exercises. */
  protected readonly percent = computed(() => (this.passed() / this.total()) * 100);
}
