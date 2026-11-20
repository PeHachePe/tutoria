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
import { MatOption, MatSelect } from '@angular/material/select';

import { LanguageService } from '../../core/i18n/language-service';
import type { UserRef } from '../../data/group-service';
import { subjectName } from '../../data/localized-text';
import type { Subject } from '../../data/subject';
import type { SchoolClass } from '../../data/user';
import {
  type ClassFormModel,
  classSchema,
  existingClass,
  newClassSchema,
  toClassFormModel,
} from './class-form';
import { groupActionMessage } from './group-action-message';
import { teacherChoices } from './group-form';

/** Suggestions under the name: enough to find a class, not the whole school. */
const MAX_SUGGESTIONS = 8;

/** The class to edit, or null for a new one, and what the dialog needs to fill it. */
export interface ClassDialogData {
  readonly schoolClass: SchoolClass | null;
  /** Every class of the school: a new one with the name of another of its year joins it. */
  readonly classes: readonly SchoolClass[];
  readonly subjects: readonly Subject[];
  /** The active teachers, for an administrator to choose one; null for a teacher. */
  readonly teachers: readonly UserRef[] | null;
  readonly schoolYear: string;
  /** A teacher's groups are their own; an administrator chooses one (undefined). */
  readonly teacherId: string | undefined;
  /** Saves the class; the dialog stays open, with the error, if it fails. */
  readonly save: (model: ClassFormModel) => Promise<void>;
}

/**
 * A class of the school (5.2d, D-081): a new one with the subjects the user teaches in it, each a
 * group that takes its students, or the name and year of an existing one. A class is once per school:
 * with the name of one that exists, the user joins it with their subjects.
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
    MatSelect,
    MatOption,
    MatAutocomplete,
    MatAutocompleteTrigger,
  ],
  template: `
    <h2 mat-dialog-title>
      @if (data.schoolClass) {
        <span i18n="@@classDialog.edit">Editar la clase</span>
      } @else {
        <span i18n="@@classDialog.new">Nueva clase</span>
      }
    </h2>
    <form [formRoot]="classForm">
      <mat-dialog-content>
        <div class="flex flex-col gap-2 sm:min-w-md">
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
            } @else if (joins()) {
              <mat-hint i18n="@@classDialog.joins"
                >Esta clase ya existe: tus asignaturas se añaden a ella.</mat-hint
              >
            } @else if (!data.schoolClass) {
              <mat-hint i18n="@@classDialog.name.hint"
                >Como 1.º DAW A. La comparten todos sus docentes.</mat-hint
              >
            }
          </mat-form-field>
          <mat-form-field class="mt-2">
            <mat-label i18n="@@groupDialog.year">Curso</mat-label>
            <input matInput [formField]="classForm.schoolYear" autocomplete="off" />
            <!-- Only while it is not right: under a right year it read as a second value -->
            @if (classForm.schoolYear().invalid()) {
              <mat-hint i18n="@@groupDialog.year.hint">Como 2026/27</mat-hint>
            }
            @if (classForm.schoolYear().errors()[0]; as error) {
              <mat-error>{{ error.message }}</mat-error>
            }
          </mat-form-field>
          @if (!data.schoolClass) {
            <mat-form-field>
              <mat-label i18n="@@classDialog.subjects">Tus asignaturas en ella</mat-label>
              <mat-select multiple [formField]="classForm.subjectIds">
                @for (subject of data.subjects; track subject.id) {
                  <mat-option [value]="subject.id">{{ nameOf(subject) }}</mat-option>
                }
              </mat-select>
              @if (classForm.subjectIds().errors()[0]; as error) {
                <mat-error>{{ error.message }}</mat-error>
              } @else {
                <mat-hint i18n="@@classDialog.subjects.hint"
                  >Un grupo en cada una, con el alumnado de la clase.</mat-hint
                >
              }
            </mat-form-field>
            @if (teachers; as teachers) {
              <mat-form-field class="mt-2">
                <mat-label i18n="@@groupDialog.teacher">Docente</mat-label>
                <mat-select [formField]="classForm.teacherId">
                  @for (teacher of teachers; track teacher.id) {
                    <mat-option [value]="teacher.id">{{ teacher.name }}</mat-option>
                  }
                </mat-select>
                @if (classForm.teacherId().errors()[0]; as error) {
                  <mat-error>{{ error.message }}</mat-error>
                }
              </mat-form-field>
            }
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
          } @else if (joins()) {
            <span i18n="@@classDialog.join">Añadir mis asignaturas</span>
          } @else {
            <span i18n="@@classDialog.create">Crear la clase</span>
          }
        </button>
      </mat-dialog-actions>
    </form>
  `,
})
export class ClassDialog {
  protected readonly data = inject<ClassDialogData>(MAT_DIALOG_DATA);
  private readonly ref = inject<MatDialogRef<ClassDialog, boolean>>(MatDialogRef);
  private readonly locale = inject(LanguageService).locale;

  /** For an administrator: the active teachers. */
  protected readonly teachers = this.data.teachers && teacherChoices(this.data.teachers, null);

  protected readonly failure = signal<string | null>(null);

  private readonly model = signal(
    toClassFormModel(this.data.schoolClass, {
      schoolYear: this.data.schoolYear,
      teacherId: this.data.teacherId,
    }),
  );

  protected readonly classForm = form(
    this.model,
    this.data.schoolClass ? classSchema : newClassSchema(this.data.classes),
    {
      submission: {
        action: async (field) => {
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
    },
  );

  /** A new class with the name and year of one that exists: the user joins it. */
  protected readonly joins = computed(
    () => !this.data.schoolClass && existingClass(this.data.classes, this.model()) !== null,
  );

  /** The classes of the year whose name has what is typed. */
  protected readonly suggestions = computed(() => {
    const { name, schoolYear } = this.model();
    const text = name.trim().toLowerCase();
    return this.data.classes
      .filter(
        (row) => row.schoolYear === schoolYear.trim() && row.name.toLowerCase().includes(text),
      )
      .slice(0, MAX_SUGGESTIONS);
  });

  protected nameOf(subject: Subject): string {
    return subjectName(subject, this.locale).name;
  }
}
