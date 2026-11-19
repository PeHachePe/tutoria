import { Component, computed, inject, signal } from '@angular/core';
import { form, FormField, FormRoot } from '@angular/forms/signals';
import { MatButton } from '@angular/material/button';
import { MatCheckbox } from '@angular/material/checkbox';
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
import type { ManagedGroup, UserRef } from '../../data/group-service';
import { subjectName } from '../../data/localized-text';
import { datesNote } from '../../shared/dates-note';
import { type DuplicateFormModel, duplicateSchema, toDuplicateFormModel } from './duplicate-form';
import { groupActionMessage } from './group-action-message';
import { teacherChoices } from './group-form';

export interface DuplicateDialogData {
  /** The group whose menu was used. */
  readonly source: ManagedGroup;
  /** The groups of its class (the same name and year), the source first. */
  readonly classGroups: readonly ManagedGroup[];
  /** The active teachers, for an administrator to choose one; null for a teacher. */
  readonly teachers: readonly UserRef[] | null;
  /** A teacher's groups are their own; an administrator chooses one (undefined). */
  readonly teacherId: string | undefined;
  readonly today: Date;
  /** Duplicates them; the dialog stays open, with the error, if it fails. */
  readonly save: (model: DuplicateFormModel) => Promise<void>;
}

/**
 * «Duplicar» a class for the next year or a parallel group (5.2c, D-079): a new group for each
 * subject chosen, with the name, year and teacher given and, if wanted, the blocks of each (with
 * their dates moved to the new year or without them) and its students.
 */
