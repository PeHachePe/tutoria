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

import { LanguageService } from '../../core/i18n/language-service';
import type { ManagedGroup, UserRef } from '../../data/group-service';
import { subjectName } from '../../data/localized-text';
import type { Subject } from '../../data/subject';
import { nextSplitLabel } from './class-list';
import { groupActionMessage } from './group-action-message';
import { type GroupFormModel, groupSchema, teacherChoices, toGroupFormModel } from './group-form';

/** The group to edit, or null for a new subject of the class, and what the dialog needs. */
export interface GroupDialogData {
  /** «1.º DAW A · 2026/27». */
  readonly className: string;
  readonly managed: ManagedGroup | null;
  /** The other groups of the class: a subject it has needs the label of a split. */
  readonly siblings: readonly ManagedGroup[];
  readonly subjects: readonly Subject[];
  /** The active teachers, for an administrator to choose one; null for a teacher. */
  readonly teachers: readonly UserRef[] | null;
  /** A teacher's groups are their own; an administrator chooses one (undefined). */
  readonly teacherId: string | undefined;
  /** Saves the group; the dialog stays open, with the error, if it fails. */
  readonly save: (model: GroupFormModel) => Promise<void>;
}

/**
 * A subject of a class (5.2d, D-081): a new group, which takes the students of the class, or a split
 * of a subject it already has, with its label («Desdoble 2» at first) and the students chosen later.
 * Of an existing group, the subject is only read: a group keeps it (5.2a).
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
        <span i18n="@@groupDialog.edit.of"
          >Editar {{ data.className }} · {{ subjectOf(data.managed.subject) }}</span
        >
      } @else {
        <span i18n="@@groupDialog.add">Añadir una asignatura a {{ data.className }}</span>
      }
    </h2>
    <form [formRoot]="groupForm">
      <mat-dialog-content>
        <div class="flex flex-col gap-2 sm:min-w-md">
          @if (data.managed; as managed) {
            <!-- Dynamic: the reason takes two lines -->
            <mat-form-field subscriptSizing="dynamic">
              <mat-label i18n="@@groupDialog.subject">Asignatura</mat-label>
              <input matInput [value]="subjectOf(managed.subject)" readonly />
              <mat-hint i18n="@@groupDialog.subject.fixed"
                >Un grupo no cambia de asignatura: crea otro grupo para otra.</mat-hint
              >
            </mat-form-field>
          } @else {
            <mat-form-field>
              <mat-label i18n="@@groupDialog.subject">Asignatura</mat-label>
              <mat-select [formField]="groupForm.subjectId" (selectionChange)="subjectChosen()">
                @for (subject of data.subjects; track subject.id) {
                  <mat-option [value]="subject.id">{{ subjectOf(subject) }}</mat-option>
                }
              </mat-select>
              @if (groupForm.subjectId().errors()[0]; as error) {
                <mat-error>{{ error.message }}</mat-error>
              }
            </mat-form-field>
          }
          <!-- Dynamic: its hint takes two lines on a phone -->
          <mat-form-field subscriptSizing="dynamic">
            <mat-label i18n="@@groupDialog.label">Nombre del desdoble</mat-label>
            <input matInput [formField]="groupForm.label" autocomplete="off" />
            @if (groupForm.label().errors()[0]; as error) {
              <mat-error>{{ error.message }}</mat-error>
            } @else if (isSplit()) {
              <mat-hint i18n="@@groupDialog.label.split"
                >La clase ya tiene esta asignatura. Sus alumnos se eligen después.</mat-hint
              >
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
            <span i18n="@@groupDialog.addSubmit">Añadir</span>
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

  private readonly model = signal(toGroupFormModel(this.data.managed, this.data.teacherId));

  protected readonly groupForm = form(this.model, groupSchema(this.data.siblings), {
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

  /** A new group of a subject the class already has: a split. */
  protected readonly isSplit = computed(
    () =>
      !this.data.managed &&
      this.data.siblings.some(({ group }) => group.subjectId === this.model().subjectId),
  );

  /** The label of a split starts as «Desdoble 2»; that of the whole class, empty. */
  protected subjectChosen(): void {
    this.groupForm
      .label()
      .value.set(nextSplitLabel(this.data.siblings, this.model().subjectId) ?? '');
  }

  protected subjectOf(subject: Subject): string {
    return subjectName(subject, this.locale).name;
  }
}
