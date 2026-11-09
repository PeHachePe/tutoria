import { Component, inject } from '@angular/core';
import { MatAnchor, MatButton } from '@angular/material/button';
import {
  MatDialogActions,
  MatDialogClose,
  MatDialogContent,
  MatDialogTitle,
} from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { RouterLink } from '@angular/router';

import { APP_PATHS } from '../../core/app-paths';
import { SettingsStore } from '../settings/settings-store';

/**
 * The notice on the registered data (RF-07), the first time the student enters, before working: a
 * summary in plain words and a link to the whole page. Either button counts as seen, per user.
 */
@Component({
  selector: 'app-data-notice-dialog',
  imports: [
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions,
    MatDialogClose,
    MatButton,
    MatAnchor,
    MatIcon,
    RouterLink,
  ],
  template: `
    <h2 mat-dialog-title i18n="@@dataNotice.title">Antes de empezar: tus datos</h2>
    <mat-dialog-content>
      <!-- Material styles the content itself, so the layout goes in a box of our own (4.8) -->
      <div class="flex flex-col gap-4">
        <p i18n="@@dataNotice.recorded">
          Mientras trabajas, TutorIA guarda tu código, la conversación con el tutor, las pruebas que
          ejecutas, las pistas que pides, cuándo pegas código y cuándo sales de la pantalla de
          trabajo.
        </p>
        <p
          class="flex items-center gap-2 rounded-xl bg-success-container p-3 text-on-success-container"
        >
          <mat-icon aria-hidden="true">mic_off</mat-icon>
          <span i18n="@@dataNotice.never"><strong>Nunca graba el audio</strong> de tu voz.</span>
        </p>
        <p i18n="@@dataNotice.purpose">
          Lo ve tu docente, para saber cuándo ayudarte y mejorar las actividades, no para sancionar.
        </p>
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <a
        matButton
        [routerLink]="dataPath"
        mat-dialog-close
        (click)="acknowledge()"
        i18n="@@dataNotice.details"
      >
        Ver los detalles
      </a>
      <button
        matButton="filled"
        type="button"
        mat-dialog-close
        (click)="acknowledge()"
        i18n="@@dataNotice.ok"
      >
        Entendido
      </button>
    </mat-dialog-actions>
  `,
})
export class DataNoticeDialog {
  private readonly settings = inject(SettingsStore);

  protected readonly dataPath = APP_PATHS.student.data;

  protected acknowledge(): void {
    this.settings.markDataNoticeSeen();
  }
}
