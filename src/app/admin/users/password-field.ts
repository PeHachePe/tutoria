import { LiveAnnouncer } from '@angular/cdk/a11y';
import { Clipboard } from '@angular/cdk/clipboard';
import { Component, inject, input, linkedSignal, signal } from '@angular/core';
import { type FieldTree, FormField } from '@angular/forms/signals';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatError, MatFormField, MatHint, MatLabel, MatSuffix } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInput } from '@angular/material/input';

import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from '../../data/admin/user-rules';
import { generatePassword } from './generate-password';

/**
 * The password of a new account or of a reset (5.1b): written or generated, shown or hidden, and
 * copied, because once the dialog closes nobody can read it again and it is handed over in person
 * (D-072).
 */
@Component({
  selector: 'app-password-field',
  imports: [
    FormField,
    MatFormField,
    MatLabel,
    MatHint,
    MatError,
    MatInput,
    MatSuffix,
    MatIcon,
    MatButton,
    MatIconButton,
  ],
  host: { class: 'flex flex-col gap-x-3 sm:flex-row sm:items-start' },
  template: `
    <mat-form-field class="min-w-0 sm:flex-1" subscriptSizing="dynamic">
      <mat-label>{{ label() }}</mat-label>
      <input
        matInput
        [formField]="field()"
        [type]="visible() ? 'text' : 'password'"
        autocomplete="new-password"
        spellcheck="false"
        class="font-mono"
      />
      <button
        matIconButton
        matSuffix
        type="button"
        [attr.aria-label]="visible() ? hideLabel : showLabel"
        [attr.aria-pressed]="visible()"
        (click)="visible.set(!visible())"
      >
        <mat-icon aria-hidden="true">{{ visible() ? 'visibility_off' : 'visibility' }}</mat-icon>
      </button>
      <button
        matIconButton
        matSuffix
        type="button"
        [attr.aria-label]="copyLabel"
        [disabled]="field()().value() === ''"
        (click)="copy()"
      >
        <mat-icon aria-hidden="true">{{ copied() ? 'check' : 'content_copy' }}</mat-icon>
      </button>
      <mat-hint i18n="@@userDialog.password.hint"
        >Entre {{ min }} y {{ max }} caracteres. La aplicación no envía correos: entrégasela en
        persona.</mat-hint
      >
      @if (field()().errors()[0]; as error) {
        <mat-error>{{ error.message }}</mat-error>
      }
    </mat-form-field>
    <!-- Next to the field, at the height of its box, not of its hint -->
    <button matButton="tonal" type="button" class="self-start sm:mt-2" (click)="generate()">
      <mat-icon aria-hidden="true">autorenew</mat-icon>
      <span i18n="@@userDialog.generate">Generar</span>
    </button>
  `,
})
export class PasswordField {
  private readonly clipboard = inject(Clipboard);
  private readonly announcer = inject(LiveAnnouncer);

  readonly field = input.required<FieldTree<string>>();
  readonly label = input.required<string>();

  protected readonly min = MIN_PASSWORD_LENGTH;
  protected readonly max = MAX_PASSWORD_LENGTH;
  // An interpolated i18n attribute is not set on a Material button: the labels go in code
  protected readonly showLabel = $localize`:@@userDialog.password.show:Mostrar la contraseña`;
  protected readonly hideLabel = $localize`:@@userDialog.password.hide:Ocultar la contraseña`;
  protected readonly copyLabel = $localize`:@@userDialog.password.copy:Copiar la contraseña`;

  protected readonly visible = signal(false);
  /** Until the password changes, the copy button says it is done. */
  protected readonly copied = linkedSignal({
    source: () => this.field()().value(),
    computation: () => false,
  });

  /** A generated password is shown: it is there to be read and handed over. */
  protected generate(): void {
    const field = this.field()();
    field.value.set(generatePassword());
    field.markAsTouched();
    this.visible.set(true);
  }

  protected copy(): void {
    this.copied.set(this.clipboard.copy(this.field()().value()));
    void this.announcer.announce(
      this.copied()
        ? $localize`:@@userDialog.password.copied:Contraseña copiada`
        : $localize`:@@userDialog.password.copyFailed:No se ha podido copiar: selecciónala y cópiala a mano`,
    );
  }
}
