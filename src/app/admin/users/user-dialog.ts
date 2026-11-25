import { Component, inject, signal } from '@angular/core';
import { form, FormField, FormRoot } from '@angular/forms/signals';
import { MatButton } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogClose,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle,
} from '@angular/material/dialog';
import { MatError, MatFormField, MatHint, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatOption, MatSelect } from '@angular/material/select';

import { GUIDE_ANCHORS, GuideAnchor } from '../../core/guide/guide-anchor';
import type { AppUser } from '../../data/user';
import { PasswordField } from './password-field';
import { ROLE_LABELS, ROLES } from './role-labels';
import { userActionMessage } from './user-action-message';
import { toUserFormModel, type UserFormModel, userSchema } from './user-form';

/** The account to edit, or null for a new one, and what the dialog needs to judge it. */
export interface UserDialogData {
  readonly user: AppUser | null;
  /** The emails that already have an account, normalized (CU-06 3a): those of the list loaded. */
  readonly takenEmails: () => ReadonlySet<string>;
  /** Why its role cannot change (`roleLock()`), or null. */
  readonly roleLock: string | null;
  /** Saves the account; the dialog stays open, with the error, if it fails. */
  readonly save: (model: UserFormModel) => Promise<void>;
}

/**
 * A new account (name, email, role and password) or an existing one (name and role: its email is its
 * identity in Auth and its password is reset apart, D-072). The role is disabled with its reason
 * when it cannot change, not refused after saving.
 */
@Component({
  selector: 'app-user-dialog',
  imports: [
    FormRoot,
    FormField,
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions,
    MatDialogClose,
    MatButton,
    MatFormField,
    MatLabel,
    MatHint,
    MatError,
    MatInput,
    MatSelect,
    MatOption,
    PasswordField,
    GuideAnchor,
  ],
  template: `
    <h2 mat-dialog-title>
      @if (data.user) {
        <span i18n="@@userDialog.edit">Editar la cuenta</span>
      } @else {
        <span i18n="@@userDialog.new">Nuevo usuario</span>
      }
    </h2>
    <form [formRoot]="userForm">
      <mat-dialog-content>
        <div class="flex flex-col gap-2 app-form-dialog">
          <!-- The limits of length reach the inputs as maxlength, from the schema -->
          <mat-form-field>
            <mat-label i18n="@@userDialog.name">Nombre y apellidos</mat-label>
            <input matInput [formField]="userForm.name" autocomplete="off" />
            @if (userForm.name().errors()[0]; as error) {
              <mat-error>{{ error.message }}</mat-error>
            }
          </mat-form-field>
          @if (data.user; as user) {
            <mat-form-field>
              <mat-label i18n="@@userDialog.email">Correo</mat-label>
              <input matInput [value]="user.email" readonly />
              <mat-hint i18n="@@userDialog.email.fixed">Es con lo que entra: no se cambia</mat-hint>
            </mat-form-field>
          } @else {
            <mat-form-field>
              <mat-label i18n="@@userDialog.email">Correo</mat-label>
              <input
                matInput
                type="email"
                [formField]="userForm.email"
                autocomplete="off"
                spellcheck="false"
              />
              @if (userForm.email().errors()[0]; as error) {
                <mat-error>{{ error.message }}</mat-error>
              }
            </mat-form-field>
          }
          <!-- Dynamic: the reason of a locked role takes two lines -->
          <mat-form-field subscriptSizing="dynamic">
            <mat-label i18n="@@userDialog.role">Rol</mat-label>
            <mat-select [formField]="userForm.role">
              @for (role of roles; track role) {
                <mat-option [value]="role">{{ roleLabels[role] }}</mat-option>
              }
            </mat-select>
            @if (data.roleLock; as reason) {
              <mat-hint>{{ reason }}</mat-hint>
            }
          </mat-form-field>
          @if (!data.user) {
            <app-password-field
              class="mt-2"
              [field]="userForm.password"
              label="Contraseña"
              i18n-label="@@userDialog.password"
            />
          }
          @if (failure(); as message) {
            <p class="mt-2 text-body-medium text-error" role="alert">{{ message }}</p>
          }
        </div>
      </mat-dialog-content>
      <mat-dialog-actions>
        <button matButton type="button" mat-dialog-close i18n="@@userDialog.cancel">
          Cancelar
        </button>
        <button
          matButton="filled"
          type="submit"
          [disabled]="userForm().submitting()"
          [appGuideAnchor]="anchors.userDialogSave"
        >
          @if (userForm().submitting()) {
            <span i18n="@@userDialog.saving">Guardando…</span>
          } @else if (data.user) {
            <span i18n="@@userDialog.save">Guardar</span>
          } @else {
            <span i18n="@@userDialog.create">Crear la cuenta</span>
          }
        </button>
      </mat-dialog-actions>
    </form>
  `,
})
export class UserDialog {
  protected readonly anchors = GUIDE_ANCHORS;
  protected readonly data = inject<UserDialogData>(MAT_DIALOG_DATA);
  private readonly ref = inject<MatDialogRef<UserDialog, boolean>>(MatDialogRef);

  protected readonly roles = ROLES;
  protected readonly roleLabels = ROLE_LABELS;
  /** What the server said when saving failed, or null. */
  protected readonly failure = signal<string | null>(null);

  private readonly model = signal(toUserFormModel(this.data.user));

  protected readonly userForm = form(
    this.model,
    userSchema({
      takenEmails: this.data.takenEmails,
      editing: this.data.user !== null,
      roleLock: this.data.roleLock,
    }),
    {
      submission: {
        action: async (field) => {
          this.failure.set(null);
          try {
            await this.data.save(field().value());
            this.ref.close(true);
          } catch (error) {
            this.failure.set(userActionMessage(this.data.user ? 'edit' : 'create', error));
          }
          return undefined;
        },
      },
    },
  );
}
