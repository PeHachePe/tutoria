import { Component, computed, inject, signal } from '@angular/core';
import { form, FormField, FormRoot } from '@angular/forms/signals';
import { MatAutocomplete, MatAutocompleteTrigger } from '@angular/material/autocomplete';
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
import { MatButtonToggle, MatButtonToggleGroup } from '@angular/material/button-toggle';
import { MatOption } from '@angular/material/core';

import type { SchoolClassEntry } from '../../data/group-service';
import type { SchoolClass } from '../../data/user';
import { type ClassFormModel, classSchema, existingEntry, toClassFormModel } from './class-form';
import { groupActionMessage } from './group-action-message';
import { shiftSchoolYear } from '../../data/school-year';

/** Suggestions under the name: enough to find a class, not the whole school. */
const MAX_SUGGESTIONS = 8;

/** The class to edit, or null for a new one, and what the dialog needs to fill it. */
export interface ClassDialogData {
  readonly schoolClass: SchoolClass | null;
  /** Every class of the school: a new one with the name of another of its year is joined instead. */
  readonly classes: readonly SchoolClassEntry[];
  /** The current school year: a new class is for it or the next; one edited keeps its own. */
  readonly schoolYear: string;
  /** Creates or saves the class; the dialog stays open, with the error, if it fails. */
  readonly save: (model: ClassFormModel) => Promise<void>;
}

/**
 * A class of the school, by its name and year (5.2d, D-081): a new one, or one to edit. A class is
 * once per school: with the name of one that exists, the dialog offers to join it and closes with
 * it, for the page to choose the subjects; otherwise it saves, and closes with `true`. The subjects
 * are always added in one place, «Añadir asignaturas».
 */
@Component({
  selector: 'app-class-dialog',
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
    MatButtonToggleGroup,
    MatButtonToggle,
    MatOption,
    MatAutocomplete,
    MatAutocompleteTrigger,
  ],
  template: `
    <h2 mat-dialog-title>
      @if (data.schoolClass) {
        <span i18n="@@classDialog.edit">Editar la clase</span>
      } @else {
        <span i18n="@@classDialog.add">Añadir una clase</span>
      }
    </h2>
    <form [formRoot]="classForm">
      <mat-dialog-content>
        <div class="flex flex-col gap-2">
          <!-- Dynamic: the hint of an existing class takes two lines -->
          <mat-form-field subscriptSizing="dynamic">
            <mat-label i18n="@@classDialog.name">Nombre</mat-label>
            <input
              matInput
              [formField]="classForm.name"
              autocomplete="off"
              [matAutocomplete]="names"
              [matAutocompleteDisabled]="!!data.schoolClass"
            />
            <mat-autocomplete #names="matAutocomplete">
              @for (suggestion of suggestions(); track suggestion.id) {
                <mat-option [value]="suggestion.name">{{ suggestion.name }}</mat-option>
              }
            </mat-autocomplete>
            @if (classForm.name().touched() && classForm.name().errors()[0]; as error) {
              <mat-error>{{ error.message }}</mat-error>
            } @else if (teachersOfJoined(); as teachers) {
              <mat-hint i18n="@@classDialog.exists"
                >Esta clase ya existe (la dan {{ teachers }}): únete con tus asignaturas.</mat-hint
              >
            } @else if (joined()) {
              <mat-hint i18n="@@classDialog.existsEmpty"
                >Esta clase ya existe, sin asignaturas: únete con las tuyas.</mat-hint
              >
            } @else if (!data.schoolClass) {
              <mat-hint i18n="@@classDialog.name.hint"
                >Como 1.º DAW A. La comparten todos sus docentes.</mat-hint
              >
            }
          </mat-form-field>
          @if (data.schoolClass; as schoolClass) {
            <!-- A class keeps its year: its groups, blocks and dates are of it -->
            <p class="mt-2 text-body-medium text-on-surface-variant" i18n="@@classDialog.yearFixed">
              Curso {{ schoolClass.schoolYear }}: no cambia. Para otro curso, duplícala.
            </p>
          } @else {
            <!-- Chosen, never typed: a class is made for this year or, in summer, for the next -->
            <div class="mt-2 flex flex-col gap-2">
              <span id="class-year" class="text-body-medium" i18n="@@groupDialog.year">Curso</span>
              <mat-button-toggle-group
                aria-labelledby="class-year"
                hideSingleSelectionIndicator
                class="self-start"
                [value]="model().schoolYear"
                (change)="classForm.schoolYear().value.set($event.value)"
              >
                <mat-button-toggle [value]="years[0]" i18n="@@classDialog.thisYear"
                  >Este curso ({{ years[0] }})</mat-button-toggle
                >
                <mat-button-toggle [value]="years[1]" i18n="@@classDialog.nextYear"
                  >El que viene ({{ years[1] }})</mat-button-toggle
                >
              </mat-button-toggle-group>
            </div>
          }
          @if (failure(); as message) {
            <p class="mt-2 text-body-medium text-error" role="alert">{{ message }}</p>
          }
        </div>
      </mat-dialog-content>
      <mat-dialog-actions>
        <button matButton type="button" mat-dialog-close i18n="@@groupDialog.cancel">
          Cancelar
        </button>
        <button matButton="filled" type="submit" [disabled]="classForm().submitting()">
          @if (classForm().submitting()) {
            <span i18n="@@groupDialog.saving">Guardando…</span>
          } @else if (data.schoolClass) {
            <span i18n="@@groupDialog.save">Guardar</span>
          } @else if (joined()) {
            <span i18n="@@classDialog.joinButton">Unirme y elegir asignaturas</span>
          } @else {
            <span i18n="@@classDialog.createButton">Crear y elegir asignaturas</span>
          }
        </button>
      </mat-dialog-actions>
    </form>
  `,
})
export class ClassDialog {
  protected readonly data = inject<ClassDialogData>(MAT_DIALOG_DATA);
  private readonly ref = inject<MatDialogRef<ClassDialog, SchoolClassEntry | true>>(MatDialogRef);

