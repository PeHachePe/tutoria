import { DatePipe } from '@angular/common';
import { Component, computed, DestroyRef, inject, input, output, signal } from '@angular/core';
import { MatButton } from '@angular/material/button';

import { DataError } from '../../data/data-error';
import { isLongWait } from '../is-long-wait';

/** How often the countdown moves on. */
const TICK_MS = 1000;

/**
 * «Reintentar» for an action that failed. When the server set a limit and said how long to wait
 * (`Retry-After`, as the runner and the tutor do), it counts the seconds down and stays disabled
 * until then, instead of letting the student hit the same limit again. A wait of more than a minute
 * (the tutor's limit of the day) says the time it ends instead.
 */
@Component({
  selector: 'app-retry-button',
  imports: [DatePipe, MatButton],
  template: `
    @let wait = secondsLeft();
    <button matButton type="button" [disabled]="wait > 0" (click)="retry.emit()">
      @if (longWaitUntil(); as until) {
        <span i18n="@@retryButton.waitUntil">Reintentar a las {{ until | date: 'shortTime' }}</span>
      } @else if (wait > 0) {
        <span i18n="@@retryButton.wait">Reintentar en {{ wait }} s</span>
      } @else {
        <span i18n="@@retryButton">Reintentar</span>
      }
    </button>
  `,
})
export class RetryButton {
  /** What failed: only a DataError with `retryAt` makes it wait. */
  readonly error = input<unknown>();
  readonly retry = output();

  private readonly now = signal(Date.now());

  protected readonly secondsLeft = computed(() => {
    const error = this.error();
    const retryAt = error instanceof DataError ? error.retryAt : undefined;
    return retryAt ? Math.max(0, Math.ceil((retryAt - this.now()) / TICK_MS)) : 0;
  });

  /** When a long wait ends, to say it as a time; null for a short one or none. */
  protected readonly longWaitUntil = computed(() => {
    const error = this.error();
    return isLongWait(error, this.now()) ? (error as DataError).retryAt : null;
  });

  constructor() {
    // The clock the countdown reads; it only lives inside an error message, while it is shown
    const timer = setInterval(() => this.now.set(Date.now()), TICK_MS);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }
}
