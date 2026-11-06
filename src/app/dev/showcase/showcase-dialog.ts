import { Component } from '@angular/core';
import { MatButton } from '@angular/material/button';
import {
  MatDialogActions,
  MatDialogClose,
  MatDialogContent,
  MatDialogTitle,
} from '@angular/material/dialog';

/** Sample confirmation dialog; closes with `true` when the user confirms. */
@Component({
  selector: 'app-showcase-dialog',
  imports: [MatDialogTitle, MatDialogContent, MatDialogActions, MatDialogClose, MatButton],
  template: `
    <h2 mat-dialog-title>¿Entregar el ejercicio?</h2>
    <mat-dialog-content>
      Una vez entregado ya no podrás cambiar el código. Las pruebas están todas superadas.
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button matButton [mat-dialog-close]="false">Cancelar</button>
      <button matButton="filled" [mat-dialog-close]="true">Entregar</button>
    </mat-dialog-actions>
  `,
})
export class ShowcaseDialog {}
