import { Component, computed, inject, signal } from '@angular/core';
import { form, FormField, FormRoot } from '@angular/forms/signals';
import { MatButton, MatIconButton } from '@angular/material/button';
import { MatButtonToggle, MatButtonToggleGroup } from '@angular/material/button-toggle';
import { MatCheckbox } from '@angular/material/checkbox';
import {
  MAT_DIALOG_DATA,
  MatDialogActions,
  MatDialogClose,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle,
} from '@angular/material/dialog';
import { MatError, MatFormField, MatLabel, MatPrefix } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInput } from '@angular/material/input';
import { MatOption, MatSelect } from '@angular/material/select';

import { LanguageService } from '../../core/i18n/language-service';
import type { ClassSubject, GroupDraft, UserRef } from '../../data/group-service';
import { subjectName } from '../../data/localized-text';
import type { Subject } from '../../data/subject';
import { nextSplitLabel } from './class-list';
import { groupActionMessage } from './group-action-message';
import { teacherChoices } from './group-form';
import { hasWholeGroup, subjectsSchema, toGroupDrafts, toSubjectsFormModel } from './subjects-form';

/** What «Añadir asignaturas» needs: the class, its groups, the subjects and how to add one. */
export interface SubjectsDialogData {
  /** «1.º DAW A · 2026/27». */
  readonly className: string;
  /** The groups of the class, of any teacher: a subject it has for the whole class is a split. */
  readonly classSubjects: readonly ClassSubject[];
  readonly subjects: readonly Subject[];
  /** The active teachers, for an administrator to choose one; null for a teacher. */
  readonly teachers: readonly UserRef[] | null;
  /** A teacher's groups are their own; an administrator chooses one (undefined). */
  readonly teacherId: string | undefined;
  /** The name of the user, who teaches what they add: read only when it is needed. */
  readonly userName: () => string;
  /** Adds one group; the dialog stays open, with the error, if it fails. */
  readonly add: (draft: GroupDraft) => Promise<void>;
}

/**
 * The one place where subjects are added to a class (5.2d, D-081): a list of the subjects of the
 * school to choose from, as «Matricular» lists students, and below the chosen ones, each the group
 * of the whole class (it takes the students of the class) or a split, with its name, which starts
 * empty. One the class has for the whole class is only a split. They are added one by one: if one fails, those added leave the list and
 * the rest wait for another try. Closes with `true` once all are in.
 */