  protected readonly failure = signal<string | null>(null);

  /** The current year and the next: a new class is for one of them. */
  protected readonly years = [this.data.schoolYear, shiftSchoolYear(this.data.schoolYear, 1)];

  private readonly model = signal(toClassFormModel(this.data.schoolClass, this.data.schoolYear));

  protected readonly classForm = form(this.model, classSchema, {
    submission: {
      action: async (field) => {
        // One that exists is joined: the page asks for the subjects next
        const joined = this.joined();
        if (joined) {
          this.ref.close(joined);
          return undefined;
        }
        this.failure.set(null);
        try {
          await this.data.save(field().value());
          this.ref.close(true);
        } catch (error) {
          this.failure.set(groupActionMessage('save', error));
        }
        return undefined;
      },
    },
  });

  /** The class that exists with the name and year of a new one: the user joins it. */
  protected readonly joined = computed(() =>
    this.data.schoolClass ? null : existingEntry(this.data.classes, this.model()),
  );

  /** Who teaches in the class joined, once each: «Javier Ortega Ruiz, Marta Ibáñez Soler». */
  protected readonly teachersOfJoined = computed(() => {
    const names = [...new Set(this.joined()?.groups.map(({ teacherName }) => teacherName) ?? [])];
    return names.length > 0 ? names.join(', ') : null;
  });

  /** The classes of the year whose name has what is typed. */
  protected readonly suggestions = computed(() => {
    const { name, schoolYear } = this.model();
    const text = name.trim().toLowerCase();
    return this.data.classes
      .map(({ schoolClass }) => schoolClass)
      .filter(
        (row) => row.schoolYear === schoolYear.trim() && row.name.toLowerCase().includes(text),
      )
      .slice(0, MAX_SUGGESTIONS);
  });
}
