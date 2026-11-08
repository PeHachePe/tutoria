import { Component, input, output } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';

import type { SaveStatus } from './attempt-store';

/**
 * Whether the code is saved, next to the editor. «Guardando…» and «Guardado» are only visible text:
 * read aloud, they would repeat on every pause while typing. A failed save is announced, keeps the
 * code in the store and offers to retry.
 */
@Component({
  selector: 'app-save-indicator',
  imports: [MatButton, MatIcon],
  template: `
    @switch (status()) {
      @case ('error') {
        <p role="alert" class="flex items-center gap-1 text-body-small text-error">
          <mat-icon class="size-5! text-[1.25rem]!">cloud_off</mat-icon>
          <span i18n="@@saveIndicator.error">No se ha guardado</span>
        </p>
        <button matButton type="button" (click)="retry.emit()" i18n="@@saveIndicator.retry">
          Reintentar
        </button>
      }
      @case ('saved') {
        <p class="flex items-center gap-1 text-body-small text-on-surface-variant">
          <mat-icon class="size-5! text-[1.25rem]!">cloud_done</mat-icon>
          <span i18n="@@saveIndicator.saved">Guardado</span>
        </p>
      }
      @case ('idle') {}
      @default {
        <p class="flex items-center gap-1 text-body-small text-on-surface-variant">
          <mat-icon class="size-5! text-[1.25rem]!">sync</mat-icon>
          <span i18n="@@saveIndicator.saving">Guardando…</span>
        </p>
      }
    }
  `,
  host: { class: 'flex min-h-10 items-center gap-2' },
})
export class SaveIndicator {
  readonly status = input.required<SaveStatus>();
  readonly retry = output();
}
