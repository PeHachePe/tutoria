import { Component, inject } from '@angular/core';
import { MatButton } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialog,
  MatDialogActions,
  MatDialogClose,
  MatDialogContent,
  MatDialogTitle,
} from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';

/** What the dialog asks: a question, what it means and the words of the button that goes ahead. */
export interface ConfirmDialogData {
  readonly title: string;
  readonly text: string;
  readonly confirm: string;
}

/**
 * Asks before an action that cannot be undone, such as deleting an exercise. «Cancelar» has the
 * focus first, so Enter never destroys anything by accident.
 */
@Component({
  selector: 'app-confirm-dialog',
  imports: [MatDialogTitle, MatDialogContent, MatDialogActions, MatDialogClose, MatButton],
  template: `
    <h2 mat-dialog-title>{{ data.title }}</h2>
    <mat-dialog-content>
      <p>{{ data.text }}</p>
    </mat-dialog-content>
    <mat-dialog-actions>
      <button
        matButton
        type="button"
        [mat-dialog-close]="false"
        cdkFocusInitial
        i18n="@@confirm.cancel"
      >
        Cancelar
      </button>
      <button matButton="filled" type="button" [mat-dialog-close]="true">{{ data.confirm }}</button>
    </mat-dialog-actions>
  `,
})
export class ConfirmDialog {
  protected readonly data = inject<ConfirmDialogData>(MAT_DIALOG_DATA);
}

/** Opens the dialog and tells whether the user went ahead: closing it in any other way says no. */
export async function confirmAction(dialog: MatDialog, data: ConfirmDialogData): Promise<boolean> {
  const ref = dialog.open<ConfirmDialog, ConfirmDialogData, boolean>(ConfirmDialog, { data });
  return (await firstValueFrom(ref.afterClosed())) === true;
}
