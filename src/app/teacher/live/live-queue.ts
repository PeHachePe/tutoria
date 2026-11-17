import { Component, computed, inject, input, output } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { RouterLink } from '@angular/router';

import { APP_PATHS } from '../../core/app-paths';
import { LanguageService } from '../../core/i18n/language-service';
import type { ClassBlock } from '../../data/exercise';
import { exerciseText } from '../../data/localized-text';
import { formatCall } from '../../shared/format-value';
import { Mascot } from '../../shared/mascot/mascot';
import { LiveReasonText } from './live-reason';
import type { QueuedRow } from './live-store';
import { otherBlockTitle } from './other-block';

const MINUTE_MS = 60_000;

/**
 * «A quién atender» (D-054, D-068): the students of the whole group who need the teacher where the
 * tutor does not reach, by reason and whoever has waited longest first, as raised hands. Each one
 * says who, for how long and «Atendido» in its first line, then why and where (with its block if
 * it is not the one shown), and the test that fails in one line (whole on hover), to arrive
 * knowing what to look at; it opens the attempt and leaves the queue with «Atendido» until a new
 * reason brings them back.
 *
 * The card has a maximum height and every entry is in it, with its own scroll: nothing to unfold. The entries slide in and out; nothing moves
 * for whoever asks for less motion.
 */
@Component({
  selector: 'app-live-queue',
  imports: [RouterLink, MatButton, Mascot, LiveReasonText],
  template: `
    <div class="flex items-center justify-between gap-3 border-b border-outline-variant px-4 py-3">
      <!-- The space between the heading and the count, for its accessible name -->
      <h2 id="live-queue-title" class="text-title-medium" ngPreserveWhitespaces>
        <span i18n="@@live.queue.heading">A quién atender</span>
        @if (items().length > 0) {
          <span
            class="ms-1 rounded-full bg-warning-container px-2.5 text-label-large text-on-warning-container"
            >{{ items().length }}</span
          >
        }
      </h2>
    </div>
    @if (items().length === 0) {
      <div
        class="flex flex-1 items-center justify-center gap-4 px-4 py-6 animate-live-in motion-reduce:animate-none"
      >
        <app-mascot class="size-16 shrink-0" mood="joy" />
        <p class="text-body-large text-on-surface-variant" i18n="@@live.queue.empty">
          Todo en orden: nadie necesita ayuda ahora mismo.
        </p>
      </div>
    } @else {
      <ol class="min-h-0 flex-1 overflow-y-auto scroll-shadows">
        @for (item of items(); track item.row.student.id) {
          <li
            class="flex flex-col gap-0.5 border-b border-outline-variant px-4 py-2.5 last:border-b-0"
            animate.enter="animate-live-in motion-reduce:animate-none"
            animate.leave="animate-live-out motion-reduce:animate-none"
          >
            <div class="flex items-center justify-between gap-2">
              <p class="flex min-w-0 flex-wrap items-baseline gap-x-2" ngPreserveWhitespaces>
                <a
                  class="text-body-large font-medium text-primary underline-offset-2 hover:underline"
                  [routerLink]="item.path"
                  queryParamsHandling="preserve"
                  >{{ item.row.student.name }}</a
                >
                <span class="text-body-small whitespace-nowrap text-on-surface-variant">
                  @if (item.waiting === 0) {
                    <ng-container i18n="@@live.queue.justNow">Ahora</ng-container>
                  } @else {
                    <ng-container i18n="@@live.queue.waiting"
                      >Espera {{ item.waiting }} min</ng-container
                    >
                  }
                </span>
              </p>
              <button
                matButton="outlined"
                type="button"
                class="shrink-0"
                [attr.aria-label]="attendedLabel(item.row.student.name)"
                (click)="attend.emit(item.row.student.id)"
                i18n="@@live.queue.attend"
              >
                Atendido
              </button>
            </div>
            <!-- The spaces between the reason, the exercise and the block, which Angular would remove -->
            <p class="text-body-medium text-on-surface-variant" ngPreserveWhitespaces>
              <app-live-reason [reason]="item.row.reason" />
              <span [title]="item.exercise">
                ·
                <ng-container i18n="@@live.queue.exercise"
                  >ejercicio {{ item.position }}</ng-container
                ></span
              >
              @if (item.block) {
                <span> · {{ item.block }}</span>
              }
            </p>
            @if (item.call) {
              <!-- One line however long the call: whole on hover -->
              <p
                class="flex min-w-0 items-baseline gap-1.5 text-body-medium text-on-surface-variant"
                ngPreserveWhitespaces
              >
                <span class="shrink-0" i18n="@@live.queue.test">falla</span>
                <code
                  class="min-w-0 truncate rounded bg-surface-container-high px-1 font-mono text-body-small"
                  [title]="item.call"
                  >{{ item.call }}</code
                >
              </p>
            }
          </li>
        }
      </ol>
    }
  `,
  host: {
    role: 'region',
    'aria-labelledby': 'live-queue-title',
    class: '@container flex max-h-112 flex-col overflow-hidden rounded-2xl bg-panel',
  },
})
export class LiveQueue {
  private readonly locale = inject(LanguageService).locale;

  /** The queue, in order. */
  readonly rows = input.required<readonly QueuedRow[]>();
  /** The blocks of the group, to name the one of an exercise. */
  readonly blocks = input.required<readonly ClassBlock[]>();
  /** The block shown, or null with the whole class. */
  readonly blockId = input.required<string | null>();
  /** The clock of the panel, for the waiting time. */
  readonly now = input.required<number>();
  readonly attend = output<string>();

  protected readonly items = computed(() =>
    this.rows().flatMap((row) => {
      // A reason comes with an attempt at an exercise of the group
      if (!row.attempt || !row.exercise) return [];
      const test = row.failingTest;
      return [
        {
          row,
          path: APP_PATHS.teacher.attempt(row.attempt.id),
          exercise: exerciseText(row.exercise.exercise, this.locale).title,
          position: row.position,
          block: otherBlockTitle(this.blocks(), row.exercise, this.blockId(), this.locale),
          call: test ? formatCall(row.exercise.exercise.functionName, test.input) : null,
          waiting: Math.max(0, Math.floor((this.now() - row.reason.since) / MINUTE_MS)),
        },
      ];
    }),
  );

  protected attendedLabel(name: string): string {
    return $localize`:@@live.queue.attendLabel:Marcar como atendido: ${name}:name:`;
  }
}
