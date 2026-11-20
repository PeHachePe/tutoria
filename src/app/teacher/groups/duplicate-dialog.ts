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
import { MatError, MatFormField, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatOption, MatSelect } from '@angular/material/select';

import { LanguageService } from '../../core/i18n/language-service';
import type { ManagedGroup } from '../../data/group-service';
import type { SchoolClass } from '../../data/user';
import { datesNote } from '../../shared/dates-note';
import { subjectLine } from './class-list';
import { type DuplicateFormModel, duplicateSchema, toDuplicateFormModel } from './duplicate-form';
import { groupActionMessage } from './group-action-message';
import { schoolYearChoices } from './school-year';

export interface DuplicateDialogData {
  readonly source: SchoolClass;
  /** The groups of the class the user may copy: their own, or all for an administrator. */
  readonly groups: readonly ManagedGroup[];
  readonly today: Date;
  /** Duplicates them; the dialog stays open, with the error, if it fails. */
  readonly save: (model: DuplicateFormModel) => Promise<void>;
}

/**
 * «Duplicar» a class for the next year or a parallel one (5.2c; 5.2d, D-081): the class with the name
 * and year given (created, or joined if it exists) gets a copy of each group chosen, with its subject,
 * label and teacher and, if wanted, its blocks (with their dates moved to the new year or without
 * them) and its students. The other teachers add their subjects to it later.
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
    MatError,
    MatInput,
    MatSelect,
    MatOption,
  ],
  template: `
    <h2 mat-dialog-title i18n="@@duplicateDialog.title">
      Duplicar {{ data.source.name }} · {{ data.source.schoolYear }}
    </h2>
    <form [formRoot]="duplicateForm">
      <mat-dialog-content>
        <div class="flex flex-col gap-2 sm:min-w-md">
          <p class="mb-2 text-body-medium text-on-surface-variant" i18n="@@duplicateDialog.intro">
            Copia tus asignaturas en la clase del curso que viene o en una paralela, con lo que
            elijas traer. Si esa clase ya existe, se añaden a ella.
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
            <!-- Chosen, never typed: the one before, the one given and the one after -->
            <mat-select [formField]="duplicateForm.schoolYear">
              @for (year of years; track year) {
                <mat-option [value]="year">{{ year }}</mat-option>
              }
            </mat-select>
          </mat-form-field>

          <fieldset class="flex flex-col">
            <legend class="mb-1 text-title-small" i18n="@@duplicateDialog.subjects">
              Asignaturas
            </legend>
            @for (managed of data.groups; track managed.group.id) {
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
            <p
              class="ms-10 text-body-small text-on-surface-variant"
              i18n="@@duplicateDialog.students.hint"
            >
              Sin él, la clase nueva empieza vacía: un curso nuevo es otra clase.
            </p>
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
            <span i18n="@@duplicateDialog.submit.class">{chosenCount(), plural,
              =0 {Duplicar}
              =1 {Copiar 1 asignatura}
              other {Copiar {{ chosenCount() }} asignaturas}
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

  protected readonly failure = signal<string | null>(null);

  private readonly model = signal(
    toDuplicateFormModel(this.data.source, this.data.groups, this.data.today),
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

  /** Around the year it starts with: the next one, or the current one for an older class. */
  protected readonly years = schoolYearChoices(this.model().schoolYear);

  protected readonly chosenCount = computed(() => this.model().groupIds.length);

  protected readonly datesNote = computed(() =>
    datesNote(this.data.source.schoolYear, this.model().schoolYear.trim()),
  );

  protected nameOf(managed: ManagedGroup): string {
    return subjectLine(managed, this.locale);
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
      .value.set(this.data.groups.map(({ group }) => group.id).filter((id) => chosen.has(id)));
    this.duplicateForm.groupIds().markAsTouched();
  }
}
