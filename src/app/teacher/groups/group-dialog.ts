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

import { LanguageService } from '../../core/i18n/language-service';
import type { ClassSubject, ManagedGroup, UserRef } from '../../data/group-service';
import { subjectName } from '../../data/localized-text';
import { groupActionMessage } from './group-action-message';
import { type GroupFormModel, groupSchema, teacherChoices, toGroupFormModel } from './group-form';

/** The group to edit and what the dialog needs. */
export interface GroupDialogData {
  /** «1.º DAW A · 2026/27». */
  readonly className: string;
  readonly managed: ManagedGroup;
  /** The other groups of the class, of any teacher: a split needs a name of its own. */
  readonly classSubjects: readonly ClassSubject[];
  /** The active teachers, for an administrator to hand the group over; null for a teacher. */
  readonly teachers: readonly UserRef[] | null;
  /** Saves the group; the dialog stays open, with the error, if it fails. */
  readonly save: (model: GroupFormModel) => Promise<void>;
}

/**
 * A group of a class (5.2d, D-081): the name of its split and, for an administrator, its teacher.
 * Its subject is only read: a group keeps it (5.2a). New groups are added in «Añadir asignaturas».
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
      <span i18n="@@groupDialog.edit.of">Editar {{ data.className }} · {{ subjectOf() }}</span>
    </h2>
    <form [formRoot]="groupForm">
      <mat-dialog-content>
        <div class="flex flex-col gap-2">
          <!-- Dynamic: the reason takes two lines -->
          <mat-form-field subscriptSizing="dynamic">
            <mat-label i18n="@@groupDialog.subject">Asignatura</mat-label>
            <input matInput [value]="subjectOf()" readonly />
            <mat-hint i18n="@@groupDialog.subject.fixed"
              >Un grupo no cambia de asignatura: crea otro grupo para otra.</mat-hint
            >
          </mat-form-field>
          <!-- Dynamic: its hint takes two lines on a phone -->
          <mat-form-field subscriptSizing="dynamic" class="mt-2">
            <mat-label i18n="@@groupDialog.label">Nombre del desdoble</mat-label>
            <input matInput [formField]="groupForm.label" autocomplete="off" />
            @if (groupForm.label().errors()[0]; as error) {
              <mat-error>{{ error.message }}</mat-error>
            } @else {
              <mat-hint i18n="@@groupDialog.label.hint"
                >Opcional: para distinguir un desdoble, como «Desdoble inglés».</mat-hint
              >
            }
          </mat-form-field>
          @if (teachers; as teachers) {
            <mat-form-field class="mt-2">
              <mat-label i18n="@@groupDialog.teacher">Docente</mat-label>
              <mat-select [formField]="groupForm.teacherId">
                @for (teacher of teachers; track teacher.id) {
                  <mat-option [value]="teacher.id" [disabled]="teacher.disabled">{{
                    teacher.name
                  }}</mat-option>
                }
              </mat-select>
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
          } @else {
            <span i18n="@@groupDialog.save">Guardar</span>
          }
        </button>
      </mat-dialog-actions>
    </form>
  `,
})
export class GroupDialog {
  protected readonly data = inject<GroupDialogData>(MAT_DIALOG_DATA);
  private readonly ref = inject<MatDialogRef<GroupDialog, boolean>>(MatDialogRef);
  private readonly locale = inject(LanguageService).locale;

  /** For an administrator: the active teachers, and the group's own if it was disabled. */
  protected readonly teachers =
    this.data.teachers && teacherChoices(this.data.teachers, this.data.managed);

  /** What the server said when saving failed, or null. */
  protected readonly failure = signal<string | null>(null);

  private readonly model = signal(toGroupFormModel(this.data.managed));

  protected readonly groupForm = form(
    this.model,
    groupSchema(this.data.classSubjects, this.data.managed.group.subjectId),
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

  protected subjectOf(): string {
    return subjectName(this.data.managed.subject, this.locale).name;
  }
}
