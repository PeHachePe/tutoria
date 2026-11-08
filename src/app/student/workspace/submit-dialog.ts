import { Component } from '@angular/core';
import { MatButton } from '@angular/material/button';
import {
  MatDialogActions,
  MatDialogClose,
  MatDialogContent,
  MatDialogTitle,
} from '@angular/material/dialog';

/**
 * Confirms «Entregar»: once submitted, the code cannot change (2.4). Closes with `true` only when
 * the student confirms; the first button, which keeps working, takes the focus.
 */
@Component({
  selector: 'app-submit-dialog',
  imports: [MatDialogTitle, MatDialogContent, MatDialogActions, MatDialogClose, MatButton],
  template: `
    <h2 mat-dialog-title i18n="@@submitDialog.title">¿Entregar el ejercicio?</h2>
    <mat-dialog-content i18n="@@submitDialog.body">
      Has superado todas las pruebas. Al entregarlo, tu código queda guardado tal como está y ya no
      podrás cambiarlo.
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button matButton type="button" [mat-dialog-close]="false" i18n="@@submitDialog.cancel">
        Seguir revisando
      </button>
      <button
        matButton="filled"
        type="button"
        [mat-dialog-close]="true"
        i18n="@@submitDialog.confirm"
      >
        Entregar
      </button>
    </mat-dialog-actions>
  `,
})
export class SubmitDialog {}
