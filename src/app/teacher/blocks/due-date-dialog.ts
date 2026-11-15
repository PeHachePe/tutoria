import { Component, inject, signal } from '@angular/core';
import { form, FormField, FormRoot, required } from '@angular/forms/signals';
import { MatButton } from '@angular/material/button';
import {
  MatDatepicker,
  MatDatepickerInput,
  MatDatepickerToggle,
} from '@angular/material/datepicker';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogClose,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle,
} from '@angular/material/dialog';
import { MatError, MatFormField, MatHint, MatLabel, MatSuffix } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import {
  MatTimepicker,
  MatTimepickerInput,
  MatTimepickerToggle,
} from '@angular/material/timepicker';

import { provideLocalizedDateAdapter } from '../../core/i18n/localized-date-adapter';
import { DEFAULT_DUE_TIME, withTime } from '../../shared/due-date';

/** The exercise whose due date is chosen, and the date it has. */
export interface DueDateDialogData {
  readonly title: string;
  /** In the language of the title, if it is not that of the interface. */
  readonly lang: string | null;
  readonly dueAt: string | null;
}

/** What the dialog gives back: an ISO date, null to remove it, or undefined if it was cancelled. */
export type DueDateDialogResult = string | null | undefined;

interface DueDateModel {
  readonly day: Date | null;
  readonly time: Date | null;
}

/**
 * Chooses the optional due date of an assignment (4.3b, D-054): a day and, if the teacher wants, a
 * time; without one, the end of the day. The students see it in the catalog.
 */
@Component({
  selector: 'app-due-date-dialog',
  // Only this dialog chooses dates; the adapter takes the language of the build (LOCALE_ID)
  providers: [provideLocalizedDateAdapter()],
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
    MatSuffix,
    MatInput,
    MatDatepicker,
    MatDatepickerInput,
    MatDatepickerToggle,
    MatTimepicker,
    MatTimepickerInput,
    MatTimepickerToggle,
  ],
  template: `
    <h2 mat-dialog-title i18n="@@dueDate.title">Fecha de entrega</h2>
    <form [formRoot]="dueForm">
      <mat-dialog-content>
        <div class="flex flex-col gap-2">
          <p class="mb-2 text-body-medium text-on-surface-variant" [attr.lang]="data.lang">
            {{ data.title }}
          </p>
          <mat-form-field>
            <mat-label i18n="@@dueDate.day">Día</mat-label>
            <input matInput [matDatepicker]="dayPicker" [formField]="dueForm.day" />
            <mat-datepicker-toggle matIconSuffix [for]="dayPicker" />
            <mat-datepicker #dayPicker />
            @if (dueForm.day().errors()[0]; as error) {
              <mat-error>{{ error.message }}</mat-error>
            }
          </mat-form-field>
          <mat-form-field>
            <mat-label i18n="@@dueDate.time">Hora</mat-label>
            <input matInput [matTimepicker]="timePicker" [formField]="dueForm.time" />
            <mat-timepicker-toggle matIconSuffix [for]="timePicker" />
            <mat-timepicker #timePicker />
            <mat-hint i18n="@@dueDate.time.hint"
              >Sin hora, al final del día ({{ endOfDay }})</mat-hint
            >
          </mat-form-field>
        </div>
      </mat-dialog-content>
      <mat-dialog-actions>
        @if (data.dueAt) {
          <button
            matButton
            type="button"
            class="me-auto"
            [mat-dialog-close]="null"
            i18n="@@dueDate.remove"
          >
            Quitar la fecha
          </button>
        }
        <!-- Without a value, mat-dialog-close would give back an empty string: a date for the caller -->
        <button matButton type="button" [mat-dialog-close]="undefined" i18n="@@dueDate.cancel">
          Cancelar
        </button>
        <button matButton="filled" type="submit" i18n="@@dueDate.save">Guardar</button>
      </mat-dialog-actions>
    </form>
  `,
})
export class DueDateDialog {
  protected readonly data = inject<DueDateDialogData>(MAT_DIALOG_DATA);
  private readonly ref = inject<MatDialogRef<DueDateDialog, DueDateDialogResult>>(MatDialogRef);

  protected readonly endOfDay = `${DEFAULT_DUE_TIME.hours}:${DEFAULT_DUE_TIME.minutes}`;

  private readonly model = signal<DueDateModel>(
    this.data.dueAt
      ? { day: new Date(this.data.dueAt), time: new Date(this.data.dueAt) }
      : { day: null, time: null },
  );

  protected readonly dueForm = form(
    this.model,
    (path) => {
      required(path.day, { message: $localize`:@@dueDate.error.day:Elige el día` });
    },
    {
      submission: {
        action: async (field) => {
          const { day, time } = field().value();
          // Required: a valid form always has the day
          this.ref.close(withTime(day as Date, time).toISOString());
        },
      },
    },
  );
}