@Component({
  selector: 'app-duplicate-dialog',
  imports: [
    FormRoot,
    FormField,
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions,
    MatDialogClose,
    MatButton,
    MatCheckbox,
    MatFormField,
    MatLabel,
    MatHint,
    MatError,
    MatInput,
    MatSelect,
    MatOption,
  ],
  template: `
    <h2 mat-dialog-title i18n="@@duplicateDialog.title">
      Duplicar {{ data.source.group.name }} · {{ data.source.group.schoolYear }}
    </h2>
    <form [formRoot]="duplicateForm">
      <mat-dialog-content>
        <div class="flex flex-col gap-2 sm:min-w-md">
          <p class="mb-2 text-body-medium text-on-surface-variant" i18n="@@duplicateDialog.intro">
            Crea sus grupos en otro curso o en un grupo paralelo, con lo que elijas traer.
          </p>
          <mat-form-field>
            <mat-label i18n="@@groupDialog.name">Nombre</mat-label>
            <input matInput [formField]="duplicateForm.name" autocomplete="off" />
            @if (duplicateForm.name().errors()[0]; as error) {
              <mat-error>{{ error.message }}</mat-error>
            }
          </mat-form-field>
          <mat-form-field>
            <mat-label i18n="@@groupDialog.year">Curso</mat-label>
            <input matInput [formField]="duplicateForm.schoolYear" autocomplete="off" />
            @if (duplicateForm.schoolYear().invalid()) {
              <mat-hint i18n="@@groupDialog.year.hint">Como 2026/27</mat-hint>
            }
            @if (duplicateForm.schoolYear().errors()[0]; as error) {
              <mat-error>{{ error.message }}</mat-error>
            }
          </mat-form-field>
          @if (teachers; as teachers) {
            <mat-form-field>
              <mat-label i18n="@@groupDialog.teacher">Docente</mat-label>
              <mat-select [formField]="duplicateForm.teacherId">
                @for (teacher of teachers; track teacher.id) {
                  <mat-option [value]="teacher.id">{{ teacher.name }}</mat-option>
                }
              </mat-select>
              @if (duplicateForm.teacherId().errors()[0]; as error) {
                <mat-error>{{ error.message }}</mat-error>
              }
            </mat-form-field>
          }

          <fieldset class="flex flex-col">
            <legend class="mb-1 text-title-small" i18n="@@duplicateDialog.subjects">
              Asignaturas
            </legend>
            @for (managed of data.classGroups; track managed.group.id) {
              <mat-checkbox [checked]="isChosen(managed)" (change)="toggle(managed)">
                <!-- A space Angular keeps between the two: whitespace alone between tags is dropped -->
                <span>{{ nameOf(managed) }}</span
                >&ngsp;
                <span i18n="@@duplicateDialog.subject.students">{managed.studentCount, plural,
                  =0 {(sin alumnos)}
                  =1 {(1 alumno)}
                  other {({{ managed.studentCount }} alumnos)}
                }</span>
              </mat-checkbox>
            }
            @if (
              duplicateForm.groupIds().touched() && duplicateForm.groupIds().errors()[0];
              as error
            ) {
              <p class="text-body-small text-error" role="alert">{{ error.message }}</p>
            }
          </fieldset>

          <fieldset class="mt-2 flex flex-col">
            <legend class="mb-1 text-title-small" i18n="@@duplicateDialog.bring">Qué traer</legend>
            <mat-checkbox [formField]="duplicateForm.blocks" i18n="@@duplicateDialog.blocks"
              >Sus bloques, con sus ejercicios, orden y visibilidad</mat-checkbox
            >
            <div class="ms-8 flex flex-col">
              <mat-checkbox
                [formField]="duplicateForm.dates"
                aria-describedby="duplicate-dates-note"
                i18n="@@duplicateDialog.dates"
                >Con sus fechas</mat-checkbox
              >
              <p id="duplicate-dates-note" class="ms-10 text-body-small text-on-surface-variant">
                @if (!duplicateForm.blocks().value()) {
                  <span i18n="@@duplicateDialog.dates.noBlocks">Solo con los bloques.</span>
                } @else if (!duplicateForm.dates().value()) {
                  <span i18n="@@duplicateDialog.dates.none"
                    >Los bloques llegan sin fechas de apertura ni de entrega.</span
                  >
                } @else {
                  {{ datesNote() }}
                }
              </p>
            </div>
            <mat-checkbox [formField]="duplicateForm.students" i18n="@@duplicateDialog.students"
              >Su alumnado (las cuentas activas)</mat-checkbox
            >
          </fieldset>

          @if (failure(); as message) {
            <p class="mt-2 text-body-medium text-error" role="alert">{{ message }}</p>
          }
        </div>
      </mat-dialog-content>
      <mat-dialog-actions>
        <button matButton type="button" mat-dialog-close i18n="@@groupDialog.cancel">
          Cancelar
        </button>
        <button matButton="filled" type="submit" [disabled]="duplicateForm().submitting()">
          @if (duplicateForm().submitting()) {
            <span i18n="@@duplicateDialog.saving">Duplicando…</span>
          } @else {
            <span i18n="@@duplicateDialog.submit">{chosenCount(), plural,
              =0 {Duplicar}
              =1 {Crear el grupo}
              other {Crear {{ chosenCount() }} grupos}
            }</span>
          }
        </button>
      </mat-dialog-actions>
    </form>
  `,
})
export class DuplicateDialog {
  protected readonly data = inject<DuplicateDialogData>(MAT_DIALOG_DATA);
  private readonly ref = inject<MatDialogRef<DuplicateDialog, boolean>>(MatDialogRef);
  private readonly locale = inject(LanguageService).locale;

  /** For an administrator: the active teachers. */
  protected readonly teachers = this.data.teachers && teacherChoices(this.data.teachers, null);

  protected readonly failure = signal<string | null>(null);

  private readonly model = signal(
    toDuplicateFormModel(
      this.data.source,
      this.data.classGroups,
      this.data.teachers,
      this.data.teacherId,
      this.data.today,
    ),
  );

  protected readonly duplicateForm = form(this.model, duplicateSchema, {
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
  });

  protected readonly chosenCount = computed(() => this.model().groupIds.length);

  protected readonly datesNote = computed(() =>
    datesNote(this.data.source.group.schoolYear, this.model().schoolYear.trim()),
  );

  protected nameOf(managed: ManagedGroup): string {
    return subjectName(managed.subject, this.locale).name;
  }

  protected isChosen(managed: ManagedGroup): boolean {
    return this.model().groupIds.includes(managed.group.id);
  }

  /** Keeps the order of the class, whatever the order of the clicks. */
  protected toggle(managed: ManagedGroup): void {
    const chosen = new Set(this.model().groupIds);
    if (chosen.has(managed.group.id)) chosen.delete(managed.group.id);
    else chosen.add(managed.group.id);
    this.duplicateForm
      .groupIds()
      .value.set(this.data.classGroups.map(({ group }) => group.id).filter((id) => chosen.has(id)));
    this.duplicateForm.groupIds().markAsTouched();
  }
}
