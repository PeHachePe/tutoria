import { Component, computed, input, output } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';

import type { TurnAction } from '../tutor-store';
import { actionView, queriedText } from './action-labels';

/**
 * What the tutor did with its tools in an answer (2.5e), under it: the data it looked up, what it
 * did on the screen and, for what changes the page, the button the student presses. A setting it
 * changed can be undone. The actions of an earlier visit are only said.
 */
@Component({
  selector: 'app-tutor-actions',
  imports: [MatButton, MatIcon],
  template: `
    @if (queried()) {
      <p class="flex items-center gap-1 text-label-medium text-on-surface-variant">
        <mat-icon class="size-4! text-[1rem]!" aria-hidden="true">manage_search</mat-icon>
        {{ queried() }}
      </p>
    }
    @if (views().length > 0) {
      <ul
        class="flex flex-col items-start gap-1"
        aria-label="Lo que ha hecho el tutor"
        i18n-aria-label="@@tutorAction.list"
      >
        @for (view of views(); track $index; let index = $index) {
          <li class="flex flex-wrap items-center gap-2">
            @switch (view.kind) {
              @case ('button') {
                <button
                  mat-stroked-button
                  type="button"
                  [disabled]="idle(index)"
                  [disabledInteractive]="true"
                  (click)="press(index)"
                >
                  <mat-icon aria-hidden="true">{{ view.icon }}</mat-icon>
                  {{ view.text }}
                </button>
                @if (view.hint) {
                  <span class="text-label-small text-on-surface-variant">{{ view.hint }}</span>
                }
              }
              @case ('failed') {
                <span class="flex items-center gap-1 text-label-medium text-error">
                  <mat-icon class="size-4! text-[1rem]!" aria-hidden="true">error</mat-icon>
                  {{ view.text }}
                </span>
                @if (!disabled()) {
                  <button
                    mat-button
                    type="button"
                    (click)="run.emit(index)"
                    i18n="@@tutorAction.retry"
                  >
                    Reintentar
                  </button>
                }
              }
              @default {
                <span class="flex items-center gap-1 text-label-medium text-on-surface-variant">
                  <mat-icon class="size-4! text-[1rem]!" aria-hidden="true">{{
                    view.icon
                  }}</mat-icon>
                  {{ view.text }}
                </span>
                @if (view.undo && !disabled()) {
                  <button
                    mat-button
                    type="button"
                    (click)="undo.emit(index)"
                    i18n="@@tutorAction.undo"
                  >
                    Deshacer
                  </button>
                }
              }
            }
          </li>
        }
      </ul>
    }
  `,
  host: { class: 'flex flex-col gap-1' },
})
export class TutorActions {
  readonly actions = input<readonly TurnAction[]>([]);
  /** The queries the tutor made before answering. */
  readonly queriedNames = input<readonly string[]>([]);
  /** A submitted attempt, or the tutor still answering: nothing to press. */
  readonly disabled = input(false);

  readonly run = output<number>();
  readonly undo = output<number>();

  protected readonly views = computed(() => this.actions().map(actionView));
  protected readonly queried = computed(() => queriedText(this.queriedNames()));

  /** Running, or the attempt submitted: the button stays focusable, but does nothing. */
  protected idle(index: number): boolean {
    return this.disabled() || this.actions()[index].status === 'running';
  }

  protected press(index: number): void {
    if (!this.idle(index)) this.run.emit(index);
  }
}