@Component({
  selector: 'app-subjects-dialog',
  imports: [
    FormRoot,
    FormField,
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions,
    MatDialogClose,
    MatButton,
    MatIconButton,
    MatButtonToggleGroup,
    MatButtonToggle,
    MatCheckbox,
    MatFormField,
    MatLabel,
    MatPrefix,
    MatIcon,
    MatError,
    MatInput,
    MatSelect,
    MatOption,
  ],
  // A column as tall as the dialog: the list takes what the title, the teacher and the actions leave
  host: { class: 'flex h-full min-h-0 flex-col' },
  template: `
    <h2 mat-dialog-title i18n="@@groupDialog.addMany">Añadir asignaturas a {{ data.className }}</h2>
    <form [formRoot]="subjectsForm" class="flex min-h-0 flex-1 flex-col">
      <mat-dialog-content>
        <div class="flex min-h-0 flex-1 flex-col gap-3">
          <p class="text-body-medium text-on-surface-variant" i18n="@@subjectsDialog.intro">
            Para toda la clase, el grupo toma su alumnado; un desdoble empieza vacío.
          </p>
          <!-- As «Matricular»: the list to choose from, with its filter in the same row -->
          <div class="flex flex-wrap items-center justify-between gap-2">
            <span class="text-title-small" i18n="@@subjectsDialog.all"
              >Asignaturas del centro ({{ data.subjects.length }})</span
            >
            <mat-form-field subscriptSizing="dynamic" class="app-dense-field w-full sm:w-64">
              <mat-label i18n="@@enrollDialog.candidates.filter">Filtrar</mat-label>
              <mat-icon matPrefix aria-hidden="true">search</mat-icon>
              <input
                matInput
                type="search"
                autocomplete="off"
                [value]="filter()"
                (input)="onFilter($event)"
              />
            </mat-form-field>
          </div>
          <ul
            class="flex min-h-0 flex-1 flex-col overflow-y-auto border-t border-outline-variant pt-1"
            aria-label="Asignaturas"
            i18n-aria-label="@@groupDialog.subjects"
          >
            @for (pick of subjectsForm.picks; track $index; let index = $index) {
              @let subject = data.subjects[index];
              @if (shown(subject)) {
                <li>
                  <mat-checkbox [formField]="pick.chosen" (change)="chosen(index)">
                    <span class="flex flex-col">
                      <span>{{ subjectOf(subject) }}</span>
                      @if (teacherOf(subject.id); as teacher) {
                        <span
                          class="text-body-small text-on-surface-variant"
                          i18n="@@subjectsDialog.taught"
                          >La da {{ teacher }} · solo como desdoble</span
                        >
                      } @else if (hasSplits(subject.id)) {
                        <span
                          class="text-body-small text-on-surface-variant"
                          i18n="@@subjectsDialog.hasSplits"
                          >Ya tiene un desdoble</span
                        >
                      }
                    </span>
                  </mat-checkbox>
                </li>
              }
            }
            @if (nothingShown()) {
              <li
                class="py-2 text-body-medium text-on-surface-variant"
                i18n="@@subjectsDialog.none"
              >
                Ninguna asignatura coincide
              </li>
            }
          </ul>

          @if (chosenCount() > 0) {
            <!-- As the chosen of «Matricular»: what will be added, each as the group it will be -->
            <div class="flex items-center justify-between gap-2">
              <span class="text-title-small" i18n="@@subjectsDialog.chosenCount"
                >Elegidas ({{ chosenCount() }})</span
              >
              <button matButton type="button" (click)="clearChosen()">
                <span i18n="@@subjectsDialog.clear">Quitar todas</span>
              </button>
            </div>
            <ul
              class="flex max-h-36 shrink-0 flex-col overflow-x-hidden overflow-y-auto"
              aria-label="Elegidas"
              i18n-aria-label="@@subjectsDialog.chosen"
            >
              @for (pick of subjectsForm.picks; track $index; let index = $index) {
                @let subject = data.subjects[index];
                @let value = pick().value();
                @if (value.chosen) {
                  <li class="flex flex-wrap items-center gap-x-2 gap-y-1 py-1">
                    <span class="min-w-40 flex-1">{{ subjectOf(subject) }}</span>
                    <mat-button-toggle-group
                      class="app-dense-toggle shrink-0"
                      hideSingleSelectionIndicator
                      [attr.aria-label]="subjectOf(subject)"
                      [value]="value.split"
                      (change)="splitChosen(index, $event.value)"
                    >
                      <mat-button-toggle
                        [value]="false"
                        [disabled]="forced(subject.id)"
                        i18n="@@subjectsDialog.whole"
                        >Toda la clase</mat-button-toggle
                      >
                      <mat-button-toggle [value]="true" i18n="@@subjectsDialog.split"
                        >Desdoble</mat-button-toggle
                      >
                    </mat-button-toggle-group>
                    <!-- The same width with a name or without: the rows stay aligned -->
                    <div class="w-36">
                      @if (value.split) {
                        <mat-form-field subscriptSizing="dynamic" class="app-dense-field w-full">
                          <input
                            matInput
                            [formField]="pick.label"
                            autocomplete="off"
                            [attr.aria-label]="labelOf(subject)"
                          />
                          @if (pick.label().errors()[0]; as error) {
                            <mat-error>{{ error.message }}</mat-error>
                          }
                        </mat-form-field>
                      }
                    </div>
                    <button
                      matIconButton
                      type="button"
                      [attr.aria-label]="removeLabel(subject)"
                      (click)="unchoose(index)"
                    >
                      <mat-icon aria-hidden="true">close</mat-icon>
                    </button>
                  </li>
                }
              }
            </ul>
          }
          @if (subjectsForm.picks().touched() && subjectsForm.picks().errors()[0]; as error) {
            <p class="text-body-medium text-error" role="alert">{{ error.message }}</p>
          }
          @if (teachers; as teachers) {
            <mat-form-field class="shrink-0">
              <mat-label i18n="@@groupDialog.teacher">Docente</mat-label>
              <mat-select [formField]="subjectsForm.teacherId">
                @for (teacher of teachers; track teacher.id) {
                  <mat-option [value]="teacher.id">{{ teacher.name }}</mat-option>
                }
              </mat-select>
              @if (subjectsForm.teacherId().errors()[0]; as error) {
                <mat-error>{{ error.message }}</mat-error>
              }
            </mat-form-field>
          }
          @if (failure(); as message) {
            <p class="text-body-medium text-error" role="alert">{{ message }}</p>
          }
        </div>
      </mat-dialog-content>
      <mat-dialog-actions>
        <button matButton type="button" mat-dialog-close i18n="@@groupDialog.cancel">
          Cancelar
        </button>
        <button matButton="filled" type="submit" [disabled]="subjectsForm().submitting()">
          @if (subjectsForm().submitting()) {
            <span i18n="@@groupDialog.saving">Guardando…</span>
          } @else {
            <span i18n="@@subjectsDialog.submit">Añadir ({{ chosenCount() }})</span>
          }
        </button>
      </mat-dialog-actions>
    </form>
  `,
})
export class SubjectsDialog {
  protected readonly data = inject<SubjectsDialogData>(MAT_DIALOG_DATA);
  private readonly ref = inject<MatDialogRef<SubjectsDialog, boolean>>(MatDialogRef);
  private readonly locale = inject(LanguageService).locale;

