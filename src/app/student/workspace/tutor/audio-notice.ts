import { Component, output } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';

/**
 * Where the audio goes when the browser transcribes in its service (2.11), before the microphone
 * opens for the first time: «Entendido» remembers it and goes on. The dictation and the call use it.
 */
@Component({
  selector: 'app-audio-notice',
  imports: [MatButton, MatIcon],
  template: `
    <div
      role="status"
      class="flex flex-wrap items-center gap-2 rounded-lg bg-surface-container-high p-3 text-on-surface"
    >
      <mat-icon class="shrink-0 text-primary" aria-hidden="true">privacy_tip</mat-icon>
      <p class="min-w-40 flex-1 text-body-medium" i18n="@@voice.audioNotice">
        Tu navegador envía el audio a su servicio de reconocimiento para transcribirlo. TutorIA no
        lo graba.
      </p>
      <button
        matButton="tonal"
        type="button"
        (click)="accepted.emit()"
        i18n="@@voice.audioNotice.ok"
      >
        Entendido
      </button>
    </div>
  `,
})
export class AudioNotice {
  readonly accepted = output<void>();
}
