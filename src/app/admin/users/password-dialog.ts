import { Component, inject, signal } from '@angular/core';
import { form, FormRoot, type SchemaPathTree } from '@angular/forms/signals';
import { MatButton } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogClose,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle,
} from '@angular/material/dialog';

import { PasswordField } from './password-field';
import { userActionMessage } from './user-action-message';
import { passwordRules } from './user-form';

/** Whose password it is, and how to save the new one. */
export interface PasswordDialogData {
  readonly name: string;
  /** Saves the password; the dialog stays open, with the error, if it fails. */
  readonly save: (password: string) => Promise<void>;
}

interface PasswordModel {
  readonly password: string;
}

function passwordSchema(path: SchemaPathTree<PasswordModel>): void {
  passwordRules(path.password);
}

/**
 * The new password of an account (5.1b): the application sends no email, so the administration sets
 * it and hands it over in person (D-072). The old one stops working at once.
 */
@Component({
  selector: 'app-password-dialog',
  imports: [
    FormRoot,
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions,
    MatDialogClose,
    MatButton,
    PasswordField,
  ],
  template: `
    <h2 mat-dialog-title i18n="@@passwordDialog.title">Restablecer la contraseña</h2>
    <form [formRoot]="passwordForm">
      <mat-dialog-content>
        <div class="flex flex-col gap-3 app-form-dialog">
          <p class="text-body-medium" i18n="@@passwordDialog.text">
            La contraseña de {{ data.name }} cambia en cuanto la guardes: la anterior deja de
            servir.
          </p>
          <app-password-field
            [field]="passwordForm.password"
            label="Contraseña nueva"
            i18n-label="@@passwordDialog.password"
          />
          @if (failure(); as message) {
            <p class="text-body-medium text-error" role="alert">{{ message }}</p>
          }
        </div>
      </mat-dialog-content>
      <mat-dialog-actions>
        <button matButton type="button" mat-dialog-close i18n="@@passwordDialog.cancel">
          Cancelar
        </button>
        <button matButton="filled" type="submit" [disabled]="passwordForm().submitting()">
          @if (passwordForm().submitting()) {
            <span i18n="@@passwordDialog.saving">Guardando…</span>
          } @else {
            <span i18n="@@passwordDialog.save">Guardar la contraseña</span>
          }
        </button>
      </mat-dialog-actions>
    </form>
  `,
})
export class PasswordDialog {
  protected readonly data = inject<PasswordDialogData>(MAT_DIALOG_DATA);
  private readonly ref = inject<MatDialogRef<PasswordDialog, boolean>>(MatDialogRef);

  protected readonly failure = signal<string | null>(null);

  protected readonly passwordForm = form(signal<PasswordModel>({ password: '' }), passwordSchema, {
    submission: {
      action: async (field) => {
        this.failure.set(null);
        try {
          await this.data.save(field().value().password);
          this.ref.close(true);
        } catch (error) {
          this.failure.set(userActionMessage('password', error));
        }
        return undefined;
      },
    },
  });
}
