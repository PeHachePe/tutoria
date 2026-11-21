import { Component, computed, inject, signal } from '@angular/core';
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

import { LANGUAGE_OPTIONS } from '../../core/i18n/locale';
import { LOCALE_NAMES } from '../../core/i18n/locale-names';
import type { SubjectDraft } from '../../data/admin-service';
import type { ContentLocale } from '../../data/localized-text';
import type { Subject } from '../../data/subject';
import {
  subjectSchema,
  takenSubjectNames,
  toSubjectDraft,
  toSubjectFormModel,
} from './subject-form';

/** The subject to edit, or null for a new one, and the language of the interface. */
export interface SubjectDialogData {
  readonly subject: Subject | null;
  /** Every subject, to turn down a name another one already shows. */
  readonly subjects: readonly Subject[];
  readonly locale: ContentLocale;
  /** Saves the subject; the dialog stays open, with the error, if it fails. */
  readonly save: (draft: SubjectDraft) => Promise<void>;
}

/**
 * Creates a subject or changes its name and its translations (5.3b, 2.5c), as `BlockDialog`: the
 * name is required in the language it is written in; the others are optional translations (D-045).
 */
@Component({
  selector: 'app-subject-dialog',
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
  ],
  template: `
    <h2 mat-dialog-title>
      @if (data.subject) {
        <span i18n="@@subjectDialog.edit">Editar la asignatura</span>
      } @else {
        <span i18n="@@subjectDialog.new">Nueva asignatura</span>
      }
    </h2>
    <form [formRoot]="subjectForm">
      <mat-dialog-content>
        <div class="flex flex-col gap-2 app-form-dialog">
          @let name = source();
          <mat-form-field>
            <mat-label i18n="@@subjectDialog.name">Nombre</mat-label>
            <input matInput [formField]="name.field" [attr.lang]="name.locale" />
            <mat-hint i18n="@@subjectDialog.name.hint">Como «Programación básica»</mat-hint>
            @if (name.field().errors()[0]; as error) {
              <mat-error>{{ error.message }}</mat-error>
            }
          </mat-form-field>
          <mat-form-field>
            <mat-label i18n="@@subjectDialog.source">Idioma en que lo escribes</mat-label>
            <mat-select [formField]="subjectForm.sourceLocale">
              @for (language of languages; track language.locale) {
                <mat-option [value]="language.locale" [attr.lang]="language.locale">{{
                  language.label
                }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
          @for (language of translations(); track language.locale) {
            <mat-form-field>
              <mat-label i18n="@@subjectDialog.translation"
                >Nombre en {{ language.label }}</mat-label
              >
              <input matInput [formField]="language.field" [attr.lang]="language.locale" />
              <mat-hint i18n="@@subjectDialog.translation.hint"
                >Opcional: sin él, se ve el original</mat-hint
              >
            </mat-form-field>
          }
          @if (failed()) {
            <p class="text-body-medium text-error" role="alert" i18n="@@subjectDialog.failed">
              No se ha podido guardar. Inténtalo de nuevo.
            </p>
          }
        </div>
      </mat-dialog-content>
      <mat-dialog-actions>
        <button matButton type="button" mat-dialog-close i18n="@@subjectDialog.cancel">
          Cancelar
        </button>
        <button matButton="filled" type="submit" [disabled]="subjectForm().submitting()">
          @if (subjectForm().submitting()) {
            <span i18n="@@subjectDialog.saving">Guardando…</span>
          } @else if (data.subject) {
            <span i18n="@@subjectDialog.save">Guardar</span>
          } @else {
            <span i18n="@@subjectDialog.create">Crear la asignatura</span>
          }
        </button>
      </mat-dialog-actions>
    </form>
  `,
})
export class SubjectDialog {
  protected readonly data = inject<SubjectDialogData>(MAT_DIALOG_DATA);
  private readonly ref = inject<MatDialogRef<SubjectDialog, boolean>>(MatDialogRef);

  protected readonly languages = LANGUAGE_OPTIONS;
  protected readonly failed = signal(false);

  private readonly model = signal(toSubjectFormModel(this.data.subject, this.data.locale));

  private readonly taken = takenSubjectNames(this.data.subjects, this.data.subject?.id ?? null);

  protected readonly subjectForm = form(
    this.model,
    subjectSchema(() => this.taken),
    {
      submission: {
        action: async (field) => {
          this.failed.set(false);
          try {
            await this.data.save(toSubjectDraft(field().value(), this.data.subject?.id ?? null));
            this.ref.close(true);
          } catch {
            this.failed.set(true);
          }
          return undefined;
        },
      },
    },
  );

  /** The name in the language it is written in. */
  protected readonly source = computed(() => {
    const locale = this.subjectForm.sourceLocale().value();
    return { locale, field: this.subjectForm.names[locale] };
  });

  /** The names in the other languages, optional. */
  protected readonly translations = computed(() =>
    LANGUAGE_OPTIONS.filter(({ locale }) => locale !== this.source().locale).map(({ locale }) => ({
      locale,
      label: LOCALE_NAMES[locale],
      field: this.subjectForm.names[locale],
    })),
  );
}
