import { Component, computed, inject, input, output, signal } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { RouterLink } from '@angular/router';

import { APP_PATHS } from '../../core/app-paths';
import { LanguageService } from '../../core/i18n/language-service';
import { exerciseText } from '../../data/localized-text';
import { Mascot } from '../../shared/mascot/mascot';
import { LiveReasonText, REASON_ICONS } from './live-reason';
import type { LiveRow } from './live-row';

const MINUTE_MS = 60_000;

/** Students the queue shows before «Ver los N»: the first ones are who to help now. */
export const QUEUE_SHOWN = 6;

/**
 * «A quién atender» (D-054): the students who need the teacher where the tutor does not reach,
 * whoever has waited longest first, as raised hands. Each one says why, opens the attempt and
 * leaves the queue with «Atendido» until a new signal brings them back.
 */
@Component({
  selector: 'app-live-queue',
  imports: [RouterLink, MatButton, Mascot, LiveReasonText],
  template: `
    <div class="flex items-center justify-between gap-3 border-b border-outline-variant px-4 py-3">
      <!-- The space between the heading and the count, for its accessible name -->
      <h2 id="live-queue-title" class="text-title-medium" ngPreserveWhitespaces>
        <span i18n="@@live.queue.heading">A quién atender</span>
        @if (rows().length > 0) {
          <span
            class="ms-1 rounded-full bg-warning-container px-2.5 text-label-large text-on-warning-container"
            >{{ rows().length }}</span
          >
        }
      </h2>
      @if (rows().length > 1) {
        <p
          class="hidden text-body-small text-on-surface-variant sm:block"
          i18n="@@live.queue.order"
        >
          Primero, quien se ha atascado con el código
        </p>
      }
    </div>
    @if (items().length === 0) {
      <div class="flex flex-1 items-center justify-center gap-4 px-4 py-6">
        <app-mascot class="size-16 shrink-0" mood="joy" />
        <p class="text-body-large text-on-surface-variant" i18n="@@live.queue.empty">
          Todo en orden: nadie necesita ayuda ahora mismo.
        </p>
      </div>
    } @else {
      <ol>
        @for (item of shown(); track item.row.student.id) {
          <li
            class="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-outline-variant px-4 py-3 last:border-b-0 animate-live-in motion-reduce:animate-none sm:flex-nowrap"
          >
            <span
              class="flex size-10 shrink-0 items-center justify-center rounded-full bg-warning-container text-on-warning-container"
              aria-hidden="true"
            >
              <span class="material-symbols-outlined">{{ item.icon }}</span>
            </span>
            <div class="flex min-w-0 flex-1 basis-[calc(100%-3.5rem)] flex-col sm:basis-0">
              <a
                class="self-start text-body-large font-medium text-primary underline-offset-2 hover:underline"
                [routerLink]="item.path"
                queryParamsHandling="preserve"
                >{{ item.row.student.name }}</a
              >
              <p class="text-body-medium text-on-surface-variant">
                <app-live-reason [reason]="item.signal" />
                <span [title]="item.exercise">
                  ·
                  <ng-container i18n="@@live.queue.exercise"
                    >ejercicio {{ item.position }}</ng-container
                  ></span
                >
              </p>
            </div>
            <span class="ms-14 text-body-medium whitespace-nowrap text-on-surface-variant sm:ms-0">
              @if (item.waiting === 0) {
                <ng-container i18n="@@live.queue.justNow">Ahora</ng-container>
              } @else {
                <ng-container i18n="@@live.queue.waiting"
                  >Espera {{ item.waiting }} min</ng-container
                >
              }
            </span>
            <button
              matButton="outlined"
              type="button"
              class="ms-auto"
              [attr.aria-label]="attendedLabel(item.row.student.name)"
              (click)="attend.emit(item.row.student.id)"
              i18n="@@live.queue.attend"
            >
              Atendido
            </button>
          </li>
        }
      </ol>
      @if (items().length > QUEUE_SHOWN) {
        <div class="border-t border-outline-variant px-2 py-1">
          <button matButton type="button" (click)="expanded.update((value) => !value)">
            @if (expanded()) {
              <ng-container i18n="@@live.queue.showFewer">Ver menos</ng-container>
            } @else {
              <ng-container i18n="@@live.queue.showAll">Ver los {{ items().length }}</ng-container>
            }
          </button>
        </div>
      }
    }
  `,
  host: {
    role: 'region',
    'aria-labelledby': 'live-queue-title',
    class: 'flex flex-col overflow-hidden rounded-2xl bg-panel',
  },
})
export class LiveQueue {
  private readonly locale = inject(LanguageService).locale;

  /** The queue, in order. */
  readonly rows = input.required<readonly LiveRow[]>();
  /** The clock of the panel, for the waiting time. */
  readonly now = input.required<number>();
  readonly attend = output<string>();

  protected readonly QUEUE_SHOWN = QUEUE_SHOWN;
  protected readonly expanded = signal(false);
  protected readonly shown = computed(() =>
    this.expanded() ? this.items() : this.items().slice(0, QUEUE_SHOWN),
  );

  protected readonly items = computed(() =>
    this.rows().flatMap((row) => {
      // A signal comes with an attempt at an exercise of the block
      if (!row.signal || !row.attempt || !row.exercise) return [];
      return [
        {
          row,
          signal: row.signal,
          icon: REASON_ICONS[row.signal.kind],
          path: APP_PATHS.teacher.attempt(row.attempt.id),
          exercise: exerciseText(row.exercise.exercise, this.locale).title,
          position: row.position,
          waiting: Math.max(0, Math.floor((this.now() - row.signal.since) / MINUTE_MS)),
        },
      ];
    }),
  );

  protected attendedLabel(name: string): string {
    return $localize`:@@live.queue.attendLabel:Marcar como atendido: ${name}:name:`;
  }
}
