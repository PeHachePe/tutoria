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

import type { ManagedGroup, UserRef } from '../../data/group-service';
import { LanguageService } from '../../core/i18n/language-service';
import { subjectName } from '../../data/localized-text';
import type { Subject } from '../../data/subject';
import { groupActionMessage } from './group-action-message';
import {
  type GroupFormDefaults,
  type GroupFormModel,
  groupSchema,
  teacherChoices,
  toGroupFormModel,
} from './group-form';

/** The group to edit, or null for a new one, and what the dialog needs to fill it. */
export interface GroupDialogData {
  readonly managed: ManagedGroup | null;
  readonly subjects: readonly Subject[];
  /** The active teachers, for an administrator to choose one; null for a teacher. */
  readonly teachers: readonly UserRef[] | null;
  readonly defaults: GroupFormDefaults;
  /** Saves the group; the dialog stays open, with the error, if it fails. */
  readonly save: (model: GroupFormModel) => Promise<void>;
}

/**
 * A new group (name, year, subject and, for an administrator, teacher) or an existing one, whose
 * subject is only read: a group keeps it (5.2a).
 */
@Component({
  selector: 'app-group-dialog',
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
      @if (data.managed) {
        <span i18n="@@groupDialog.edit">Editar el grupo</span>
      } @else {
        <span i18n="@@groupDialog.new">Nuevo grupo</span>
      }
    </h2>
    <form [formRoot]="groupForm">
      <mat-dialog-content>
        <div class="flex flex-col gap-2 sm:min-w-md">
          <mat-form-field>
            <mat-label i18n="@@groupDialog.name">Nombre</mat-label>
            <input matInput [formField]="groupForm.name" autocomplete="off" />
            @if (groupForm.name().errors()[0]; as error) {
              <mat-error>{{ error.message }}</mat-error>
            }
          </mat-form-field>
          <mat-form-field>
            <mat-label i18n="@@groupDialog.year">Curso</mat-label>
            <input matInput [formField]="groupForm.schoolYear" autocomplete="off" />
            <!-- Only while it is not right: under a right year it read as a second value -->
            @if (groupForm.schoolYear().invalid()) {
              <mat-hint i18n="@@groupDialog.year.hint">Como 2026/27</mat-hint>
            }
            @if (groupForm.schoolYear().errors()[0]; as error) {
              <mat-error>{{ error.message }}</mat-error>
            }
          </mat-form-field>
          @if (data.managed; as managed) {
            <!-- Dynamic: the reason takes two lines -->
            <mat-form-field subscriptSizing="dynamic">
              <mat-label i18n="@@groupDialog.subject">Asignatura</mat-label>
              <input matInput [value]="nameOf(managed.subject)" readonly />
              <mat-hint i18n="@@groupDialog.subject.fixed"
                >Un grupo no cambia de asignatura: crea otro grupo para otra.</mat-hint
              >
            </mat-form-field>
          } @else {
            <mat-form-field>
              <mat-label i18n="@@groupDialog.subject">Asignatura</mat-label>
              <mat-select [formField]="groupForm.subjectId">
                @for (subject of data.subjects; track subject.id) {
                  <mat-option [value]="subject.id">{{ nameOf(subject) }}</mat-option>
                }
              </mat-select>
              @if (groupForm.subjectId().errors()[0]; as error) {
                <mat-error>{{ error.message }}</mat-error>
              }
            </mat-form-field>
          }
          @if (teachers; as teachers) {
            <mat-form-field>
              <mat-label i18n="@@groupDialog.teacher">Docente</mat-label>
              <mat-select [formField]="groupForm.teacherId">
                @for (teacher of teachers; track teacher.id) {
                  <mat-option [value]="teacher.id" [disabled]="teacher.disabled">{{
                    teacher.name
                  }}</mat-option>
                }
              </mat-select>
              @if (groupForm.teacherId().errors()[0]; as error) {
                <mat-error>{{ error.message }}</mat-error>
              }
            </mat-form-field>
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
        <button matButton="filled" type="submit" [disabled]="groupForm().submitting()">
          @if (groupForm().submitting()) {
            <span i18n="@@groupDialog.saving">Guardando…</span>
          } @else if (data.managed) {
            <span i18n="@@groupDialog.save">Guardar</span>
          } @else {
            <span i18n="@@groupDialog.create">Crear el grupo</span>
          }
        </button>
      </mat-dialog-actions>
    </form>
  `,
})
export class GroupDialog {
  protected readonly data = inject<GroupDialogData>(MAT_DIALOG_DATA);
  private readonly ref = inject<MatDialogRef<GroupDialog, boolean>>(MatDialogRef);

  /** For an administrator: the active teachers, and the group's own if it was disabled. */
  protected readonly teachers =
    this.data.teachers && teacherChoices(this.data.teachers, this.data.managed);

  /** What the server said when saving failed, or null. */
  protected readonly failure = signal<string | null>(null);

  private readonly model = signal(toGroupFormModel(this.data.managed, this.data.defaults));

  protected readonly groupForm = form(this.model, groupSchema, {
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

  private readonly locale = inject(LanguageService).locale;

  protected nameOf(subject: Subject): string {
    return subjectName(subject, this.locale).name;
  }
}