  /** For an administrator: the active teachers. */
  protected readonly teachers = this.data.teachers && teacherChoices(this.data.teachers, null);

  /** What the server said when adding failed, or null. */
  protected readonly failure = signal<string | null>(null);

  /** The groups of the class, with those this dialog has added. */
  private readonly classSubjects = signal(this.data.classSubjects);

  private readonly model = signal(toSubjectsFormModel(this.data.subjects, this.data.teacherId));

  protected readonly subjectsForm = form(this.model, subjectsSchema(this.classSubjects), {
    submission: {
      action: async (field) => {
        this.failure.set(null);
        const { teacherId } = field().value();
        const teacherName =
          this.data.teachers?.find(({ id }) => id === teacherId)?.name ?? this.data.userName();
        for (const draft of toGroupDrafts(field().value())) {
          try {
            await this.data.add(draft);
          } catch (error) {
            this.failure.set(groupActionMessage('save', error));
            return undefined;
          }
          // In the class now: out of the list of what is left, and known to the rules
          this.classSubjects.update((groups) => [...groups, { ...draft, teacherName }]);
          const index = this.data.subjects.findIndex(({ id }) => id === draft.subjectId);
          this.subjectsForm.picks[index]().value.update((pick) => ({ ...pick, chosen: false }));
        }
        this.ref.close(true);
        return undefined;
      },
    },
  });

  /** What is searched in the list, lower case. */
  protected readonly filter = signal('');

  /** The search leaves nothing in the list. */
  protected readonly nothingShown = computed(() =>
    this.data.subjects.every((subject) => !this.shown(subject)),
  );

  protected readonly chosenCount = computed(
    () => this.model().picks.filter(({ chosen }) => chosen).length,
  );

  /** Chosen, one the class has for the whole class is a split at once; unchosen, it starts again. */
  protected chosen(index: number): void {
    const pick = this.subjectsForm.picks[index];
    const { chosen, subjectId } = pick().value();
    const split = chosen && this.forced(subjectId);
    pick().value.update((current) => ({
      ...current,
      split,
      label: split ? nextSplitLabel(this.classSubjects(), subjectId) : '',
    }));
  }

  /** A split gets «Desdoble N» if it has no name yet; the group of the whole class needs none. */
  protected splitChosen(index: number, split: boolean): void {
    const pick = this.subjectsForm.picks[index];
    const { label, subjectId } = pick().value();
    pick().value.update((current) => ({
      ...current,
      split,
      label: split ? label || nextSplitLabel(this.classSubjects(), subjectId) : '',
    }));
  }

  /** Out of the chosen: it starts again. */
  protected unchoose(index: number): void {
    this.subjectsForm.picks[index]().value.update((pick) => ({
      ...pick,
      chosen: false,
      split: false,
      label: '',
    }));
  }

  protected clearChosen(): void {
    this.data.subjects.forEach((_, index) => this.unchoose(index));
  }

  /** «Quitar Programación básica», for the button of a chosen one. */
  protected removeLabel(subject: Subject): string {
    const name = this.subjectOf(subject);
    return $localize`:@@subjectsDialog.remove:Quitar ${name}:name:`;
  }

  /** «Nombre del desdoble de Programación básica», for its field. */
  protected labelOf(subject: Subject): string {
    const name = this.subjectOf(subject);
    return $localize`:@@subjectsDialog.label:Nombre del desdoble de ${name}:name:`;
  }

  protected onFilter(event: Event): void {
    this.filter.set((event.target as HTMLInputElement).value);
  }

  /** The subject has what is searched in its name, in the language of the interface. */
  protected shown(subject: Subject): boolean {
    return this.subjectOf(subject).toLowerCase().includes(this.filter().trim().toLowerCase());
  }

  /** The class has the group of the whole class of the subject: a new one is only a split. */
  protected forced(subjectId: string): boolean {
    return hasWholeGroup(this.classSubjects(), subjectId);
  }

  /** Who teaches the subject for the whole class already, or null. */
  protected teacherOf(subjectId: string): string | null {
    return (
      this.classSubjects().find((group) => group.subjectId === subjectId && group.label === null)
        ?.teacherName ?? null
    );
  }

  /** The class has only splits of the subject. */
  protected hasSplits(subjectId: string): boolean {
    return this.classSubjects().some((group) => group.subjectId === subjectId);
  }

  protected subjectOf(subject: Subject): string {
    return subjectName(subject, this.locale).name;
  }
}
