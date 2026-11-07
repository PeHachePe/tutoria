import { Component, computed, input, output } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';

import { loadErrorMessage } from './load-error-message';

/**
 * Error state of a screen or a zone that could not load its data: what happened and a button to try
 * again (4.2, 5.4). It is announced as an alert when it appears.
 */
@Component({
  selector: 'app-load-error',
  imports: [MatButton, MatIcon],
  template: `
    <mat-icon>cloud_off</mat-icon>
    <p class="flex-1">{{ message() }}</p>
    <button matButton="tonal" type="button" (click)="retry.emit()" i18n="@@loadError.retry">
      Reintentar
    </button>
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
}
