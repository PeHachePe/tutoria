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
import type { AttemptStatus } from '../../data/attempt';
import { catalogAction } from './catalog-action';
import { countByStatus, groupBySession, isPassed, nextExercise } from './catalog-sessions';

/** Colour tokens of the marker in front of each exercise and of the dots of each session. */
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
    groupBySession(this.entries.value()).map(({ session, title, entries, passed, complete }) => ({
      session,
      title,
      passed,
      complete,
      total: entries.length,
      dots: entries.map(({ assignmentId, status }) => ({
        key: assignmentId,
        classes: STATUS_TONES[status].dot,
      })),
      cards: entries.map(({ exercise, assignmentId, status, hintCount, hintLevel }, index) => ({
        key: assignmentId,
        number: index + 1,
        marker: STATUS_TONES[status].marker,
        done: isPassed(status),
        ready: status === 'passed',
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
  /** Exercises by status, for the counters of the summary. */
  protected readonly counts = computed(() => countByStatus(this.entries.value()));

  /** First name for the greeting: the seed and the admin store the full name. */
  protected readonly firstName = computed(() => this.auth.user()?.name.split(' ')[0] ?? '');

  /** The card «Continúa donde lo dejaste» or «Tu siguiente ejercicio»; null once all is submitted. */
  protected readonly next = computed(() => {
    const next = nextExercise(this.entries.value());
    if (!next) return null;
    const { entry, kind } = next;
    return {
      kind,
      title: entry.exercise.title,
      topics: entry.exercise.topics.join(' · '),
      session: entry.session,
      sessionTitle: entry.sessionTitle,
      status: entry.status,
      action: catalogAction(entry.status),
      path: APP_PATHS.student.exercise(entry.exercise.id),
    };
  });

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
