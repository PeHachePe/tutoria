import { Component, computed, inject, input, resource } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { APP_PATHS, TEACHER_PARAMS } from '../../core/app-paths';
import { AppTitleStrategy } from '../../core/app-title-strategy';
import { LanguageService } from '../../core/i18n/language-service';
import { DataError } from '../../data/data-error';
import { type AttemptRef, type LiveAttemptDetail, LiveService } from '../../data/live-service';
import { exerciseText } from '../../data/localized-text';
import { EmptyState } from '../../shared/empty-state/empty-state';
import { LoadError } from '../../shared/load-error/load-error';
import { LoadingSkeleton } from '../../shared/skeleton/loading-skeleton';
import { Skeleton } from '../../shared/skeleton/skeleton';
import { LiveStore } from '../live/live-store';
import { latestAttempt, mergeById } from './attempt-timeline';
import { AttemptDetailView, type AttemptView } from './attempt-detail-view';
import { GUIDE_ANCHORS, GuideAnchor } from '../../core/guide/guide-anchor';

/**
 * The detail of an attempt (/docente/en-vivo/:attemptId, ficha 07): how the student got here
 * (RF-12, CU-04 3a). It loads the attempt on its own, so a direct link works, and joins what the
 * `LiveStore` of the parent route hears while the student keeps working. The URL follows the group
 * of the attempt, so the store watches it and «Volver a la sesión» returns there; the block shown
 * stays, as the panel follows the whole group (D-068).
 */
@Component({
  selector: 'app-attempt-detail-page',
  imports: [
    GuideAnchor,
    MatButton,
    MatIcon,
    RouterLink,
    AttemptDetailView,
    EmptyState,
    LoadError,
    LoadingSkeleton,
    Skeleton,
  ],
  templateUrl: './attempt-detail-page.html',
})
export class AttemptDetailPage {
  protected readonly anchors = GUIDE_ANCHORS;
  private readonly live = inject(LiveService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly store = inject(LiveStore);
  private readonly titles = inject(AppTitleStrategy);
  private readonly locale = inject(LanguageService).locale;

  /** From the route, by `withComponentInputBinding()`. */
  readonly attemptId = input.required<string>();

  protected readonly livePath = APP_PATHS.teacher.live;

  private readonly detail = resource({
    params: () => this.attemptId(),
    loader: async ({ params, abortSignal }) => {
      const detail = await this.live.attemptDetail(params);
      await this.followGroup(detail);
      // The tab says whose attempt it is, not just «Detalle del intento» (WCAG 2.4.2): a teacher
      // may open several. After correcting the URL, whose navigation sets the title of the route
      // again, and not if the teacher already left for another attempt.
      if (!abortSignal.aborted) {
        const exercise = exerciseText(detail.exercise.exercise, this.locale).title;
        this.titles.setScreenTitle(`${detail.student.name} · ${exercise}`);
      }
      return { ...detail, loadedAt: Date.now() };
    },
  });

  protected readonly isLoading = this.detail.isLoading;
  protected readonly error = this.detail.error;
  protected readonly notFound = computed(() => {
    const error = this.detail.error();
    return error instanceof DataError && error.kind === 'not_found';
  });

  /** What was loaded with what arrived live since, or undefined while it loads or after it failed. */
  protected readonly view = computed<AttemptView | undefined>(() => {
    if (!this.detail.hasValue()) return undefined;
    const loaded = this.detail.value();
    const id = loaded.attempt.id;
    const activity = this.store.activityOf(id);
    const attempt = latestAttempt(
      loaded.attempt,
      activity?.attempts.find((candidate) => candidate.id === id),
    );
    return {
      ...loaded,
      attempt,
      events: mergeById(loaded.events, activity?.events.filter((e) => e.attemptId === id) ?? []),
      interactions: mergeById(
        loaded.interactions,
        activity?.interactions.filter((i) => i.attemptId === id) ?? [],
      ),
      // The ones loaded and those the panel hears, whatever block it follows
      attempts: mergeById<AttemptRef>(
        loaded.siblings,
        (activity?.attempts ?? [])
          .filter(
            (candidate) =>
              candidate.assignmentId === attempt.assignmentId &&
              candidate.userId === attempt.userId,
          )
          .map(({ id, number }) => ({ id, number })),
      ).sort((a, b) => a.number - b.number),
    };
  });

  /** The group of the attempt, merged with the block of the URL; until it loads, the URL as it is. */
  protected readonly backQuery = computed(() => {
    const view = this.view();
    return view && { [TEACHER_PARAMS.group]: view.groupId };
  });

  protected reload(): void {
    this.detail.reload();
  }

  /**
   * The URL takes the group of the attempt, without a new entry in the history: the store then
   * watches it, and «Volver a la sesión» returns there. A block of the URL belonged to another
   * group, so it goes.
   */
  private async followGroup({ groupId }: LiveAttemptDetail): Promise<void> {
    if (this.route.snapshot.queryParamMap.get(TEACHER_PARAMS.group) === groupId) {
      return;
    }
    await this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { [TEACHER_PARAMS.group]: groupId, [TEACHER_PARAMS.block]: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }
}
