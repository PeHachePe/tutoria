import { Component, computed, inject, input, resource } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { APP_PATHS, TEACHER_PARAMS } from '../../core/app-paths';
import { AppTitleStrategy } from '../../core/app-title-strategy';
import { LanguageService } from '../../core/i18n/language-service';
import { DataError } from '../../data/data-error';
import { type LiveAttemptDetail, LiveService } from '../../data/live-service';
import { exerciseText } from '../../data/localized-text';
import { EmptyState } from '../../shared/empty-state/empty-state';
import { LoadError } from '../../shared/load-error/load-error';
import { LoadingSkeleton } from '../../shared/skeleton/loading-skeleton';
import { Skeleton } from '../../shared/skeleton/skeleton';
import { LiveStore } from '../live/live-store';
import { latestAttempt, mergeById } from './attempt-timeline';
import { AttemptDetailView, type AttemptView } from './attempt-detail-view';

/**
 * The detail of an attempt (/docente/en-vivo/:attemptId, ficha 07): how the student got here
 * (RF-12, CU-04 3a). It loads the attempt on its own, so a direct link works, and joins what the
 * `LiveStore` of the parent route hears while the student keeps working. The URL follows the group
 * and the block of the attempt, so the store watches them and «Volver a la sesión» returns there.
 */
@Component({
  selector: 'app-attempt-detail-page',
  imports: [
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
      await this.followBlock(detail);
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
      attempts: (activity?.attempts ?? [attempt])
        .filter((candidate) => candidate.assignmentId === attempt.assignmentId)
        .sort((a, b) => a.number - b.number),
    };
  });

  protected readonly backQuery = computed(() => {
    const view = this.view();
    return view && { [TEACHER_PARAMS.group]: view.groupId, [TEACHER_PARAMS.block]: view.blockId };
  });

  protected reload(): void {
    this.detail.reload();
  }

  /**
   * The URL takes the group and the block of the attempt, without a new entry in the history: the
   * store then watches them, and «Volver a la sesión» returns there.
   */
  private async followBlock({ groupId, blockId }: LiveAttemptDetail): Promise<void> {
    const query = this.route.snapshot.queryParamMap;
    if (
      query.get(TEACHER_PARAMS.group) === groupId &&
      query.get(TEACHER_PARAMS.block) === blockId
    ) {
      return;
    }
    await this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { [TEACHER_PARAMS.group]: groupId, [TEACHER_PARAMS.block]: blockId },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }
}
