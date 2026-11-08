import { Component, computed, input, output } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';

import { isRetryable, loadErrorMessage } from './load-error-message';

/**
 * Error state of a screen or a zone that could not load its data: what happened and a button to try
 * again (4.2, 5.4), or, when the user has no access, the way out the screen projects inside (such as a
 * link back). It is announced as an alert when it appears.
 */
@Component({
  selector: 'app-load-error',
  imports: [MatButton, MatIcon],
  template: `
    <mat-icon>cloud_off</mat-icon>
    <p class="flex-1">{{ message() }}</p>
    @if (retryable()) {
      <button matButton="tonal" type="button" (click)="retry.emit()" i18n="@@loadError.retry">
        Reintentar
      </button>
    } @else {
      <!-- Without access, trying again fails the same way: the screen projects a way out instead -->
      <ng-content />
    }
  `,
  host: {
    role: 'alert',
    class:
      'flex flex-wrap items-center gap-3 rounded-xl bg-error-container px-4 py-3 text-body-large text-on-error-container',
  },
})
export class LoadError {
  readonly error = input.required<unknown>();
  readonly retry = output();

  protected readonly message = computed(() => loadErrorMessage(this.error()));
  protected readonly retryable = computed(() => isRetryable(this.error()));
}
